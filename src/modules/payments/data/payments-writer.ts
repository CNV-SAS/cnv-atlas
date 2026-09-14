import "server-only";
import { wompiEnvDeLaLlave } from "../ambiente";
import { RepartoInvalidoError, repartir } from "../reparto";
import { InventarioDeVentaError, reservarVenta, ubicacionDeLaVenta } from "./inventario-de-venta";
import * as Sentry from "@sentry/nextjs";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { baseFromTotal } from "@/core/iva";
import { recordAudit } from "@/modules/audit/log";
import { db } from "@/db";
import {
  cnvRevenue,
  paymentWebhookEvents,
  professionalProfiles,
  professionalRevenue,
  revenueSplits,
  transactionItems,
  transactions,
} from "@/db/schema";

// Escrituras financieras de B6. Drizzle conecta como owner (BYPASSA RLS) a
// proposito: son escrituras server-side de sistema-de-registro y las tablas solo
// tienen policy de SELECT. El sellado del pago, la comision y el ingreso van en UNA
// transaccion de BD (db.transaction) para que nunca queden a medias.

// Tipo de la transaccion de BD (evita `any`, se mantiene con la version de Drizzle).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Contabilidad COMPARTIDA del sellado: comision del profesional (tasa snapshot), parte del proveedor e
// ingreso de CNV, dentro de la transaccion de BD dada. La usan el sellado del webhook de Wompi y la venta en
// EFECTIVO: UN solo camino contable, no dos. Todo sobre la BASE sin IVA (el IVA es recaudo, no ingreso).
//
// EL PROVEEDOR SE DESCUENTA DESDE EL 2026-09-13. Antes el ingreso de CNV era "base menos comision", y en
// LUVIA (proveedor al 70%) eso registraba 60.504 por venta cuando el real es 7.563: ocho veces mas, en el
// producto sobre el que esta abierta la pregunta de si el 10% de CNV cubre servirlo.
//
// Y NO SE ESCRIBIO UN REPARTO NUEVO. `repartir` (reparto.ts) existia desde el 2026-09-11, puro, probado y
// escrito para este sellado, y nadie lo importaba; `revenue_splits` tampoco lo leia nadie. Faltaba el cable.
//
// LA BASE ES LA DE CADA LINEA (base unitaria al peso por cantidad), la misma que va en la factura
// (`desgloseDeLaVenta`). Sacarla del total da un peso de diferencia en dos LUVIA (151.261 contra 151.260).
async function sealAccounting(
  tx: Tx,
  t: { id: string; amount: string; professionalId: string | null },
): Promise<void> {
  const lineas = await tx
    .select({
      nutraceuticalId: transactionItems.nutraceuticalId,
      cantidad: transactionItems.quantity,
      precioUnitario: transactionItems.unitPrice,
    })
    .from(transactionItems)
    .where(eq(transactionItems.transactionId, t.id));

  // LA PARTICIPACION VIGENTE HOY, EN HORA DE COLOMBIA. `valid_to` es exclusivo: cerrar una vigencia el dia X
  // e insertar la nueva desde X deja un solo reparto por dia, sin solape. Si por error hubiera dos, gana la
  // mas reciente, y es determinista.
  const participacion = new Map<string, number>();
  if (lineas.length > 0) {
    const vigentes = await tx
      .select({ nutraceuticalId: revenueSplits.nutraceuticalId, share: revenueSplits.supplierShare })
      .from(revenueSplits)
      .where(
        and(
          inArray(revenueSplits.nutraceuticalId, lineas.map((l) => l.nutraceuticalId)),
          sql`${revenueSplits.validFrom} <= (now() at time zone 'America/Bogota')::date`,
          sql`(${revenueSplits.validTo} is null or ${revenueSplits.validTo} > (now() at time zone 'America/Bogota')::date)`,
        ),
      )
      .orderBy(asc(revenueSplits.validFrom));
    for (const v of vigentes) participacion.set(v.nutraceuticalId, Number(v.share));
  }

  let rate = 0;
  if (t.professionalId) {
    const [prof] = await tx
      .select({ rate: professionalProfiles.commissionRate })
      .from(professionalProfiles)
      .where(eq(professionalProfiles.id, t.professionalId));
    rate = Number(prof?.rate ?? 0);
  }

  // Una venta sin lineas no la crea ningun camino actual; si llegara una, se reparte su total sin proveedor
  // en vez de dejar el pago sin contabilidad.
  const tramos =
    lineas.length > 0
      ? lineas.map((l) => ({
          base: baseFromTotal(Number(l.precioUnitario)) * Number(l.cantidad),
          proveedor: participacion.get(l.nutraceuticalId) ?? 0,
        }))
      : [{ base: baseFromTotal(Number(t.amount)), proveedor: 0 }];

  let comision = 0;
  let cnv = 0;
  for (const tramo of tramos) {
    if (!(tramo.base > 0)) continue; // una linea sin base no tiene nada que repartir
    let r;
    try {
      r = repartir({ base: tramo.base, tasaIntegrante: rate, participacionProveedor: tramo.proveedor });
    } catch (e) {
      // EL PAGO NO SE PIERDE POR UN REPARTO INVALIDO (decision de Santiago, 2026-09-13: el paciente ya
      // pago y el dinero es de CNV pase lo que pase). Un error aqui desharia el sellado entero, porque va
      // en la misma transaccion. `repartir` rechaza un residuo negativo; eso lo impide ya el trigger de la
      // 0119 sobre las tasas VIGENTES, pero la tasa que lee el sellado es la del perfil y puede diferir.
      // Se sella la aritmetica tal cual (CNV negativo queda VISIBLE en su fila) y se avisa.
      if (!(e instanceof RepartoInvalidoError)) throw e;
      Sentry.captureException(e, { tags: { area: "reparto-sellado", transactionId: t.id } });
      const montoIntegrante = Math.round(tramo.base * rate * 100) / 100;
      const montoProveedor = Math.round(tramo.base * tramo.proveedor * 100) / 100;
      r = { montoIntegrante, montoProveedor, montoCnv: Math.round((tramo.base - montoIntegrante - montoProveedor) * 100) / 100 };
    }
    comision += r.montoIntegrante;
    cnv += r.montoCnv;
  }
  comision = Math.round(comision * 100) / 100;
  cnv = Math.round(cnv * 100) / 100;

  if (t.professionalId) {
    await tx.insert(professionalRevenue).values({
      transactionId: t.id,
      professionalId: t.professionalId,
      commissionRate: String(rate), // snapshot de la tasa del momento
      commissionAmount: String(comision),
    });
  }
  // El residuo es el ingreso de CNV. La parte del proveedor no se guarda aqui: su cuenta por pagar es del
  // Bloque 4 (y en el Bloque 3 se sella en la linea); hoy se reconstruye exacta con la linea y la vigencia.
  await tx.insert(cnvRevenue).values({
    transactionId: t.id,
    amount: String(cnv),
  });
}

