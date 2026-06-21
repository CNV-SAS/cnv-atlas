import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  evaluations,
  patientConsents,
  patientContacts,
  patientProfessionalRelationships,
  patientProfiles,
  patients,
  surveyAnswers,
  surveyLinks,
  surveyResponses,
} from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";
import type { ConsentType } from "@/modules/consent/validations";

import { canCreateEvaluation } from "../policies/can-create-evaluation";
import type { EvaluationType, IntakeIdentity } from "../types";

// Escritura del intake de la encuesta en UNA transaccion de BD. Drizzle conecta como
// owner (BYPASSA RLS) a proposito: el paciente no tiene sesion y el intake es un caso
// legitimo de escritura mediada por el sistema (SECURITY.md). Todo va junto: si algo
// falla (incluido el gate de consentimiento), no queda nada a medias.

// Falla del gate (regla dura 15): faltan autorizaciones necesarias vigentes. El
// servicio la mapea a un error de autorizacion; nunca se crea la evaluacion.
export class ConsentGateError extends Error {
  constructor(public readonly missing: ConsentType[]) {
    super(`Faltan autorizaciones necesarias: ${missing.join(", ")}`);
    this.name = "ConsentGateError";
  }
}

// Un consentimiento otorgado a persistir. El document_hash y la version los fija el
// servicio desde el texto canonico vigente; aqui solo se guardan.
export type IntakeConsent = {
  type: ConsentType;
  consentVersion: string;
  documentHash: string;
};

export type IntakeWriteInput = {
  organizationId: string;
  professionalId: string;
  mode: EvaluationType; // 'inicial' crea paciente; 'seguimiento' reusa patientId
  patientId: string | null; // seguimiento: el paciente del match exacto
  identity: IntakeIdentity;
  consents: IntakeConsent[];
  surveyVersionId: string;
  answers: { questionId: string; answerValue: string }[];
  linkId: string | null; // si vino de un link de seguimiento, para consumirlo
  ipAddress: string | null;
};

export type IntakeWriteResult = { evaluationId: string; patientId: string };

export async function writeIntakeEvaluation(
  input: IntakeWriteInput,
): Promise<IntakeWriteResult> {
  return db.transaction(async (tx) => {
    // 1. Paciente. Orden de insercion (restriccion de B1): primero patients, luego
    //    patient_professional_relationships, y solo despues profiles/contacts/
    //    consents. La RLS is_patient_professional consulta la relacion, asi que esta
    //    debe existir antes que el resto del perfil del paciente.
    let patientId = input.patientId;
    if (input.mode === "inicial") {
      const [created] = await tx
        .insert(patients)
        .values({
          organizationId: input.organizationId,
          documentType: input.identity.documentType,
          documentNumber: input.identity.documentNumber,
        })
        .returning({ id: patients.id });
      patientId = created.id;
      await recordAudit(tx, {
        event: "patient.created",
        actorId: null,
        actorEmail: null,
        entityType: "patient",
        entityId: patientId,
        ip: input.ipAddress,
      });
      // Relacion ANTES del perfil/contactos/consentimientos (ver orden arriba).
      await tx
        .insert(patientProfessionalRelationships)
        .values({ patientId, professionalId: input.professionalId })
        .onConflictDoNothing();
      await tx.insert(patientProfiles).values({
        patientId,
        firstName: input.identity.firstName,
        lastName: input.identity.lastName,
        birthDate: input.identity.birthDate,
        sex: input.identity.sex,
        country: input.identity.country,
        city: input.identity.city,
      });
      await tx.insert(patientContacts).values({
        patientId,
        email: input.identity.email,
        phone: input.identity.phone,
      });
    } else {
      if (!patientId) throw new Error("intake-writer: seguimiento sin patientId");
      // Asegura la relacion con este profesional (idempotente).
      await tx
        .insert(patientProfessionalRelationships)
        .values({ patientId, professionalId: input.professionalId })
        .onConflictDoNothing();
    }
    if (!patientId) throw new Error("intake-writer: patientId no resuelto");

    // 2. Consentimientos. Re-consentir revoca primero la autorizacion activa del
    //    mismo tipo (DATABASE.md: indice parcial de una sola activa por tipo) y luego
    //    inserta la nueva, todo en esta transaccion.
    if (input.consents.length > 0) {
      const grantedTypes = input.consents.map((c) => c.type);
      await tx
        .update(patientConsents)
        .set({ revokedAt: sql`now()` })
        .where(
          and(
            eq(patientConsents.patientId, patientId),
            isNull(patientConsents.revokedAt),
            inArray(patientConsents.consentType, grantedTypes),
          ),
        );
      await tx.insert(patientConsents).values(
        input.consents.map((c) => ({
          patientId,
          consentType: c.type,
          consentVersion: c.consentVersion,
          documentHash: c.documentHash,
        })),
      );
      await recordAudit(tx, {
        event: "consent.signed",
        actorId: null,
        actorEmail: null,
        entityType: "patient",
        entityId: patientId,
        payload: { types: grantedTypes, version: input.consents[0].consentVersion },
        ip: input.ipAddress,
      });
    }

    // 3. GATE (regla dura 15) ANTES de crear la evaluacion. Se lee el estado real de
    //    autorizaciones vigentes del paciente (no se confia en la entrada) y se exigen
    //    las 3 necesarias. Si faltan, se lanza y la transaccion entera se revierte.
    const active = await tx
      .select({ type: patientConsents.consentType })
      .from(patientConsents)
      .where(
        and(eq(patientConsents.patientId, patientId), isNull(patientConsents.revokedAt)),
      );
    const gate = canCreateEvaluation(active.map((r) => r.type as ConsentType));
    if (!gate.ok) throw new ConsentGateError(gate.missing);

    // 4. Evaluacion (draft; el profesional confirma identidad aguas abajo).
    const [evaluation] = await tx
      .insert(evaluations)
      .values({
        patientId,
        professionalId: input.professionalId,
        organizationId: input.organizationId,
        type: input.mode,
        status: "draft",
      })
      .returning({ id: evaluations.id });
    await recordAudit(tx, {
      event: "evaluation.created",
      actorId: null,
      actorEmail: null,
      entityType: "evaluation",
      entityId: evaluation.id,
      payload: { mode: input.mode, patient_id: patientId },
      ip: input.ipAddress,
    });

    // 5. Respuestas de la encuesta (recoleccion pura, sin scoring).
    const [response] = await tx
      .insert(surveyResponses)
      .values({
        evaluationId: evaluation.id,
        surveyVersionId: input.surveyVersionId,
        ipAddress: input.ipAddress,
      })
      .returning({ id: surveyResponses.id });
    if (input.answers.length > 0) {
      await tx.insert(surveyAnswers).values(
        input.answers.map((a) => ({
          responseId: response.id,
          questionId: a.questionId,
          answerValue: a.answerValue,
        })),
      );
    }

    // 6. Consumir el link de seguimiento (un solo uso). Los links iniciales no se
    //    consumen (linkId null para ese caso).
    if (input.linkId) {
      await tx
        .update(surveyLinks)
        .set({ consumedAt: sql`now()` })
        .where(and(eq(surveyLinks.id, input.linkId), isNull(surveyLinks.consumedAt)));
    }

    return { evaluationId: evaluation.id, patientId };
  });
}
