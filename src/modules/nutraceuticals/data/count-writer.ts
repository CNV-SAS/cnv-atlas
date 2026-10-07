import "server-only";

import { and, eq, gt, isNull, sql as dsql, sum } from "drizzle-orm";

import { addBusinessDays } from "@/core/dates/colombia-business-days";
import { recordAudit } from "@/modules/audit/log";
import { DESCUENTO_DISTRIBUCION, precioDeFacturacion } from "@/modules/payments/distribucion";
import { estadoDelConteo, fraseDelConteo, type EstadoDelConteo } from "../ventana-de-conteo";
import { db } from "@/db";
import {
  nutraceuticalCountLines,
  nutraceuticalCountSessions,
  nutraceuticalFaltanteCases,
  nutraceuticalFaltanteTransitions,
  nutraceuticalInventory,
  nutraceuticalStockMovements,
  nutraceuticals,
  professionalProfiles,
  profiles,
  inventoryLocations,
  lots,
} from "@/db/schema";

// Escritura del conteo fisico (T3b-3 ST2). TRANSACCIONAL (Drizzle owner, atomico): la sesion, sus lineas y
// los casos de faltante que abre son todo o nada. El conteo se registra SIEMPRE (evidencia de la obligacion
// del periodo; la cadencia es MENSUAL con ventana configurable desde la 0208, no semanal), cuadre o no, y
// puede ser PARCIAL (solo las lineas que trae el input). Por cada linea con faltante
// (fisico < saldo) abre un caso INDEPENDIENTE (uno por producto, su propio plazo), con el precio SELLADO al
// momento del conteo, ligado a la sesion. El sobrante (fisico > saldo) se registra en la linea, no ajusta el
// saldo en silencio (su resolucion es aparte). El saldo del sistema NO se toca aqui: baja al cerrar el caso.

export type CountLineInput = { nutraceuticalId: string; lote: string | null; physicalQty: number };

export type CountResult = {
  sessionId: string;
  opened: { nutraceuticalId: string; quantity: number; sealedTotal: string; sealedCharge: string }[];
  sobrantes: { nutraceuticalId: string; extra: number }[];
  cuadraron: number;
};

export class ConteoFueraDeVentanaError extends Error {}

/**
 * EL ESTADO DE LA VENTANA DE UN INTEGRANTE, leido de la configuracion y de sus propios datos.
 *
 * LA DECISION LA TOMA EL MODULO PURO (`ventana-de-conteo.ts`), que tiene candado. Aqui solo se leen los tres
 * insumos: la ventana configurada, su ultimo conteo, y la apertura manual vigente si hay alguna.
 */
