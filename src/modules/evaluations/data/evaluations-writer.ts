import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { evaluations, patientConsents, patientProfiles } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import { checkConsentBranchConsistency } from "../services/consent-branch-check";

// Escritura de la confirmacion de identidad. Drizzle (owner) para poder dejar el
// audit INLINE en la misma transaccion (regla dura 8). La autorizacion (que el
// profesional sea de ese paciente) se verifica antes, en el action, leyendo la
// evaluacion bajo RLS.

// Discrepancia entre la fecha de nacimiento real y la rama de consentimiento usada
// (DELTA2 B3). El action la mapea a un mensaje para el profesional; la confirmacion no
// procede hasta resolverla (rehacer el consentimiento con la rama correcta).
export class ConsentBranchMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsentBranchMismatchError";
  }
}

export type ConfirmIdentityInput = {
  evaluationId: string;
  patientId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Pasa la evaluacion de draft a in_progress y audita evaluation.identity_confirmed.
// El guard status='draft' hace la operacion idempotente: una segunda confirmacion no
// vuelve a auditar.
export async function confirmEvaluationIdentity(
  input: ConfirmIdentityInput,
): Promise<{ confirmed: boolean }> {
  return db.transaction(async (tx) => {
    // Segundo muro (DELTA2 B3): la rama de consentimiento usada debe ser consistente
    // con la fecha de nacimiento real. Se lee dentro de la transaccion para una vista
    // consistente. La rama menor se detecta por un consentimiento representante_legal
    // vigente.
    const [profile] = await tx
      .select({ birthDate: patientProfiles.birthDate })
      .from(patientProfiles)
      .where(eq(patientProfiles.patientId, input.patientId));
    const rep = await tx
      .select({ id: patientConsents.id })
      .from(patientConsents)
      .where(
        and(
          eq(patientConsents.patientId, input.patientId),
          eq(patientConsents.consentType, "representante_legal"),
          isNull(patientConsents.revokedAt),
        ),
      )
      .limit(1);
    const check = checkConsentBranchConsistency({
      birthDate: profile?.birthDate ?? null,
      usedMinorBranch: rep.length > 0,
      now: new Date(),
    });
    if (!check.ok) throw new ConsentBranchMismatchError(check.message);

    const updated = await tx
      .update(evaluations)
      .set({ status: "in_progress" })
      .where(
        and(eq(evaluations.id, input.evaluationId), eq(evaluations.status, "draft")),
      )
      .returning({ id: evaluations.id });
    if (updated.length === 0) return { confirmed: false };

    await recordAudit(tx, {
      event: "evaluation.identity_confirmed",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "evaluation",
      entityId: input.evaluationId,
      payload: { patient_id: input.patientId },
      ip: input.ip,
    });
    return { confirmed: true };
  });
}

export type AbandonEvaluationInput = {
  evaluationId: string;
  patientId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Cierra un shell firmado sin responder: 'awaiting_survey' -> 'abandoned' + audita evaluation.abandoned.
// El guard status='awaiting_survey' en el WHERE lo hace idempotente y SEGURO: nunca toca una evaluacion
// que ya tiene respuestas (draft/in_progress/completed) ni una ya cerrada. NO se borra nada: el
// consentimiento firmado, sus grants y el audit se conservan; solo cambia el estado de la evaluacion. No
// es reversible a proposito (reabrir reviviria el resume_token que queremos muerto); si el paciente
// vuelve, empieza una evaluacion nueva (re-firmar es barato, el consentimiento ya existe).
export async function abandonAwaitingEvaluation(
  input: AbandonEvaluationInput,
): Promise<{ closed: boolean }> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(evaluations)
      .set({ status: "abandoned" })
      .where(
        and(eq(evaluations.id, input.evaluationId), eq(evaluations.status, "awaiting_survey")),
      )
      .returning({ id: evaluations.id });
    if (updated.length === 0) return { closed: false };

    await recordAudit(tx, {
      event: "evaluation.abandoned",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "evaluation",
      entityId: input.evaluationId,
      payload: { patient_id: input.patientId },
      ip: input.ip,
    });
    return { closed: true };
  });
}