export type NewOrderLine = {
  nutraceuticalId: string;
  quantity: number;
  unitPrice: number;
};

export type NewTransaction = {
  organizationId: string;
  patientId: string;
  professionalId: string | null;
  amount: number;
  currency: string;
  idempotencyKey: string;
  items: NewOrderLine[];
  /** El tratamiento del que nace la venta. Nulo en `/pagos` (el paciente que vuelve solo a comprar). */
  treatmentId?: string | null;
};

export type NewCashTransaction = NewTransaction & {
  /**
   * DECISION (b) DE SANTIAGO (2026-09-14): anular, DENTRO de la misma transaccion, los links pendientes del
   * paciente que llevan alguno de estos productos. Es el caso de consulta: la tarjeta no paso, el paciente
   * paga en efectivo, y el link muerto retenia las unidades que esta venta necesita.
   */
  anularLinksQueComparten?: boolean;
  /** Quien registra la venta: queda como quien anulo el link. */
  actorId?: string | null;
};

// Crea la transaccion (pending), sus items y SUS RESERVAS en una sola transaccion de BD.
//
// LA RESERVA VA DENTRO (D3, Bloque 3): si no hay existencias, `reservarVenta` lanza
// `InventarioDeVentaError` y la venta no se crea. Un checkout pagable sin unidades detras es cobrar algo que
// no se puede entregar.
export async function createTransactionWithItems(
  input: NewTransaction,
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const locationId = await ubicacionDeLaVenta(tx, input.professionalId);
    const [t] = await tx
      .insert(transactions)
      .values({
        organizationId: input.organizationId,
        patientId: input.patientId,
        professionalId: input.professionalId,
        amount: String(input.amount),
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        // EL MODO DEL PAGO al nacer la venta (0135). Si el pago llega de otro ambiente, el sellado lo corrige
        // con el que declara el evento de Wompi, que es la fuente del hecho.
        wompiEnv: wompiEnvDeLaLlave(process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY),
        treatmentId: input.treatmentId ?? null,
        locationId,
        deliveryMode: "en_consulta",
        operatedAt: new Date(),
        // Toda venta nace con su entrega pendiente (sesion 2): es lo que hace que ninguna quede sin camino
        // para entregarse.
        fulfillmentState: "pendiente",
      })
      .returning({ id: transactions.id });
    if (input.items.length > 0) {
      await tx.insert(transactionItems).values(
        input.items.map((it) => ({
          transactionId: t.id,
          nutraceuticalId: it.nutraceuticalId,
          quantity: it.quantity,
          unitPrice: String(it.unitPrice),
        })),
      );
    }
    if (!locationId) {
      throw new InventarioDeVentaError("No hay una ubicación de inventario de la que pueda salir esta venta.");
    }
    await reservarVenta(tx, t.id, locationId);
    return { id: t.id };
  });
}