export async function estadoDeLaVentanaDeConteo(
  professionalId: string,
): Promise<EstadoDelConteo> {
  const [cfg] = await db.execute<{ dia: number; dias: number; hoy: string }>(dsql`
    select coalesce(c.conteo_dia_de_apertura, 1) as dia,
           coalesce(c.conteo_dias_de_ventana, 5) as dias,
           (now() at time zone 'America/Bogota')::date::text as hoy
      from (select 1) z left join commercial_config c on true limit 1`);

  const [ultimo] = await db.execute<{ dia: string | null }>(dsql`
    select (created_at at time zone 'America/Bogota')::date::text as dia
      from nutraceutical_count_sessions
     where professional_id = ${professionalId}
     order by created_at desc limit 1`);

  // ── LA APERTURA VIGENTE, Y SI YA LA RESPONDIO ──────────────────────────────────────────────────────
  //
  // LA VIGENTE ES LA QUE LLEGA MAS LEJOS, no la mas reciente: si admin concedio dos, la que manda es la que
  // todavia vale. Tomar la ultima creada cerraria el conteo antes de lo concedido.
  //
  // Y "YA RESPONDIDA" SE RESUELVE AQUI, COMPARANDO INSTANTES, no fechas. El caso real es el del MISMO DIA
  // ("contaste esta mañana, no cuadra, cuenta otra vez"), y a resolucion de dia los dos conteos caen en la
  // misma fecha y la peticion se perderia. Lo atrapo el candado de base cuando estaba escrito con fechas.
  const [apertura] = await db.execute<{
    valid_until: string;
    motivo: string;
    ya_respondida: boolean;
  }>(dsql`
    select o.valid_until::text as valid_until,
           o.motivo,
           exists (
             select 1 from nutraceutical_count_sessions s
              where s.professional_id = o.professional_id
                and s.created_at >= o.created_at
           ) as ya_respondida
      from nutraceutical_count_openings o
     where o.professional_id = ${professionalId}
       and o.valid_until >= (now() at time zone 'America/Bogota')::date
     -- LAS SIN RESPONDER PRIMERO, Y ESO ES LA CORRECCION (2026-10-06). Ordenaba solo por valid_until desc, y
     -- con DOS aperturas vigentes que vencen el mismo dia el empate se rompia al azar: podia elegir una VIEJA
     -- y ya respondida, y concluir que el conteo estaba cerrado aunque hubiera otra recien concedida
     -- esperando respuesta. La regla correcta es "hay alguna sin responder", no "como esta LA vigente".
     order by ya_respondida asc, o.valid_until desc
     limit 1`);

  return estadoDelConteo({
    hoy: cfg.hoy,
    diaDeApertura: Number(cfg.dia),
    diasDeVentana: Number(cfg.dias),
    ultimoConteo: ultimo?.dia ?? null,
    aperturaManual: apertura
      ? { yaRespondida: apertura.ya_respondida === true, hasta: apertura.valid_until, motivo: apertura.motivo }
      : null,
  });
}

