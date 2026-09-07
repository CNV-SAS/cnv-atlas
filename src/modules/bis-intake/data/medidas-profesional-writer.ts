import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { diagnoses, evaluationBisIntake, evaluations } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import { BisCorrectionError } from "./bis-correction-writer";

// LAS DOS MEDIDAS DEL PROFESIONAL (peso meta y fuerza prensil), EDITADAS EN ANTROPOMETRIA.
//
// POR QUE EXISTE ESTE WRITER, y es el precio que DIV-18 ya tenia puesto. Hasta el 2026-09-07 los dos
// campos se llenaban dentro del formulario de las condiciones de la toma, en un solo guardado, y en
// Antropometria solo se MOSTRABAN. Gildardo lo devolvio dos veces:
//
//   2026-08-30 §6a: "nunca la puse en las condiciones del BIS".
//   Cotejo, punto 4:  "el peso meta se establece al revisar al paciente y sus datos; si lo ponen antes
//                      el profesional NO tiene como acordarse del contexto del paciente. NO puede ir ahi."
//
// La segunda trae la razon que faltaba, y no es de ubicacion sino de SECUENCIA: el peso meta es una
// decision que se toma DESPUES de ver la composicion, no un dato que se recoge antes de medir. Por eso
// DIV-18 se cierra con su respuesta y no al reves.
//
// LO QUE DIV-18 DABA COMO MOTIVO TECNICO SE CAYO AL VERIFICARLO. Decia que un update parcial desde otra
// pantalla podia no encontrar la fila de condiciones y afectar CERO filas, perdiendo el valor en
// silencio. Dos cosas:
//   1. El PESO META no vive en esa tabla: vive en `evaluations` (migracion 0096), y esa fila SIEMPRE
//      existe. Ahi no habia riesgo ninguno.
//   2. La PRENSIL si vive en `evaluation_bis_intake`, pero la app impone el orden: sin las condiciones
//      guardadas no se habilita el import, y Antropometria vive detras del import. Cuando el profesional
//      llega aqui, la fila ya esta.
//
// Y AUN ASI NO SE CONFIA EN ESE ORDEN. Si la fila no estuviera, escribir la prensil afectaria cero filas
// y el campo desapareceria sin decirlo, que es exactamente el hazard del dato que deja de viajar. Se
// comprueba y se FALLA EN VOZ ALTA.

export type MedidasProfesionalInput = {
  evaluationId: string;
  /** null = borrar el valor. undefined = no tocar este campo. */
  weightGoalKg?: number | null;
  gripStrengthKg?: number | null;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export async function writeMedidasDelProfesional(input: MedidasProfesionalInput): Promise<void> {
  return db.transaction(async (tx) => {
    // EL GATE VIVE AQUI, no en la pantalla (un boton oculto no es un candado). Mismo criterio y mismo
    // texto que la correccion de medidas: con el diagnostico emitido, el camino es corregir la
    // evaluacion, que versiona.
    const [diag] = await tx
      .select({ id: diagnoses.id })
      .from(diagnoses)
      .where(eq(diagnoses.evaluationId, input.evaluationId))
      .limit(1);
    if (diag) {
      throw new BisCorrectionError(
        "El diagnóstico ya se generó sobre esta evaluación. Para cambiar estas medidas, usa Corregir la " +
          "evaluación: así queda una versión nueva y no se reescribe lo que ya se emitió.",
      );
    }

    if (input.weightGoalKg !== undefined) {
      const [previo] = await tx
        .select({ pesoMeta: evaluations.weightGoalKg, origen: evaluations.weightGoalSetIn })
        .from(evaluations)
        .where(eq(evaluations.id, input.evaluationId))
        .limit(1);
      if (!previo) throw new BisCorrectionError("Evaluación no encontrada.");
      const anterior = previo.pesoMeta != null ? Number(previo.pesoMeta) : null;
      // LA PROCEDENCIA SOLO CAMBIA SI CAMBIA EL VALOR, igual que en el writer de las condiciones: un
      // re-guardado que no toco el dato no puede afirmar quien lo decidio. Y la procedencia de este
      // camino sigue siendo "entrada": es la consulta, no el ajuste del nutricionista al armar el plan.
      const setIn =
        input.weightGoalKg == null ? null : anterior !== input.weightGoalKg ? "entrada" : (previo.origen ?? "entrada");
      await tx
        .update(evaluations)
        .set({
          weightGoalKg: input.weightGoalKg == null ? null : String(input.weightGoalKg),
          weightGoalSetIn: setIn,
        })
        .where(eq(evaluations.id, input.evaluationId));
    }

    if (input.gripStrengthKg !== undefined) {
      const [intake] = await tx
        .select({ id: evaluationBisIntake.id })
        .from(evaluationBisIntake)
        .where(eq(evaluationBisIntake.evaluationId, input.evaluationId))
        .limit(1);
      // Ver la nota de arriba: sin fila, escribir afectaria cero filas y la prensil se perderia muda.
      if (!intake) {
        throw new BisCorrectionError(
          "Primero guarda las condiciones de la toma (subpestaña Encuesta): la fuerza prensil se registra " +
            "sobre esa captura.",
        );
      }
      await tx
        .update(evaluationBisIntake)
        .set({
          gripStrengthKg: input.gripStrengthKg == null ? null : String(input.gripStrengthKg),
        })
        .where(eq(evaluationBisIntake.evaluationId, input.evaluationId));
    }

    // Audit inline (regla dura 8), sin PII: que campos se tocaron, no el valor ni la persona. La prensil
    // ENTRA AL MOTOR (criterio primario del fenotipo de sarcopenia, EWGSOP2) y el peso meta gobierna toda
    // la cadena calorica, asi que quien los cambia y cuando es informacion clinica, no metadato.
    await recordAudit(tx, {
      event: "bis.medidas_profesional.recorded",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "evaluation",
      entityId: input.evaluationId,
      payload: {
        evaluation_id: input.evaluationId,
        campos: [
          input.weightGoalKg !== undefined ? "peso_meta" : null,
          input.gripStrengthKg !== undefined ? "fuerza_prensil" : null,
        ].filter(Boolean),
        origen: "antropometria",
      },
      ip: input.ip,
    });
  });
}