export type WebhookRecord = { isNew: boolean; alreadyProcessed: boolean };

// Registra el evento de webhook con el gate de idempotencia unique(provider,
// external_id). Si ya existia, informa si ya fue procesado (processed_at no nulo).
// Este es el control que hace que un webhook duplicado produzca un solo efecto.
export async function recordWebhookEvent(
  provider: string,
  externalId: string,
  payload: unknown,
): Promise<WebhookRecord> {
  const inserted = await db
    .insert(paymentWebhookEvents)
    .values({ provider, externalId, payload })
    .onConflictDoNothing({
      target: [paymentWebhookEvents.provider, paymentWebhookEvents.externalId],
    })
    .returning({ id: paymentWebhookEvents.id });
  if (inserted.length > 0) return { isNew: true, alreadyProcessed: false };

  const [existing] = await db
    .select({ processedAt: paymentWebhookEvents.processedAt })
    .from(paymentWebhookEvents)
    .where(
      and(
        eq(paymentWebhookEvents.provider, provider),
        eq(paymentWebhookEvents.externalId, externalId),
      ),
    );
  return { isNew: false, alreadyProcessed: existing?.processedAt != null };
}

export async function markWebhookProcessed(
  provider: string,
  externalId: string,
): Promise<void> {
  await db
    .update(paymentWebhookEvents)
    .set({ processedAt: new Date() })
    .where(
      and(
        eq(paymentWebhookEvents.provider, provider),
        eq(paymentWebhookEvents.externalId, externalId),
      ),
    );
}

export type SealedTransaction = {
  id: string;
  amount: string;
  currency: string;
  patientId: string | null;
  professionalId: string | null;
  /**
   * El pago llego sobre un link que Atlas ya habia ANULADO: quedo sellado, SIN contabilidad, sin descuento y
   * sin factura, esperando revision. Quien llama no debe descontar ni facturar.
   */
  enRevision: boolean;
};