export async function recordCount(input: {
  professionalId: string;
  actorId: string;
  note: string | null;
  lines: CountLineInput[];
  now: Date;
}): Promise<CountResult> {
  // ═══ LA VENTANA SE VERIFICA AQUI, NO SOLO EN LA PANTALLA (0208) ═══
  //
  // Es lo unico que de verdad hay que guardar de esta pieza: si fuera de la ventana se pudiera registrar
  // igual, la ventana seria decorativa y volveriamos a la seccion siempre encendida, solo que con un texto
  // nuevo. Una pantalla que no ofrece el formulario no impide un envio.
  //
  // Y EL MENSAJE DICE CUANDO LE TOCA, no solo que no puede: "no disponible" sin fecha deja al Integrante sin
  // nada que hacer con la informacion, que es el problema con el que empezo todo esto.
  const ventana = await estadoDeLaVentanaDeConteo(input.professionalId);
  if (!ventana.abierto) {
    throw new ConteoFueraDeVentanaError(fraseDelConteo(ventana));
  }

  return db.transaction(async (tx) => {
    const [session] = await tx
      .insert(nutraceuticalCountSessions)
      .values({ professionalId: input.professionalId, note: input.note, createdBy: input.actorId })
      .returning({ id: nutraceuticalCountSessions.id });

    const opened: CountResult["opened"] = [];
    const sobrantes: CountResult["sobrantes"] = [];
    let cuadraron = 0;

    for (const line of input.lines) {
      // Snapshot del saldo del sistema al momento del conteo.
      //
      // SUMA DE TODOS LOS LOTES desde la migracion 0121. Antes habia UNA fila por (profesional, producto)
      // y `[0]` era el saldo; ahora hay una por lote, asi que tomar la primera daria el saldo de un lote
      // cualquiera y el conteo fisico se compararia contra una fraccion de lo que hay en la vitrina.
      // Eso abriria FALTANTES FALSOS, que es lo peor que puede hacer este codigo: un faltante tiene
      // consecuencia economica para el Integrante.
      const [inv] = await tx
        .select({ stock: sum(nutraceuticalInventory.stockQuantity) })
        .from(nutraceuticalInventory)
        .where(
          and(
            eq(nutraceuticalInventory.professionalId, input.professionalId),
            eq(nutraceuticalInventory.nutraceuticalId, line.nutraceuticalId),
          ),
        );
      const systemQty = Number(inv?.stock ?? 0);

      await tx.insert(nutraceuticalCountLines).values({
        sessionId: session.id,
        nutraceuticalId: line.nutraceuticalId,
        lote: line.lote,
        physicalQty: line.physicalQty,
        systemQty,
      });

      const diff = line.physicalQty - systemQty;
      if (diff < 0) {
        // ═══ EL CASO SELLA DOS CIFRAS DISTINTAS, Y ESA ES LA CORRECCION DEL 2026-09-29 ═══
        //
        // Sellaba el PVP CON IVA y cobraba eso. El modelo dice el precio de FACTURACION (base sin IVA menos
        // el descuento del Integrante), y contabilidad lo confirmo con tres razones: el IVA no se causo
        // (no hubo venta), CNV nunca iba a recibir el PVP por esa unidad, y cobrar el PVP haria el faltante
        // MAS RENTABLE QUE LA VENTA. En MULTICELL eran 107.100 contra 72.000.
        //
        // SE SELLAN LAS DOS: el PVP de referencia (que explica de donde sale la cuenta) y el CARGO, que es
        // lo que cobra la liquidacion.
        const [prod] = await tx
          .select({ price: nutraceuticals.unitPrice })
          .from(nutraceuticals)
          .where(eq(nutraceuticals.id, line.nutraceuticalId));
        const unitPrice = prod?.price ?? "0";
        const quantity = -diff;
        const sealedTotal = (Number(unitPrice) * quantity).toString();

        // LA TASA VIGENTE A LA DETECCION, no un 20% fijo ni la de hoy: se sella igual que el precio, para
        // que un caso viejo pueda explicar su cuenta aunque la tasa cambie despues. Sin fila de vigencia se
        // cae a la del perfil, y sin perfil al 20% que fija el modelo.
        const [vigente] = await tx.execute<{ rate: string }>(dsql`
          select rate::text as rate from professional_commission_rates
           where professional_id = ${input.professionalId}
             and valid_from <= (${input.now.toISOString()}::timestamptz at time zone 'America/Bogota')::date
             and (valid_to is null or valid_to > (${input.now.toISOString()}::timestamptz at time zone 'America/Bogota')::date)
           order by valid_from desc limit 1`);
        const [perfil] = await tx
          .select({ rate: professionalProfiles.commissionRate })
          .from(professionalProfiles)
          .where(eq(professionalProfiles.id, input.professionalId));
        const tasa = vigente ? Number(vigente.rate) : Number(perfil?.rate ?? DESCUENTO_DISTRIBUCION);

        // LA MISMA ARITMETICA QUE LA CUENTA DE DISTRIBUCION, y a proposito: el modelo llama a las dos
        // "precio de facturacion". Dos funciones que calculan lo mismo se separan; esta es una sola.
        const precio = precioDeFacturacion(Number(unitPrice), tasa);
        const sealedCharge = (precio.baseDescontada * quantity).toString();
        const [c] = await tx
          .insert(nutraceuticalFaltanteCases)
          .values({
            professionalId: input.professionalId,
            nutraceuticalId: line.nutraceuticalId,
            lote: line.lote,
            quantity,
            sealedUnitPrice: unitPrice,
            sealedTotal,
            sealedBaseUnit: String(precio.base),
            sealedCommissionRate: String(tasa),
            sealedCharge,
            reportedAt: input.now,
            deadlineAt: addBusinessDays(input.now, 5),
            countSessionId: session.id,
            createdBy: input.actorId,
          })
          .returning({ id: nutraceuticalFaltanteCases.id });
        // Transicion de apertura (fuente de verdad del estado). from_status NULL.
        await tx.insert(nutraceuticalFaltanteTransitions).values({
          caseId: c.id,
          fromStatus: null,
          toStatus: "reportado",
          actorId: input.actorId,
        });
        opened.push({ nutraceuticalId: line.nutraceuticalId, quantity, sealedTotal, sealedCharge });
      } else if (diff > 0) {
        sobrantes.push({ nutraceuticalId: line.nutraceuticalId, extra: diff });
      } else {
        cuadraron++;
      }
    }

    return { sessionId: session.id, opened, sobrantes, cuadraron };
  });
}

