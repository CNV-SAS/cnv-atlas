import "server-only";
import { wompiEnvDeLaLlave } from "../ambiente";
import { RepartoInvalidoError, repartir } from "../reparto";
import { InventarioDeVentaError, reservarVenta, ubicacionDeLaVenta } from "./inventario-de-venta";
import * as Sentry from "@sentry/nextjs";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { baseFromTotal } from "@/core/iva";
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
};

// Sella el pago en UNA transaccion: pasa la transaccion de pending->paid (guardado
// por status='pending', asi solo sella una vez), sella la comision con la tasa
// vigente del profesional como snapshot y registra el ingreso de CNV. Devuelve la
// transaccion si la sello; null si ya no estaba pending (no hace nada, idempotente).
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
    const wompiEnv = ambienteDelEvento === "prod" ? "produccion" : ambienteDelEvento === "test" ? "test" : undefined;
    if (wompiEnv) {
      const [antes] = await tx
        .select({ wompiEnv: transactions.wompiEnv })
        .from(transactions)
        .where(and(eq(transactions.id, txId), eq(transactions.status, "pending")));
      if (antes && antes.wompiEnv !== wompiEnv) {
        // No es un error: es exactamente el caso que esto corrige. Se deja rastro porque solo pasa alrededor
        // de un cambio de llaves, y si pasa en otro momento algo esta mal configurado.
        Sentry.captureMessage("El pago llegó de otro ambiente que el del checkout", {
          level: "warning",
          tags: { area: "ambiente-del-pago", transactionId: txId },
          extra: { checkout: antes.wompiEnv, pago: wompiEnv },
        });
      }
    }
    const updated = await tx
      .update(transactions)
      .set({
        status: "paid",
        wompiTransactionId,
        paymentMethodType: paymentMethodType ?? null,
        paymentCardType: paymentCardType ?? null,
        ...(wompiEnv ? { wompiEnv } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.id, txId), eq(transactions.status, "pending")))
      .returning({
        id: transactions.id,
        amount: transactions.amount,
        currency: transactions.currency,
        patientId: transactions.patientId,
        professionalId: transactions.professionalId,
      });
    if (updated.length === 0) return null; // ya sellada u otro estado: idempotente
    const t = updated[0];
    await sealAccounting(tx, t);
    return t;
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
export async function createPaidCashTransaction(input: NewTransaction): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
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
      return { id: existing.id };
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
    return { id: t.id };
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