// Sella el pago en UNA transaccion: la venta pasa a paid, se sella la comision con la tasa vigente como
// snapshot y se registra el ingreso de CNV. Devuelve la venta si la sello; null si no habia nada que sellar
// (ya pagada, reembolsada o inexistente): idempotente.
//
// ═══ SE SELLA TAMBIEN DESDE `failed` (decision de Santiago, 2026-09-14) ═══
//
// Antes solo desde `pending`, y un APPROVED sobre una venta `failed` se perdia: dinero cobrado y sin
// registrar. Pasa de dos maneras, y NO se tratan igual:
//
//   · `failed` POR RECHAZO DE WOMPI (un intento rechazado y despues uno aprobado): es un pago normal. Se sella
//     con su contabilidad, y el inventario, que se libero con el rechazo, vuelve a `pendiente` para que el
//     servicio lo descuente. Es la decision 4: el dinero se movio.
//   · `failed` PORQUE ATLAS ANULO EL LINK (`cancelled_at`): casi seguro un cobro doble, porque el link se anula
//     al cobrar en efectivo. Se sella el pago (el dinero entro), pero SIN contabilidad, sin descuento y sin
//     factura, y la venta queda `review_reason = pago_sobre_link_anulado`. Una factura validada por la DIAN
//     solo se deshace con nota credito, y esa no existe hasta el 3b.
export async function sealPaidTransaction(
  txId: string,
  wompiTransactionId: string,
  // El instrumento con que pago el paciente. Opcional: un evento sin el no puede impedir sellar el pago.
  paymentMethodType?: string | null,
  paymentCardType?: string | null,
  // EL AMBIENTE QUE DECLARA EL EVENTO DE WOMPI ("test" | "prod"). Es la fuente del hecho: la venta guarda
  // el ambiente con que se CREO el checkout, pero la llave con que se COBRA la pone la pagina al abrirse.
  // Un link creado antes de un cambio de llaves y pagado despues cruzaria de ambiente (hallazgo del 2b).
  ambienteDelEvento?: "test" | "prod" | null,
): Promise<SealedTransaction | null> {
  return db.transaction(async (tx) => {
    // Bloqueo de la fila: un DECLINED y un APPROVED que llegan a la vez no pueden leer el mismo estado.
    const [antes] = await tx.execute<{
      status: string;
      wompi_env: string;
      cancelled_at: string | null;
      stock_state: string | null;
    }>(sql`select status, wompi_env, cancelled_at, stock_state from transactions where id = ${txId} for update`);
    if (!antes || (antes.status !== "pending" && antes.status !== "failed")) return null; // idempotente

    const wompiEnv = ambienteDelEvento === "prod" ? "produccion" : ambienteDelEvento === "test" ? "test" : undefined;
    if (wompiEnv && antes.wompi_env !== wompiEnv) {
      // No es un error: es exactamente el caso que esto corrige. Se deja rastro porque solo pasa alrededor
      // de un cambio de llaves, y si pasa en otro momento algo esta mal configurado.
      Sentry.captureMessage("El pago llegó de otro ambiente que el del checkout", {
        level: "warning",
        tags: { area: "ambiente-del-pago", transactionId: txId },
        extra: { checkout: antes.wompi_env, pago: wompiEnv },
      });
    }

    const sobreLinkAnulado = antes.status === "failed" && antes.cancelled_at != null;
    const updated = await tx
      .update(transactions)
      .set({
        status: "paid",
        wompiTransactionId,
        paymentMethodType: paymentMethodType ?? null,
        paymentCardType: paymentCardType ?? null,
        ...(wompiEnv ? { wompiEnv } : {}),
        ...(sobreLinkAnulado ? { reviewReason: "pago_sobre_link_anulado" } : {}),
        // Rechazado y despues aprobado: sus reservas se liberaron con el rechazo, asi que el descuento sale de
        // lo disponible. En el anulado el inventario se queda `liberado` hasta la revision.
        ...(!sobreLinkAnulado && antes.status === "failed" && antes.stock_state === "liberado"
          ? { stockState: "pendiente" }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.id, txId), inArray(transactions.status, ["pending", "failed"])))
      .returning({
        id: transactions.id,
        amount: transactions.amount,
        currency: transactions.currency,
        patientId: transactions.patientId,
        professionalId: transactions.professionalId,
      });
    if (updated.length === 0) return null;
    const t = updated[0];
    if (!sobreLinkAnulado) await sealAccounting(tx, t);
    return { ...t, enRevision: sobreLinkAnulado };
  });
}

