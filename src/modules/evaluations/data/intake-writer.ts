import "server-only";

import { randomBytes } from "node:crypto";

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

// Escritura del intake de la encuesta. Drizzle conecta como owner (BYPASSA RLS) a proposito: el paciente
// no tiene sesion y el intake es un caso legitimo de escritura mediada por el sistema (SECURITY.md).
//
// Reorganizacion del intake (2026-08-10): el flujo se parte en dos fases persistidas. La FIRMA
// (`signIntakeEvaluation`: paciente + consentimientos + gate + evaluacion shell 'awaiting_survey' +
// resume_token) va PRIMERO; las RESPUESTAS (`writeSurveyAnswers`) van despues. Asi todo lo recolectado
// esta autorizado (base legal: la Ley 1581 exige autorizacion previa). `writeIntakeEvaluation` (el flujo
// atomico viejo, todo junto) se conserva hasta que el servicio migre a las dos fases (checkpoint 2).

// Falla del gate (regla dura 15): faltan autorizaciones necesarias vigentes. El servicio la mapea a un
// error de autorizacion; nunca se crea la evaluacion.
export class ConsentGateError extends Error {
  constructor(public readonly missing: ConsentType[]) {
    super(`Faltan autorizaciones necesarias: ${missing.join(", ")}`);
    this.name = "ConsentGateError";
  }
}

// El resume_token es una CREDENCIAL: autentica la escritura de respuestas de la fase 2 (sin sesion) y la
// reanudacion. Se trata como el token del enlace: 256 bits de aleatoriedad, imposible de adivinar, y
// NUNCA se registra en logs (viaja en el retorno y se guarda; no se imprime).
function generateResumeToken(): string {
  return randomBytes(32).toString("base64url");
}

// Un consentimiento otorgado a persistir. El document_hash y la version los fija el servicio desde el
// texto canonico vigente; aqui solo se guardan. En la rama menor (DELTA2 B4) el servicio agrega los
// tipos derivados representante_legal (con los datos del representante) y asentimiento_menor.
export type IntakeConsent = {
  type: ConsentType | "representante_legal" | "asentimiento_menor" | "aceptacion_medio_electronico";
  consentVersion: string;
  documentHash: string;
  legalRepresentative?: {
    name: string;
    document: string;
    relationship: string;
    email: string;
  };
};

// Metadata del acto de firma (nunca el codigo). Se registra en el audit consent.signed (regla 8).
export type IntakeSignature = {
  channel: string;
  maskedDestination: string;
  sentAt: number;
  validatedAt: number;
} | null;

// Tipo de la transaccion derivado de db.transaction (evita `any` y se mantiene con la version de Drizzle).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Base compartida por firmar (nuevo) y el flujo atomico viejo: crea/resuelve el paciente, persiste los
// consentimientos con su auditoria, y aplica el GATE de la regla 15. Devuelve el patientId. NO crea la
// evaluacion ni consume el link (eso lo decide cada caller).
async function writePatientConsentsAndGate(
  tx: Tx,
  input: {
    organizationId: string;
    professionalId: string;
    mode: EvaluationType;
    patientId: string | null;
    identity: IntakeIdentity;
    consents: IntakeConsent[];
    signature?: IntakeSignature;
    ipAddress: string | null;
  },
): Promise<string> {
  // 1. Paciente. Orden de insercion (restriccion de B1): primero patients, luego la relacion (la RLS
  //    is_patient_professional la consulta), y solo despues profiles/contacts/consents.
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
    await tx
      .insert(patientProfessionalRelationships)
      .values({ patientId, professionalId: input.professionalId })
      .onConflictDoNothing();
  }
  if (!patientId) throw new Error("intake-writer: patientId no resuelto");

  // 2. Consentimientos. Re-consentir revoca primero la autorizacion activa del mismo tipo y luego
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
        legalRepresentativeName: c.legalRepresentative?.name ?? null,
        legalRepresentativeDocument: c.legalRepresentative?.document ?? null,
        legalRepresentativeRelationship: c.legalRepresentative?.relationship ?? null,
        legalRepresentativeEmail: c.legalRepresentative?.email ?? null,
      })),
    );

    // Rama menor (B7): la AUTORIZACION (con firma) y el ASENTIMIENTO (sin firma; el menor no verifico
    // codigo) son actos distintos y se auditan por separado.
    const isMinor = grantedTypes.includes("representante_legal");
    const assentGranted = grantedTypes.includes("asentimiento_menor");
    const consentVersion = input.consents[0].consentVersion;

    await recordAudit(tx, {
      event: "consent.signed",
      actorId: null,
      actorEmail: null,
      entityType: "patient",
      entityId: patientId,
      payload: {
        types: grantedTypes.filter((t) => t !== "asentimiento_menor"),
        version: consentVersion,
        signer: isMinor ? "representante_legal" : "titular",
        age_branch: isMinor ? "menor" : "mayor",
        signature: input.signature
          ? {
              channel: input.signature.channel,
              masked_destination: input.signature.maskedDestination,
              sent_at: input.signature.sentAt,
              validated_at: input.signature.validatedAt,
            }
          : undefined,
      },
      ip: input.ipAddress,
    });

    if (assentGranted) {
      await recordAudit(tx, {
        event: "consent.minor_assent",
        actorId: null,
        actorEmail: null,
        entityType: "patient",
        entityId: patientId,
        payload: { version: consentVersion },
        ip: input.ipAddress,
      });
    }
  }

  // 3. GATE (regla dura 15) ANTES de crear la evaluacion. Se lee el estado real de autorizaciones
  //    vigentes del paciente (no se confia en la entrada) y se exigen las necesarias. Si faltan, se
  //    lanza y la transaccion entera se revierte: sin consentimiento firmado no se crea nada.
  const active = await tx
    .select({ type: patientConsents.consentType })
    .from(patientConsents)
    .where(and(eq(patientConsents.patientId, patientId), isNull(patientConsents.revokedAt)));
  const gate = canCreateEvaluation(active.map((r) => r.type as ConsentType));
  if (!gate.ok) throw new ConsentGateError(gate.missing);

  return patientId;
}

