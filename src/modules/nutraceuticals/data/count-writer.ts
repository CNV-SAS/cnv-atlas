import "server-only";

import { and, eq } from "drizzle-orm";

import { addBusinessDays } from "@/core/dates/colombia-business-days";
import { db } from "@/db";
import {
  nutraceuticalCountLines,
  nutraceuticalCountSessions,
  nutraceuticalFaltanteCases,
  nutraceuticalFaltanteTransitions,
  nutraceuticalInventory,
  nutraceuticals,
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
