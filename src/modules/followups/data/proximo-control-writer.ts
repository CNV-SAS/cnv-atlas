import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { diagnoses, treatments } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// Escritura de la PROXIMA CITA desde Seguimiento. Es el MISMO campo que fija el bloque de "empeoró"
// (treatments.proxima_cita): un paciente no tiene dos proximas citas. Lo que cambia es que ahora se puede
// fijar en un seguimiento NORMAL; antes la unica via era confirmar un empeoramiento, lo cual es absurdo
// para un paciente que mejoro.
//
// La fecha SUGERIDA por la ruta no se guarda sola: llega aqui solo cuando el profesional confirma. Si se
// guardara sola, la regla de Gildardo ("un empeoro no se comunica sin cita agendada") quedaria siempre
// cumplida sin que nadie decidiera, y dejaria de proteger lo que protege.

export class ProximoControlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProximoControlError";
  }
}

export type SaveProximoControlInput = {
  evaluationId: string;
  proximaCita: string; // YYYY-MM-DD
  /** La sugerida por la ruta, para dejar en la traza si el profesional la acepto o la cambio. */
  sugerida: string | null;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export async function saveProximoControl(input: SaveProximoControlInput): Promise<void> {
  await db.transaction(async (tx) => {
    const [diag] = await tx
      .select({ id: diagnoses.id })
      .from(diagnoses)
      .where(eq(diagnoses.evaluationId, input.evaluationId))
      .limit(1);
    if (!diag) {
      throw new ProximoControlError("La evaluación todavía no tiene diagnóstico donde agendar la cita.");
    }
    const [prev] = await tx
      .select({ id: treatments.id, cita: treatments.proximaCita })
      .from(treatments)
      .where(eq(treatments.diagnosisId, diag.id))
      .limit(1);
    if (!prev) {
      throw new ProximoControlError("La evaluación no tiene tratamiento donde agendar la cita.");
    }
    const updated = await tx
      .update(treatments)
      .set({ proximaCita: input.proximaCita })
      .where(and(eq(treatments.id, prev.id), eq(treatments.diagnosisId, diag.id)))
      .returning({ id: treatments.id });
    if (updated.length === 0) throw new ProximoControlError("No se pudo agendar la cita.");

    await recordAudit(tx, {
      event: "treatment.next_appointment_set",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: prev.id,
      // La traza dice si venia de antes y si el profesional acepto la sugerencia o puso otra: sin eso, un
      // "cita agendada" no distingue quien la decidio.
      payload: {
        evaluation_id: input.evaluationId,
        proxima_cita: input.proximaCita,
        cita_previa: prev.cita ?? null,
        sugerida_por_ruta: input.sugerida,
        acepto_sugerida: input.sugerida != null && input.sugerida === input.proximaCita,
      },
      ip: input.ip,
    });
  });
}