export type ResolveIdentityConflictInput = {
  evaluationId: string;
  patientId: string;
  decision: "same" | "different";
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Resuelve un conflicto de identidad (documento coincide, nombre difiere). El guard identity_conflict=true
// en el WHERE lo hace idempotente y evita resolver una que no esta en conflicto; funciona tanto en
// 'awaiting_survey' como en 'draft' (el conflicto puede resolverse antes o despues de completar).
//   - 'same' (es la misma persona): limpia el flag; la evaluacion sigue el flujo normal (confirmar -> in_progress).
//   - 'different' (no es la misma): pasa a 'abandoned'; el dato no se sella en el paciente equivocado.
// La decision queda en el audit CON los nombres declarado y registrado: alguien decidio que dos nombres
// distintos son (o no) la misma persona, y esa decision merece rastro (regla 8, inline).
export async function resolveIdentityConflict(
  input: ResolveIdentityConflictInput,
): Promise<{ resolved: boolean }> {
  return db.transaction(async (tx) => {
    const set =
      input.decision === "same"
        ? { identityConflict: false }
        : { identityConflict: false, status: "abandoned" as const };
    const [row] = await tx
      .update(evaluations)
      .set(set)
      .where(and(eq(evaluations.id, input.evaluationId), eq(evaluations.identityConflict, true)))
      .returning({
        declaredFirstName: evaluations.declaredFirstName,
        declaredLastName: evaluations.declaredLastName,
      });
    if (!row) return { resolved: false };

    // Nombre registrado (para el rastro completo declarado-vs-registrado).
    const [profile] = await tx
      .select({ firstName: patientProfiles.firstName, lastName: patientProfiles.lastName })
      .from(patientProfiles)
      .where(eq(patientProfiles.patientId, input.patientId));

    await recordAudit(tx, {
      event:
        input.decision === "same"
          ? "evaluation.identity_conflict_confirmed"
          : "evaluation.identity_conflict_rejected",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "evaluation",
      entityId: input.evaluationId,
      payload: {
        patient_id: input.patientId,
        declared_name: `${row.declaredFirstName ?? ""} ${row.declaredLastName ?? ""}`.trim(),
        registered_name: `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim(),
        decision: input.decision,
      },
      ip: input.ip,
    });
    return { resolved: true };
  });
}

export type CloseEvaluationInput = {
  evaluationId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// CIERRE de la consulta: in_progress -> completed, con quien y cuando. Es el acto que faltaba: nadie ponia
// 'completed' y la ficha del paciente mostraba todas las consultas como abiertas.
//
// No exige que no haya pendientes A PROPOSITO: cerrar con cosas pendientes es una decision legitima del
// profesional (el paciente se lo piensa, la remision depende de otro). La lista se le muestra antes; no se
// le impone.
export async function closeEvaluation(input: CloseEvaluationInput): Promise<{ closed: boolean }> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(evaluations)
      .set({ status: "completed", closedAt: sql`now()`, closedBy: input.actorId })
      .where(and(eq(evaluations.id, input.evaluationId), eq(evaluations.status, "in_progress")))
      .returning({ id: evaluations.id });
    if (updated.length === 0) return { closed: false };
    await recordAudit(tx, {
      event: "evaluation.closed",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "evaluation",
      entityId: input.evaluationId,
      ip: input.ip,
    });
    return { closed: true };
  });
}

// REAPERTURA: completed -> in_progress. Cerrar es contabilidad de la consulta, no un sello clinico, asi
// que no puede ser una puerta que se traba: `in_progress` es lo que habilita importar un BIS, correr el
// pipeline y editar la encuesta, y si hay que volver a tocar algo el cierre no debe impedirlo. Los sellos
// de verdad (diagnostico confirmado, protocolo aprobado, reporte enviado) son inmutables y NO se tocan
// aqui: reabrir no deshace ninguno.
//
// A diferencia de 'abandoned', que NO es reversible (reabrirla reviviria el resume_token que queremos
// muerto). Aqui no hay token de por medio.
//
// Quien: el mismo que puede cerrar (profesional asignado; la policy la impone el action). Deja su propio
// evento de audit, no borra el del cierre: la historia de la consulta conserva los dos actos.
export async function reopenEvaluation(input: CloseEvaluationInput): Promise<{ reopened: boolean }> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(evaluations)
      .set({ status: "in_progress", closedAt: null, closedBy: null })
      .where(and(eq(evaluations.id, input.evaluationId), eq(evaluations.status, "completed")))
      .returning({ id: evaluations.id });
    if (updated.length === 0) return { reopened: false };
    await recordAudit(tx, {
      event: "evaluation.reopened",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "evaluation",
      entityId: input.evaluationId,
      ip: input.ip,
    });
    return { reopened: true };
  });
}