// ----- SOBRANTE (T3b-3 ST5b): contado > saldo. NO abre caso ni cobra: es informacion, no deuda. CNV lo
// resuelve con una conciliacion (+extra) y motivo obligatorio. Un sobrante esta PENDIENTE mientras no exista
// un movimiento que referencie su linea de conteo (count_line_id). -----

export type PendingSobrante = {
  countLineId: string;
  nutraceuticalName: string;
  integranteName: string;
  extra: number; // physical - system
  countedAt: string;
};

export async function getPendingSobrantes(): Promise<PendingSobrante[]> {
  const rows = await db
    .select({
      countLineId: nutraceuticalCountLines.id,
      name: nutraceuticals.name,
      integrante: profiles.fullName,
      physical: nutraceuticalCountLines.physicalQty,
      system: nutraceuticalCountLines.systemQty,
      createdAt: nutraceuticalCountLines.createdAt,
    })
    .from(nutraceuticalCountLines)
    .innerJoin(nutraceuticalCountSessions, eq(nutraceuticalCountSessions.id, nutraceuticalCountLines.sessionId))
    .innerJoin(nutraceuticals, eq(nutraceuticals.id, nutraceuticalCountLines.nutraceuticalId))
    .innerJoin(professionalProfiles, eq(professionalProfiles.id, nutraceuticalCountSessions.professionalId))
    .innerJoin(profiles, eq(profiles.id, professionalProfiles.profileId))
    .leftJoin(nutraceuticalStockMovements, eq(nutraceuticalStockMovements.countLineId, nutraceuticalCountLines.id))
    .where(
      and(
        gt(nutraceuticalCountLines.physicalQty, nutraceuticalCountLines.systemQty),
        isNull(nutraceuticalStockMovements.id), // sin movimiento que lo resuelva => pendiente
      ),
    )
    .orderBy(nutraceuticalCountLines.createdAt);
  return rows.map((r) => ({
    countLineId: r.countLineId,
    nutraceuticalName: r.name,
    integranteName: r.integrante,
    extra: r.physical - r.system,
    countedAt: r.createdAt.toISOString(),
  }));
}

// Resuelve un sobrante: conciliacion (+extra) ligada a la linea, con motivo. El trigger del movimiento sube
// el saldo. Rechaza si la linea no es un sobrante o si ya se resolvio (idempotencia).
export async function resolveSobrante(input: {
  countLineId: string;
  actorId: string;
  reason: string;
}): Promise<{ ok: boolean; message?: string }> {
  return db.transaction(async (tx) => {
    const [line] = await tx
      .select({
        physical: nutraceuticalCountLines.physicalQty,
        system: nutraceuticalCountLines.systemQty,
        nutraceuticalId: nutraceuticalCountLines.nutraceuticalId,
        lote: nutraceuticalCountLines.lote,
        professionalId: nutraceuticalCountSessions.professionalId,
      })
      .from(nutraceuticalCountLines)
      .innerJoin(nutraceuticalCountSessions, eq(nutraceuticalCountSessions.id, nutraceuticalCountLines.sessionId))
      .where(eq(nutraceuticalCountLines.id, input.countLineId));
    if (!line) return { ok: false, message: "Línea de conteo no encontrada." };
    const extra = line.physical - line.system;
    if (extra <= 0) return { ok: false, message: "Esta línea no es un sobrante." };

    const [already] = await tx
      .select({ id: nutraceuticalStockMovements.id })
      .from(nutraceuticalStockMovements)
      .where(eq(nutraceuticalStockMovements.countLineId, input.countLineId))
      .limit(1);
    if (already) return { ok: false, message: "Este sobrante ya se resolvió." };

    // DESDE LA MIGRACION 0121 el movimiento va contra una UBICACION y un LOTE. El sobrante es producto
    // que aparecio de mas en la vitrina del Integrante, asi que la ubicacion es la suya; el lote, el que
    // la linea de conteo declaro, y si no, el que vence antes de ese producto ahi (FEFO, el mismo criterio
    // con el que se entrega). Sin lote no se resuelve: un sobrante contra un lote inventado seria peor que
    // un sobrante sin resolver.
    const [loc] = await tx
      .select({ id: inventoryLocations.id })
      .from(inventoryLocations)
      .where(eq(inventoryLocations.professionalId, line.professionalId))
      .limit(1);
    if (!loc) return { ok: false, message: "Ese Integrante no tiene ubicación de inventario." };

    const codigo = (line.lote ?? "").trim();
    const [lote] = codigo
      ? await tx
          .select({ id: lots.id })
          .from(lots)
          .where(and(eq(lots.nutraceuticalId, line.nutraceuticalId), eq(lots.code, codigo)))
          .limit(1)
      : await tx
          .select({ id: lots.id })
          .from(lots)
          .where(eq(lots.nutraceuticalId, line.nutraceuticalId))
          .orderBy(lots.expiresOn)
          .limit(1);
    if (!lote) return { ok: false, message: "No hay lote de ese producto contra el cual resolver el sobrante." };

    await tx.insert(nutraceuticalStockMovements).values({
      professionalId: line.professionalId,
      locationId: loc.id,
      lotId: lote.id,
      nutraceuticalId: line.nutraceuticalId,
      delta: extra, // positivo: sube el saldo
      type: "conciliacion",
      reason: input.reason,
      lote: line.lote,
      countLineId: input.countLineId,
      createdBy: input.actorId,
    });
    return { ok: true };
  });
}

