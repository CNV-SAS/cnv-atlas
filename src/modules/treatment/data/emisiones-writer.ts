import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { diagnoses, prescriptionEmissions, treatments } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import { TreatmentStateError } from "./treatment-writer";

// REGISTRA UNA EMISION DE LA PRESCRIPCION: la copia inmutable de lo que salio hacia el paciente.
//
// LO QUE ESTE ARCHIVO SUSTITUYE, y por que no es lo mismo con otro nombre. `writeApproveProtocol` sellaba
// Y CERRABA: ponia `status='approved'` y a partir de ahi el trigger 0026 congelaba la prescripcion entera.
// Aqui solo se ESCRIBE la copia. La prescripcion sigue abierta, editable, sin reapertura ni motivo.
//
// Y ESO NO AFLOJA NADA, porque lo que se protegia era otra cosa: el plan impreso, el del correo y la
// historia clinica se arman del protocolo VIVO, asi que el congelado era lo unico que impedia que un
// documento de agosto dijera lo que los ajustes digan hoy. Con la copia, el documento no depende del
// estado vivo y el congelado deja de hacer falta.
//
// APPEND-ONLY, y lo impone la base (trigger de la 0115), no este archivo: una fila editable no prueba nada.

export type EmisionWrite = {
  treatmentId: string;
  /** La prescripcion efectiva tal como salio. Misma forma que el antiguo `protocol_approved`. */
  prescripcion: unknown;
  kcalObjetivo: number;
  proteinaGramos: number;
  /** Por donde salio. `anterior` es solo del backfill: no se emite con esa via. */
  via: "impresa" | "correo";
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export async function writeEmisionPrescripcion(input: EmisionWrite): Promise<{ emisionId: string }> {
  return await db.transaction(async (tx) => {
    // LA EVALUACION SE RESUELVE DENTRO DE LA TRANSACCION, no se recibe. Se guarda en la fila para que los
    // documentos clinicos la lean sin encadenar tres joins, y un id recibido de fuera podria no ser el de
    // este tratamiento: entonces la emision quedaria colgada de una consulta ajena.
    const [row] = await tx
      .select({ evaluationId: diagnoses.evaluationId, suggested: treatments.protocolSuggested })
      .from(treatments)
      .innerJoin(diagnoses, eq(diagnoses.id, treatments.diagnosisId))
      .where(eq(treatments.id, input.treatmentId))
      .limit(1);
    if (!row) throw new TreatmentStateError("Tratamiento no encontrado.");
    if (row.suggested == null) {
      // Sin salida del motor no hay prescripcion que emitir. El gate esta aqui, dentro de la transaccion,
      // y no solo en la pantalla: un boton oculto no es un candado.
      throw new TreatmentStateError(
        "No se puede emitir una prescripción que nunca se computó (protocol_suggested nulo).",
      );
    }

    const [emision] = await tx
      .insert(prescriptionEmissions)
      .values({
        treatmentId: input.treatmentId,
        evaluationId: row.evaluationId,
        prescripcion: input.prescripcion,
        kcalObjetivo: input.kcalObjetivo,
        proteinaG: input.proteinaGramos,
        via: input.via,
        emittedBy: input.actorId,
        emittedByEmail: input.actorEmail,
      })
      .returning({ id: prescriptionEmissions.id });

    // Inline en la transaccion, nunca por el bus (regla dura 8): emitir una prescripcion es el momento en
    // que un plan sale de la clinica hacia una persona.
    await recordAudit(tx, {
      event: "prescription.emitted",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: input.treatmentId,
      payload: {
        emission_id: emision.id,
        via: input.via,
        kcal_objetivo: input.kcalObjetivo,
        proteina_g: input.proteinaGramos,
      },
      ip: input.ip,
    });

    return { emisionId: emision.id };
  });
}