// Venta en EFECTIVO: crea la transaccion YA pagada (el efectivo se paga en el momento) con su medio,
// items y contabilidad, todo en UNA transaccion de BD (vendido-y-pagado no queda a medias). Reusa la
// MISMA contabilidad que el webhook de Wompi (sealAccounting). Idempotente por idempotency_key: un doble
// envio no crea ni sella dos veces (onConflictDoNothing + re-lectura). El efectivo es dinero de CNV que
// el integrante custodia; eso lo refleja payment_method='efectivo' (la liquidacion suma lo custodiado).
//
// EL INVENTARIO NO SE DESCUENTA AQUI (Bloque 3): la venta nace `pendiente` de descuento y el servicio lo
// corre despues, en su propia transaccion. Dentro de esta, un error de inventario desharia la venta ya
// cobrada. En efectivo no hay reserva: el pago y la entrega son el mismo momento.
export async function createPaidCashTransaction(
  input: NewCashTransaction,
): Promise<{ id: string; linksAnulados: string[] }> {
  return db.transaction(async (tx) => {
    // PRIMERO SE ANULAN LOS LINKS: sus reservas se liberan en esta misma transaccion, y el descuento de esta
    // venta (que corre despues) ya encuentra esas unidades disponibles.
    const linksAnulados: string[] = [];
    if (input.anularLinksQueComparten) {
      const ids = await linksPendientesQueComparten(
        tx,
        input.patientId,
        input.items.map((i) => i.nutraceuticalId),
      );
      for (const id of ids) {
        if ((await anularCheckout(id, input.actorId ?? null, tx)) === "anulado") linksAnulados.push(id);
      }
    }
    const locationId = await ubicacionDeLaVenta(tx, input.professionalId);
    const inserted = await tx
      .insert(transactions)
      .values({
        organizationId: input.organizationId,
        patientId: input.patientId,
        professionalId: input.professionalId,
        status: "paid",
        paymentMethod: "efectivo",
        amount: String(input.amount),
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        // EL MODO DEL PAGO SE ESCRIBE AL NACER LA VENTA: en efectivo no hay evento de Wompi que lo corrija, y
        // es lo que impide que una venta de prueba se facture como real (0135).
        wompiEnv: wompiEnvDeLaLlave(process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY),
        treatmentId: input.treatmentId ?? null,
        locationId,
        deliveryMode: "en_consulta",
        operatedAt: new Date(),
        stockState: "pendiente",
        fulfillmentState: "pendiente",
      })
      .onConflictDoNothing({ target: transactions.idempotencyKey })
      .returning({
        id: transactions.id,
        amount: transactions.amount,
        professionalId: transactions.professionalId,
      });
    if (inserted.length === 0) {
      // Doble envio (misma idempotency_key): ya se creo y sello. Se re-lee y no se vuelve a sellar.
      const [existing] = await tx
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.idempotencyKey, input.idempotencyKey));
      return { id: existing.id, linksAnulados };
    }
    const t = inserted[0];
    if (input.items.length > 0) {
      await tx.insert(transactionItems).values(
        input.items.map((it) => ({
          transactionId: t.id,
          nutraceuticalId: it.nutraceuticalId,
          quantity: it.quantity,
          unitPrice: String(it.unitPrice),
        })),
      );
    }
    await sealAccounting(tx, t);
    return { id: t.id, linksAnulados };
  });
}

export async function markTransactionFailed(
  txId: string,
  wompiTransactionId: string,
): Promise<void> {
  await db
    .update(transactions)
    .set({ status: "failed", wompiTransactionId, updatedAt: new Date() })
    .where(and(eq(transactions.id, txId), eq(transactions.status, "pending")));
}

export async function setAlegraInvoiceId(
  txId: string,
  alegraInvoiceId: string,
): Promise<void> {
  // Guardado por alegra_invoice_id null para no pisar una factura ya creada.
  await db
    .update(transactions)
    .set({ alegraInvoiceId, updatedAt: new Date() })
    .where(and(eq(transactions.id, txId), isNull(transactions.alegraInvoiceId)));
}

export type ResultadoDeAnular = "anulado" | "no_estaba_pendiente";

