import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  diagnoses,
  treatmentDietGuidelines,
  treatmentNotes,
  treatmentNutraceuticals,
  treatments,
} from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// Escritura del protocolo de tratamiento (Drizzle owner, para el audit INLINE, regla 8).
// La autorizacion (ownership) se verifica ANTES en el action leyendo el tratamiento bajo
// RLS (treatment-reader); aqui el treatmentId ya llega autorizado. El gate clinico
// (diagnostico confirmado) se re-chequea dentro de la transaccion: el protocolo no se
// edita sobre un diagnostico sin confirmar (decision de B13).

// Fallo de estado del protocolo (diagnostico sin confirmar, tratamiento ausente). Revierte
// la transaccion entera; el action lo mapea a un mensaje.
export class TreatmentStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TreatmentStateError";
  }
}

type NutraceuticalLine = {
  nutraceuticalId: string;
  dosage: string | null;
  durationDays: number | null;
};

export type SaveProtocolWrite = {
  treatmentId: string;
  kcalObjetivo: number | null;
  proteinaGramos: number | null;
  restricciones: string[];
  nutraceuticals: NutraceuticalLine[];
  guidelines: string[];
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Guarda el protocolo completo en una transaccion: objetivos + reemplazo del set de
// nutraceuticos + reemplazo del set de guias. Un solo audit treatment.protocol_updated.
export async function saveProtocol(input: SaveProtocolWrite): Promise<void> {
  await db.transaction(async (tx) => {
    await assertConfirmedDiagnosis(tx, input.treatmentId);

    // 1. Objetivos del protocolo.
    await tx
      .update(treatments)
      .set({
        kcalObjetivo: input.kcalObjetivo,
        proteinaGramos: input.proteinaGramos,
        restricciones: input.restricciones,
      })
      .where(eq(treatments.id, input.treatmentId));

    // 2. Set de nutraceuticos: reemplazo total (el formulario envia el estado deseado).
    await tx
      .delete(treatmentNutraceuticals)
      .where(eq(treatmentNutraceuticals.treatmentId, input.treatmentId));
    if (input.nutraceuticals.length) {
      await tx.insert(treatmentNutraceuticals).values(
        input.nutraceuticals.map((n) => ({
          treatmentId: input.treatmentId,
          nutraceuticalId: n.nutraceuticalId,
          dosage: n.dosage,
          durationDays: n.durationDays,
        })),
      );
    }

    // 3. Set de guias dietarias: reemplazo total.
    await tx
      .delete(treatmentDietGuidelines)
      .where(eq(treatmentDietGuidelines.treatmentId, input.treatmentId));
    if (input.guidelines.length) {
      await tx.insert(treatmentDietGuidelines).values(
        input.guidelines.map((text) => ({
          treatmentId: input.treatmentId,
          guidelineText: text,
        })),
      );
    }

    await recordAudit(tx, {
      event: "treatment.protocol_updated",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      payload: {
        kcal_objetivo: input.kcalObjetivo,
        proteina_g: input.proteinaGramos,
        restricciones_count: input.restricciones.length,
        nutraceuticals_count: input.nutraceuticals.length,
        guidelines_count: input.guidelines.length,
      },
      ip: input.ip,
    });
  });
}

export type AddNoteWrite = {
  treatmentId: string;
  note: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Agrega una nota clinica al tratamiento (append-only) con audit inline.
export async function addTreatmentNote(input: AddNoteWrite): Promise<void> {
  await db.transaction(async (tx) => {
    await assertConfirmedDiagnosis(tx, input.treatmentId);
    const [note] = await tx
      .insert(treatmentNotes)
      .values({ treatmentId: input.treatmentId, note: input.note })
      .returning({ id: treatmentNotes.id });
    await recordAudit(tx, {
      event: "treatment.note_added",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      payload: { note_id: note.id },
      ip: input.ip,
    });
  });
}

// Gate clinico compartido: el protocolo solo se edita sobre un diagnostico confirmado.
// Une treatment -> diagnosis y verifica confirmed_at. Lanza si falta o no esta confirmado.
async function assertConfirmedDiagnosis(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  treatmentId: string,
): Promise<void> {
  const [row] = await tx
    .select({ confirmedAt: diagnoses.confirmedAt })
    .from(treatments)
    .innerJoin(diagnoses, eq(treatments.diagnosisId, diagnoses.id))
    .where(eq(treatments.id, treatmentId))
    .limit(1);
  if (!row) throw new TreatmentStateError("Tratamiento no encontrado.");
  if (!row.confirmedAt) {
    throw new TreatmentStateError(
      "El diagnostico debe estar confirmado (aprueba el reporte) antes de editar el protocolo.",
    );
  }
}