// Consume el link de seguimiento (un solo uso). Los links iniciales no se consumen (linkId null).
async function consumeLink(tx: Tx, linkId: string | null): Promise<void> {
  if (!linkId) return;
  await tx
    .update(surveyLinks)
    .set({ consumedAt: sql`now()` })
    .where(and(eq(surveyLinks.id, linkId), isNull(surveyLinks.consumedAt)));
}

// ── FASE 1: FIRMAR ────────────────────────────────────────────────────────────────────────────────
// Crea paciente + consentimientos (gate regla 15) + evaluacion SHELL en estado 'awaiting_survey', con un
// resume_token para la fase 2. NO crea survey_responses (asi run-pipeline aborta limpio ante una
// evaluacion sin respuestas; una fila vacia habria sellado un diagnostico degradado). Consume el link.

export type SignIntakeInput = {
  organizationId: string;
  professionalId: string;
  mode: EvaluationType;
  patientId: string | null;
  identity: IntakeIdentity;
  consents: IntakeConsent[];
  linkId: string | null;
  ipAddress: string | null;
  signature?: IntakeSignature;
};

export type SignIntakeResult = { evaluationId: string; patientId: string; resumeToken: string };

export async function signIntakeEvaluation(input: SignIntakeInput): Promise<SignIntakeResult> {
  return db.transaction(async (tx) => {
    const patientId = await writePatientConsentsAndGate(tx, input);

    const resumeToken = generateResumeToken();
    const [evaluation] = await tx
      .insert(evaluations)
      .values({
        patientId,
        professionalId: input.professionalId,
        organizationId: input.organizationId,
        type: input.mode,
        status: "awaiting_survey",
        resumeToken,
      })
      .returning({ id: evaluations.id });
    await recordAudit(tx, {
      event: "evaluation.signed",
      actorId: null,
      actorEmail: null,
      entityType: "evaluation",
      entityId: evaluation.id,
      payload: { mode: input.mode, patient_id: patientId, status: "awaiting_survey" },
      ip: input.ipAddress,
    });

    await consumeLink(tx, input.linkId);

    return { evaluationId: evaluation.id, patientId, resumeToken };
  });
}

// ── FASE 2: RESPUESTAS ────────────────────────────────────────────────────────────────────────────
// Autenticada por el resume_token: solo escribe si existe una evaluacion en 'awaiting_survey' con ese
// token (una evaluacion firmada, esperando su encuesta). Crea la fila survey_responses + las answers y
// pasa el estado a 'draft' (ya es una evaluacion normal, confirmable y diagnosticable).

export class ResumeTokenError extends Error {
  constructor() {
    super("Token de reanudacion invalido o la encuesta ya fue completada.");
    this.name = "ResumeTokenError";
  }
}

export type WriteSurveyAnswersInput = {
  resumeToken: string;
  surveyVersionId: string;
  answers: { questionId: string; answerValue: string }[];
  ipAddress: string | null;
};

export type WriteSurveyAnswersResult = { evaluationId: string };

export async function writeSurveyAnswers(
  input: WriteSurveyAnswersInput,
): Promise<WriteSurveyAnswersResult> {
  return db.transaction(async (tx) => {
    // El token vale SOLO mientras la evaluacion espera su encuesta. Al completarla pasa a 'draft' y el
    // token deja de habilitar (no abre una evaluacion firmada "para siempre").
    const [evaluation] = await tx
      .select({ id: evaluations.id })
      .from(evaluations)
      .where(
        and(
          eq(evaluations.resumeToken, input.resumeToken),
          eq(evaluations.status, "awaiting_survey"),
        ),
      )
      .limit(1);
    if (!evaluation) throw new ResumeTokenError();

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

    await tx
      .update(evaluations)
      .set({ status: "draft" })
      .where(eq(evaluations.id, evaluation.id));
    await recordAudit(tx, {
      event: "evaluation.survey_submitted",
      actorId: null,
      actorEmail: null,
      entityType: "evaluation",
      entityId: evaluation.id,
      payload: { answers: input.answers.length },
      ip: input.ipAddress,
    });

    return { evaluationId: evaluation.id };
  });
}

// ── FLUJO ATOMICO VIEJO (todo junto) ──────────────────────────────────────────────────────────────
// Se conserva hasta que el servicio migre a las dos fases (checkpoint 2). Ahora reusa el helper para no
// duplicar la logica de paciente/consentimientos/gate.

export type IntakeWriteInput = {
  organizationId: string;
  professionalId: string;
  mode: EvaluationType;
  patientId: string | null;
  identity: IntakeIdentity;
  consents: IntakeConsent[];
  surveyVersionId: string;
  answers: { questionId: string; answerValue: string }[];
  linkId: string | null;
  ipAddress: string | null;
  signature?: IntakeSignature;
};

export type IntakeWriteResult = { evaluationId: string; patientId: string };

export async function writeIntakeEvaluation(
  input: IntakeWriteInput,
): Promise<IntakeWriteResult> {
  return db.transaction(async (tx) => {
    const patientId = await writePatientConsentsAndGate(tx, input);

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

    await consumeLink(tx, input.linkId);

    return { evaluationId: evaluation.id, patientId };
  });
}