// ═══ ANULAR UN LINK DE PAGO (decision (a) de Santiago, 2026-09-14) ═══
//
// En UNA transaccion: la venta queda `failed` con quien y cuando la anulo, y sus reservas se liberan. Solo
// una venta `pending` de Wompi: una pagada no se anula (eso es una reversa, 3b), y una en efectivo nace pagada.
//
// Recibe la transaccion de BD opcional para que la venta en efectivo pueda anular el link del mismo paciente
// DENTRO de la suya (decision (b)): las unidades liberadas son las que usa esa venta.
//
// La pagina del link deja de mostrarse sola (solo sirve un checkout `pending`). Una pagina de Wompi que el
// paciente ya tenia abierta todavia puede cobrar hasta que venza; ese pago llega a `sealPaidTransaction`,
// que lo deja en revision.
export async function anularCheckout(
  txId: string,
  actorId: string | null,
  enTx?: Tx,
): Promise<ResultadoDeAnular> {
  const correr = async (tx: Tx): Promise<ResultadoDeAnular> => {
    const [venta] = await tx.execute<{ status: string; payment_method: string }>(sql`
      select status, payment_method from transactions where id = ${txId} for update`);
    if (!venta || venta.status !== "pending" || venta.payment_method !== "wompi") return "no_estaba_pendiente";
    await tx.execute(sql`
      update transactions
         set status = 'failed', cancelled_at = now(), cancelled_by = ${actorId},
             stock_state = case when stock_state = 'reservado' then 'liberado' else stock_state end,
             updated_at = now()
       where id = ${txId}`);
    await tx.execute(sql`
      update inventory_reservations r set released_at = now()
        from transaction_items ti
       where ti.id = r.transaction_item_id and ti.transaction_id = ${txId}
         and r.released_at is null and r.consumed_at is null`);
    return "anulado";
  };
  return enTx ? correr(enTx) : db.transaction(correr);
}

/**
 * Los links de pago PENDIENTES de un paciente que llevan alguno de estos productos. Es lo que la venta en
 * efectivo anula (decision (b)). Sin limite de 24 horas a proposito: un link vencido ya no cobra desde
 * nuestra pagina, pero sigue `pending` y anularlo no cuesta nada.
 */
export async function linksPendientesQueComparten(
  ex: typeof db | Tx,
  patientId: string,
  nutraceuticalIds: string[],
): Promise<string[]> {
  if (nutraceuticalIds.length === 0) return [];
  const filas = await ex.execute<{ id: string }>(sql`
    select distinct t.id
      from transactions t
      join transaction_items ti on ti.transaction_id = t.id
     where t.patient_id = ${patientId}
       and t.status = 'pending' and t.payment_method = 'wompi'
       and ti.nutraceutical_id in (${sql.join(nutraceuticalIds.map((id) => sql`${id}::uuid`), sql`, `)})
     order by t.id`);
  return filas.map((f) => f.id);
}

export type ResolucionDeRevision = "segunda_compra" | "devuelto";

/**
 * RESUELVE una venta en revision (pago sobre link anulado). Devuelve la venta si la resolvio; null si no
 * estaba en revision o ya estaba resuelta.
 *
 *   · `segunda_compra`: el paciente si queria las dos. Se sella la contabilidad que se habia retenido y el
 *     inventario pasa a `pendiente`. Quien llama descuenta y factura, igual que tras un pago normal.
 *   · `devuelto`: el pago ya se le devolvio al paciente en Wompi. La venta pasa a `refunded` y no se factura
 *     ni se descuenta nada. Atlas NO hace la devolucion: deja constancia de que se hizo.
 */
export async function resolverRevision(
  txId: string,
  resolucion: ResolucionDeRevision,
  actorId: string,
): Promise<SealedTransaction | null> {
  return db.transaction(async (tx) => {
    const [venta] = await tx.execute<{
      status: string;
      review_reason: string | null;
      review_resolution: string | null;
    }>(sql`select status, review_reason, review_resolution from transactions where id = ${txId} for update`);
    if (!venta || venta.status !== "paid" || !venta.review_reason || venta.review_resolution) return null;
    const [t] = await tx
      .update(transactions)
      .set({
        reviewResolution: resolucion,
        reviewedAt: new Date(),
        reviewedBy: actorId,
        ...(resolucion === "segunda_compra" ? { stockState: "pendiente" } : { status: "refunded" as const }),
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, txId))
      .returning({
        id: transactions.id,
        amount: transactions.amount,
        currency: transactions.currency,
        patientId: transactions.patientId,
        professionalId: transactions.professionalId,
      });
    if (resolucion === "segunda_compra") await sealAccounting(tx, t);
    return { ...t, enRevision: false };
  });
}

export type LinkPendiente = { id: string; amount: string; createdAt: string; productos: string };

/**
 * El detalle de los links pendientes del paciente que comparten producto con una venta, para AVISAR antes de
 * cobrar en efectivo. Lectura con la conexion de sistema y no con RLS, a proposito: el profesional no ve un
 * link que genero un administrador para su paciente, y ese link retiene las mismas unidades. Solo sale
 * producto, monto y fecha, de un paciente que el profesional ya tiene en pantalla.
 */