// ───────────────────────────────────────────────────────────────────────────────────────────────────
// ABRIRLE EL CONTEO A UN INTEGRANTE, FUERA DEL CALENDARIO (0208)
//
// PARA QUE: el caso que la ventana mensual no cubre. Hay sospecha de una diferencia y hay que contar YA, sin
// esperar al dia 1. Y es tambien la salida de quien se paso su ventana.
//
// EL MOTIVO ES OBLIGATORIO Y SE LE MUESTRA AL INTEGRANTE. No es formalidad: abrirle un conteo es pedirle
// trabajo, y el resultado puede ser un caso de faltante con consecuencia economica. Una peticion sin
// explicacion se lee como una acusacion.
// ───────────────────────────────────────────────────────────────────────────────────────────────────

export class AperturaDeConteoError extends Error {}

export async function abrirElConteo(input: {
  professionalId: string;
  /** Hasta cuando vale (AAAA-MM-DD). */
  hasta: string;
  motivo: string;
  actorId: string;
  actorEmail: string | null;
}): Promise<void> {
  const motivo = input.motivo.trim();
  if (motivo.length < 5) {
    throw new AperturaDeConteoError("Escribe por qué le pides el conteo: el Integrante va a ver esa razón.");
  }

  const [hoy] = await db.execute<{ dia: string }>(
    dsql`select (now() at time zone 'America/Bogota')::date::text as dia`,
  );
  // UNA APERTURA QUE YA VENCIO NO ABRE NADA, y rechazarla es mejor que crearla: una fila que no hace nada deja
  // a admin creyendo que le pidio el conteo y al Integrante sin verlo.
  if (input.hasta < hoy.dia) {
    throw new AperturaDeConteoError("Esa fecha ya pasó. Elige hasta cuándo quieres que pueda contar.");
  }

  await db.transaction(async (tx) => {
    const [fila] = await tx.execute<{ id: string }>(dsql`
      insert into nutraceutical_count_openings (professional_id, valid_until, motivo, opened_by)
      values (${input.professionalId}, ${input.hasta}::date, ${motivo}, ${input.actorId})
      returning id`);

    await recordAudit(tx, {
      event: "conteo.apertura_concedida",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "nutraceutical_count_openings",
      entityId: fila.id,
      payload: { professionalId: input.professionalId, hasta: input.hasta, motivo },
    });
  });
}
