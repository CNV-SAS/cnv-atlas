import "server-only";

import { and, eq, gt, isNull, sum } from "drizzle-orm";

import { addBusinessDays } from "@/core/dates/colombia-business-days";
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
// semanal), cuadre o no, y puede ser PARCIAL (solo las lineas que trae el input). Por cada linea con faltante
// (fisico < saldo) abre un caso INDEPENDIENTE (uno por producto, su propio plazo), con el precio SELLADO al
// momento del conteo, ligado a la sesion. El sobrante (fisico > saldo) se registra en la linea, no ajusta el
// saldo en silencio (su resolucion es aparte). El saldo del sistema NO se toca aqui: baja al cerrar el caso.

export type CountLineInput = { nutraceuticalId: string; lote: string | null; physicalQty: number };

export type CountResult = {
  sessionId: string;
  opened: { nutraceuticalId: string; quantity: number; sealedTotal: string }[];
  sobrantes: { nutraceuticalId: string; extra: number }[];
  cuadraron: number;
};

export async function recordCount(input: {
  professionalId: string;
  actorId: string;
  note: string | null;
  lines: CountLineInput[];
  now: Date;
}): Promise<CountResult> {
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
        // Faltante: abre un caso con el precio de venta SELLADO ahora (Clausula 5.4).
        const [prod] = await tx
          .select({ price: nutraceuticals.unitPrice })
          .from(nutraceuticals)
          .where(eq(nutraceuticals.id, line.nutraceuticalId));
        const unitPrice = prod?.price ?? "0";
        const quantity = -diff;
        const sealedTotal = (Number(unitPrice) * quantity).toString();
        const [c] = await tx
          .insert(nutraceuticalFaltanteCases)
          .values({
            professionalId: input.professionalId,
            nutraceuticalId: line.nutraceuticalId,
            lote: line.lote,
            quantity,
            sealedUnitPrice: unitPrice,
            sealedTotal,
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
        opened.push({ nutraceuticalId: line.nutraceuticalId, quantity, sealedTotal });
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
