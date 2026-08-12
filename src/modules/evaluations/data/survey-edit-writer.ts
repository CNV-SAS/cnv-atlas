import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { diagnoses, evaluations, professionalProfiles, surveyAnswers, surveyResponses } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// Edicion de la encuesta del paciente por el PROFESIONAL, ANTES del diagnostico (a). El paciente pudo
// dejarla incompleta; el profesional la revisa y la completa en consulta. Pre-diagnostico NO hay
// versionado (nada esta sellado): se reescribe el snapshot de respuestas directamente. Distinto del
// flujo de CORRECCION, que es POST-diagnostico y crea una version nueva.

export type SurveyEditResult =
  | { ok: true; answered: number }
  | { ok: false; reason: "not_assigned" | "already_diagnosed" | "not_editable" };

// Solo pre-diagnostico. awaiting_survey queda fuera a proposito: ahi el paciente aun puede llenar por su
// enlace (token de reanudacion vivo); tocarlo colisiona con ese flujo. Se edita tras enviar (draft) o
// tras confirmar identidad (in_progress).
const EDITABLE_STATUSES = new Set(["draft", "in_progress"]);

export async function saveSurveyEdit(input: {
  evaluationId: string;
  actorId: string;
  actorEmail: string;
  answers: { questionId: string; answerValue: string }[];
  ip: string | null;
}): Promise<SurveyEditResult> {
  return db.transaction(async (tx) => {
    // Bloquea la fila de la evaluacion (FOR UPDATE): si el diagnostico se genera en paralelo en otra
    // pestana, esta edicion ve el estado ya cambiado y se rechaza (mismo espiritu que el candado del
    // protocolo). Acto sobre lo que respondio el paciente: se audita inline (regla 8).
    const [ev] = await tx
      .select({ professionalId: evaluations.professionalId, status: evaluations.status })
      .from(evaluations)
      .where(eq(evaluations.id, input.evaluationId))
      .for("update")
      .limit(1);
    if (!ev) return { ok: false, reason: "not_editable" };

    // Solo el profesional asignado (regla 3). El writer va por el owner (no lo cubre la RLS), asi que
    // el chequeo es explicito, como en correctEvaluation.
    const [prof] = await tx
      .select({ id: professionalProfiles.id })
      .from(professionalProfiles)
      .where(eq(professionalProfiles.profileId, input.actorId))
      .limit(1);
    if (!prof || prof.id !== ev.professionalId) return { ok: false, reason: "not_assigned" };

    // Si YA hay diagnostico, esta via no aplica: editar una respuesta sellada es el flujo de correccion
    // (versionado). Guard explicito ademas del estado, y con la fila bloqueada no hay TOCTOU con el pipeline.
    const diag = await tx
      .select({ id: diagnoses.id })
      .from(diagnoses)
      .where(eq(diagnoses.evaluationId, input.evaluationId))
      .limit(1);
    if (diag.length > 0) return { ok: false, reason: "already_diagnosed" };
    if (!EDITABLE_STATUSES.has(ev.status)) return { ok: false, reason: "not_editable" };

    // La respuesta existe pre-diagnostico en draft/in_progress (el paciente envio, aunque sea a medias).
    const [response] = await tx
      .select({ id: surveyResponses.id })
      .from(surveyResponses)
      .where(eq(surveyResponses.evaluationId, input.evaluationId))
      .limit(1);
    if (!response) return { ok: false, reason: "not_editable" };

    // Reemplaza el snapshot completo (el form manda todo lo contestado; lo ausente = sin responder).
    await tx.delete(surveyAnswers).where(eq(surveyAnswers.responseId, response.id));
    if (input.answers.length > 0) {
      await tx.insert(surveyAnswers).values(
        input.answers.map((a) => ({ responseId: response.id, questionId: a.questionId, answerValue: a.answerValue })),
      );
    }

    // Audit: el PROFESIONAL edito la encuesta. Evento DISTINTO de evaluation.survey_submitted (actorId
    // null = paciente): asi la traza distingue lo que respondio el paciente de lo que completo el
    // profesional en consulta. La distincion por-respuesta (que campo lleno cada quien) exigiria una
    // columna de origen en survey_answers (migracion); registrada como opcion en BACKLOG.
    await recordAudit(tx, {
      event: "evaluation.survey_edited",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "evaluation",
      entityId: input.evaluationId,
      payload: { answered: input.answers.length },
      ip: input.ip,
    });
    return { ok: true, answered: input.answers.length };
  });
}
