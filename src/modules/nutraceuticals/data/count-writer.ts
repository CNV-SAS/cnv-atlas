import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";

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
      const [inv] = await tx
        .select({ stock: nutraceuticalInventory.stockQuantity })
        .from(nutraceuticalInventory)
        .where(
          and(
            eq(nutraceuticalInventory.professionalId, input.professionalId),
            eq(nutraceuticalInventory.nutraceuticalId, line.nutraceuticalId),
          ),
        );
      const systemQty = inv?.stock ?? 0;

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

    await tx.insert(nutraceuticalStockMovements).values({
      professionalId: line.professionalId,
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