export async function detalleDeLinksPendientes(
  patientId: string,
  nutraceuticalIds: string[],
): Promise<LinkPendiente[]> {
  const ids = await linksPendientesQueComparten(db, patientId, nutraceuticalIds);
  if (ids.length === 0) return [];
  const filas = await db.execute<{ id: string; amount: string; created_at: string; productos: string }>(sql`
    select t.id, t.amount::text as amount, t.created_at::text as created_at,
           string_agg(n.name || ' x' || ti.quantity, ', ' order by n.name) as productos
      from transactions t
      join transaction_items ti on ti.transaction_id = t.id
      join nutraceuticals n on n.id = ti.nutraceutical_id
     where t.id in (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
     group by t.id
     order by t.created_at desc`);
  return filas.map((f) => ({ id: f.id, amount: String(f.amount), createdAt: String(f.created_at), productos: f.productos }));
}

export type ResultadoDeEntrega = "entregada" | "no_pagada" | "ya_entregada" | "en_revision" | "sin_estado";

// ═══ LA ENTREGA DE UNA VENTA (Bloque 3, sesion 2) ═══
//
// NO EXISTE CAMINO PARA ENTREGAR SIN VENTA: la entrega es un estado de la venta, y solo de una PAGADA. Antes
// la entrega era un movimiento suelto (`despacho`) que no sabia de la venta, y un producto podia salir de la
// vitrina sin que nadie lo cobrara.
//
// EL INVENTARIO NO SE MUEVE AQUI: se movio al sellar el pago (D2). Entregar es el hecho de que el paciente se
// llevo el producto. Por eso una venta `sin_saldo` SI se entrega: el producto esta en la mano del Integrante,
// y lo que esta mal es el saldo de Atlas.
//
// Y SE AUDITA INLINE (regla dura 8, Decision 3 del plan): es el momento en que un nutraceutico prescrito llega
// al paciente. El payload lleva productos y cantidades; nunca nombre ni documento.
export async function registrarEntrega(
  txId: string,
  actor: { id: string; email: string | null },
): Promise<ResultadoDeEntrega> {
  return db.transaction(async (tx) => {
    const [venta] = await tx.execute<{
      status: string;
      fulfillment_state: string | null;
      treatment_id: string | null;
      en_revision: boolean;
    }>(sql`
      select status, fulfillment_state, treatment_id,
             (review_reason is not null and review_resolution is distinct from 'segunda_compra') as en_revision
        from transactions where id = ${txId} for update`);
    if (!venta || venta.fulfillment_state == null) return "sin_estado";
    if (venta.fulfillment_state === "entregado") return "ya_entregada";
    if (venta.status !== "paid") return "no_pagada";
    // Un pago en revision puede ser un cobro doble: entregar ahora seria entregar dos veces el mismo producto.
    if (venta.en_revision) return "en_revision";

    const items = await tx.execute<{ nutraceutical_id: string; quantity: number }>(sql`
      select nutraceutical_id, quantity from transaction_items where transaction_id = ${txId} order by nutraceutical_id`);
    const [entrega] = await tx.execute<{ delivered_at: string }>(sql`
      update transactions
         set fulfillment_state = 'entregado', delivered_at = now(), delivered_by = ${actor.id}, updated_at = now()
       where id = ${txId}
      returning delivered_at::text as delivered_at`);
    await recordAudit(tx, {
      event: "nutraceutical.delivered",
      actorId: actor.id,
      actorEmail: actor.email,
      entityType: "transaction",
      entityId: txId,
      payload: {
        // LA HORA DE LA ENTREGA VA EXPLICITA en el payload, no solo en `created_at` del registro: es el hecho
        // clinico, y quien lea el payload suelto (un export, un reporte) no tiene por que saber que la fila la
        // trae aparte. Es la misma de la venta, escrita en la misma transaccion.
        delivered_at: entrega.delivered_at,
        treatment_id: venta.treatment_id,
        items: items.map((i) => ({ nutraceutical_id: i.nutraceutical_id, quantity: Number(i.quantity) })),
      },
    });
    return "entregada";
  });
}
