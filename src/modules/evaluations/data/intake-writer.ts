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
import { CONSENT_VERSION } from "@/modules/consent/versions";

import { canCreateEvaluation } from "../policies/can-create-evaluation";
import type { EvaluationType, IntakeIdentity } from "../types";

// Escritura del intake de la encuesta. Drizzle conecta como owner (BYPASSA RLS) a proposito: el paciente
// no tiene sesion y el intake es un caso legitimo de escritura mediada por el sistema (SECURITY.md).
//
// Reorganizacion del intake (2026-08-10): el flujo se parte en dos fases persistidas. La FIRMA
// (`signIntakeEvaluation`: paciente + consentimientos + gate + evaluacion shell 'awaiting_survey' +
// resume_token) va PRIMERO; las RESPUESTAS (`saveSurveyProgress` a medida y `completeSurvey` al final)
// van despues, autenticadas por el resume_token. Asi todo lo recolectado esta autorizado (base legal: la
// Ley 1581 exige autorizacion previa a la recoleccion).

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

// Base de la firma: crea/resuelve el paciente, persiste los consentimientos con su auditoria, y aplica el
// GATE de la regla 15. Devuelve el patientId. NO crea la evaluacion ni consume el link (eso lo decide el
// caller, hoy signIntakeEvaluation).
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
      longestResidenceCity: input.identity.longestResidenceCity,
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
  // Conflicto de identidad (documento coincide, nombre difiere): se marca en el shell y se guarda el
  // nombre DECLARADO para que el profesional resuelva declarado-vs-registrado antes de usar la evaluacion.
  identityConflict?: boolean;
};

export type SignIntakeResult = { evaluationId: string; patientId: string; resumeToken: string };

export async function signIntakeEvaluation(input: SignIntakeInput): Promise<SignIntakeResult> {
  return db.transaction(async (tx) => {
    const patientId = await writePatientConsentsAndGate(tx, input);

    const resumeToken = generateResumeToken();
    const conflict = input.identityConflict === true;
    const [evaluation] = await tx
      .insert(evaluations)
      .values({
        patientId,
        professionalId: input.professionalId,
        organizationId: input.organizationId,
        type: input.mode,
        status: "awaiting_survey",
        // Constancia de consentimiento (dictamen legal 2026-08-20 §4): la version vigente bajo la que se firmo.
        // El gate de regla 15 (writePatientConsentsAndGate, arriba) ya verifico la vigencia ANTES de este insert.
        consentVersion: CONSENT_VERSION,
        resumeToken,
        // Residencia prolongada VERSIONADA por evaluacion (Gildardo §1): el valor de ESTE encuentro, por si
        // el paciente se mudo entre consultas. El perfil (patient_profiles) guarda el ultimo conocido (prefill).
        longestResidenceCity: input.identity.longestResidenceCity,
        // El nombre declarado se guarda SIEMPRE que hay conflicto (es lo que lo hace resoluble: sin el, el
        // profesional veria "hay conflicto" sin saber con que). Sin conflicto, no se guarda.
        identityConflict: conflict,
        declaredFirstName: conflict ? input.identity.firstName : null,
        declaredLastName: conflict ? input.identity.lastName : null,
      })
      .returning({ id: evaluations.id });
    await recordAudit(tx, {
      event: "evaluation.signed",
      actorId: null,
      actorEmail: null,
      entityType: "evaluation",
      entityId: evaluation.id,
      payload: {
        mode: input.mode,
        patient_id: patientId,
        status: "awaiting_survey",
        identity_conflict: conflict,
      },
      ip: input.ipAddress,
    });

    await consumeLink(tx, input.linkId);

    return { evaluationId: evaluation.id, patientId, resumeToken };
  });
}

// ── FASE 2: RESPUESTAS (as-you-go) ─────────────────────────────────────────────────────────────────
// Autenticadas por el resume_token: solo escriben si existe una evaluacion en 'awaiting_survey' con ese
// token. Tres primitivas: GUARDAR PROGRESO (a medida, sin salir de 'awaiting_survey'), COMPLETAR (pasa a
// 'draft'), y LEER PROGRESO (para reanudar). Asi un paciente que abandona a mitad no pierde lo que llevaba
// (el dictamen: el borrador se vuelve una funcion normal, porque todo lo posterior a la firma esta
// autorizado). Mientras 'awaiting_survey', la fila survey_responses puede tener respuestas PARCIALES; es
// seguro porque 'awaiting_survey' no aparece en los paneles de accion (no llega al pipeline).
//
// CONTRATO (trampa del reemplazo): el cliente envia el SNAPSHOT COMPLETO de respuestas (todas las
// contestadas hasta ese momento), NO un delta. Por eso el guardado REEMPLAZA todas las answers de la
// evaluacion: si mandara solo el paso actual, reemplazar borraria los dominios anteriores. El formulario
// tiene las 63 en estado, asi que enviar el set completo es natural.

export class ResumeTokenError extends Error {
  constructor() {
    super("Token de reanudacion invalido o la encuesta ya fue completada.");
    this.name = "ResumeTokenError";
  }
}

export type SurveyAnswer = { questionId: string; answerValue: string };

// Caracterizacion sociodemografica OPCIONAL (bloque E1). NO son survey_responses: los 4 de perfil van a
// patient_profiles (dato de identidad estable) y el motivo a evaluations (dato del encuentro). Se envian en
// el mismo snapshot de la fase 2, asi que se autoguardan y no se pierden si el paciente pausa.
//   - profile PRESENTE => se escriben los 4 campos del perfil (vacio => null; nunca un default). Ausente =>
//     no se toca el perfil (en seguimiento la seccion solo muestra el motivo; el perfil ya se capturo).
//   - reasonForVisit: arreglo del motivo (multi); [] => se limpia a null.
export type SurveyCharacterization = {
  profile?: {
    educationLevel: string | null;
    occupation: string | null;
    maritalStatus: string | null;
    socioeconomicStratum: string | null;
    // Pertenencia etnica y ascendencia (datos sensibles): solo se persisten si el paciente otorgo la
    // autorizacion de INVESTIGACION (consent v1.0). El writer las gatea contra patient_consents; sin
    // autorizacion, se ignoran las dos.
    ethnicity: string | null;
    ancestry: string | null;
  };
  reasonForVisit?: string[];
};

export type SurveyPhase2Input = {
  resumeToken: string;
  surveyVersionId: string;
  answers: SurveyAnswer[]; // SNAPSHOT COMPLETO, no delta (ver contrato arriba)
  ipAddress: string | null;
  characterization?: SurveyCharacterization | null;
};

// La evaluacion en 'awaiting_survey' con ese token (o ResumeTokenError). El token se acota solo: al
// completar la encuesta pasa a 'draft' y esta consulta deja de encontrarla.
async function findAwaitingByToken(tx: Tx, resumeToken: string): Promise<{ id: string; patientId: string }> {
  const [ev] = await tx
    .select({ id: evaluations.id, patientId: evaluations.patientId })
    .from(evaluations)
    .where(and(eq(evaluations.resumeToken, resumeToken), eq(evaluations.status, "awaiting_survey")))
    .limit(1);
  if (!ev) throw new ResumeTokenError();
  return ev;
}

// Escritura de la caracterizacion sociodemografica (E1). El perfil, si viene, se actualiza para el paciente
// de la evaluacion (por token, no se confia en un patientId del cliente); el motivo va a la evaluacion. Todo
// vacio se guarda como null (VACIO, no un default). Idempotente: se llama en cada guardado y en el envio.
async function writeCharacterization(
  tx: Tx,
  target: { evaluationId: string; patientId: string },
  characterization: SurveyCharacterization | null | undefined,
): Promise<void> {
  if (!characterization) return;
  const { profile, reasonForVisit } = characterization;
  if (profile) {
    // GATE de etnia (dato sensible): solo se persiste si el paciente tiene la autorizacion de INVESTIGACION
    // vigente (consent v1.0: la etnia se fundio en esa casilla). El servidor NO confia en que la UI la
    // oculte: verifica el consentimiento real y descarta la etnia si no fue autorizada.
    // Etnia Y ascendencia comparten el MISMO gate de investigacion (RESPUESTA_GILDARDO §3). Una sola
    // consulta de consentimiento si CUALQUIERA viene con valor; sin autorizacion, se descartan las DOS.
    let ethnicity = profile.ethnicity;
    let ancestry = profile.ancestry;
    if (ethnicity || ancestry) {
      const [inv] = await tx
        .select({ id: patientConsents.id })
        .from(patientConsents)
        .where(
          and(
            eq(patientConsents.patientId, target.patientId),
            eq(patientConsents.consentType, "investigacion"),
            isNull(patientConsents.revokedAt),
          ),
        )
        .limit(1);
      if (!inv) {
        ethnicity = null; // sin autorizacion de investigacion, no se guardan etnia ni ascendencia
        ancestry = null;
      }
    }
    // (1) PERFIL: el "ultimo valor conocido" del paciente (fuente del prefill en seguimiento).
    await tx
      .update(patientProfiles)
      .set({
        educationLevel: profile.educationLevel,
        occupation: profile.occupation,
        maritalStatus: profile.maritalStatus,
        socioeconomicStratum: profile.socioeconomicStratum,
        ethnicity,
        ancestry,
      })
      .where(eq(patientProfiles.patientId, target.patientId));
    // (2) EVALUACION: el valor DE ESTE ENCUENTRO (versionado, para el historico). `ethnicity`/`ancestry` YA
    // gateadas por la autorizacion de investigacion (care a: el gate cubre las DOS escrituras; sin
    // autorizacion, son null en ambas). El observatorio estratifica por estas columnas.
    await tx
      .update(evaluations)
      .set({
        educationLevel: profile.educationLevel,
        occupation: profile.occupation,
        maritalStatus: profile.maritalStatus,
        socioeconomicStratum: profile.socioeconomicStratum,
        ethnicity,
        ancestry,
      })
      .where(eq(evaluations.id, target.evaluationId));
  }
  if (reasonForVisit !== undefined) {
    // Multi-select: se serializa como arreglo JSON; vacio => null (limpia, no guarda "[]").
    const value = reasonForVisit.length > 0 ? JSON.stringify(reasonForVisit) : null;
    await tx.update(evaluations).set({ reasonForVisit: value }).where(eq(evaluations.id, target.evaluationId));
  }
}

// Upsert de la fila survey_responses (una por evaluacion) y REEMPLAZO de sus answers por el snapshot.
async function upsertResponseAndAnswers(
  tx: Tx,
  evaluationId: string,
  surveyVersionId: string,
  answers: SurveyAnswer[],
  ipAddress: string | null,
): Promise<void> {
  let [response] = await tx
    .select({ id: surveyResponses.id })
    .from(surveyResponses)
    .where(eq(surveyResponses.evaluationId, evaluationId))
    .limit(1);
  if (!response) {
    [response] = await tx
      .insert(surveyResponses)
      .values({ evaluationId, surveyVersionId, ipAddress })
      .returning({ id: surveyResponses.id });
  }
  // Reemplaza el snapshot completo (borra e inserta): el cliente manda todo lo contestado.
  await tx.delete(surveyAnswers).where(eq(surveyAnswers.responseId, response.id));
  if (answers.length > 0) {
    await tx.insert(surveyAnswers).values(
      answers.map((a) => ({ responseId: response.id, questionId: a.questionId, answerValue: a.answerValue })),
    );
  }
}

// GUARDAR PROGRESO: a medida, sin cambiar de estado (sigue 'awaiting_survey'). Idempotente.
export async function saveSurveyProgress(input: SurveyPhase2Input): Promise<{ evaluationId: string }> {
  return db.transaction(async (tx) => {
    const ev = await findAwaitingByToken(tx, input.resumeToken);
    await upsertResponseAndAnswers(tx, ev.id, input.surveyVersionId, input.answers, input.ipAddress);
    await writeCharacterization(tx, { evaluationId: ev.id, patientId: ev.patientId }, input.characterization);
    return { evaluationId: ev.id };
  });
}

// COMPLETAR: guardado final + pasa a 'draft' (ya es una evaluacion normal, confirmable y diagnosticable).
// El token deja de habilitar (la evaluacion ya no esta 'awaiting_survey').
export async function completeSurvey(input: SurveyPhase2Input): Promise<{ evaluationId: string }> {
  return db.transaction(async (tx) => {
    const ev = await findAwaitingByToken(tx, input.resumeToken);
    await upsertResponseAndAnswers(tx, ev.id, input.surveyVersionId, input.answers, input.ipAddress);
    await writeCharacterization(tx, { evaluationId: ev.id, patientId: ev.patientId }, input.characterization);
    await tx.update(evaluations).set({ status: "draft" }).where(eq(evaluations.id, ev.id));
    await recordAudit(tx, {
      event: "evaluation.survey_submitted",
      actorId: null,
      actorEmail: null,
      entityType: "evaluation",
      entityId: ev.id,
      payload: { answers: input.answers.length },
      ip: input.ipAddress,
    });
    return { evaluationId: ev.id };
  });
}

// LEER PROGRESO: las respuestas guardadas de una evaluacion 'awaiting_survey', para reanudar (prefill).
// null si el token no abre ninguna (ya completada o invalido) -> el caller decide (p. ej. "link vencido").
// Devuelve tambien el modo (inicial/seguimiento): la pagina de reanudacion lo usa para el rotulo del
// envio, sin exponer nada mas de la evaluacion.
export type SurveyProgressCharacterization = {
  educationLevel: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  socioeconomicStratum: string | null;
  ethnicity: string | null;
  ancestry: string | null;
  reasonForVisit: string[]; // parseado del arreglo JSON; [] si null o ilegible
};

export async function getSurveyProgress(resumeToken: string): Promise<{
  evaluationId: string;
  mode: EvaluationType;
  answers: SurveyAnswer[];
  characterization: SurveyProgressCharacterization;
  ethnicityAuthorized: boolean;
} | null> {
  const [ev] = await db
    .select({ id: evaluations.id, mode: evaluations.type, patientId: evaluations.patientId, reasonForVisit: evaluations.reasonForVisit })
    .from(evaluations)
    .where(and(eq(evaluations.resumeToken, resumeToken), eq(evaluations.status, "awaiting_survey")))
    .limit(1);
  if (!ev) return null;
  const [profile] = await db
    .select({
      educationLevel: patientProfiles.educationLevel,
      occupation: patientProfiles.occupation,
      maritalStatus: patientProfiles.maritalStatus,
      socioeconomicStratum: patientProfiles.socioeconomicStratum,
      ethnicity: patientProfiles.ethnicity,
      ancestry: patientProfiles.ancestry,
    })
    .from(patientProfiles)
    .where(eq(patientProfiles.patientId, ev.patientId))
    .limit(1);
  const characterization: SurveyProgressCharacterization = {
    educationLevel: profile?.educationLevel ?? null,
    occupation: profile?.occupation ?? null,
    maritalStatus: profile?.maritalStatus ?? null,
    socioeconomicStratum: profile?.socioeconomicStratum ?? null,
    ethnicity: profile?.ethnicity ?? null,
    ancestry: profile?.ancestry ?? null,
    reasonForVisit: parseReasonForVisit(ev.reasonForVisit),
  };
  // Etnia (consent v1.0): el campo se muestra al reanudar solo si otorgo investigacion vigente.
  const [inv] = await db
    .select({ id: patientConsents.id })
    .from(patientConsents)
    .where(
      and(
        eq(patientConsents.patientId, ev.patientId),
        eq(patientConsents.consentType, "investigacion"),
        isNull(patientConsents.revokedAt),
      ),
    )
    .limit(1);
  const ethnicityAuthorized = Boolean(inv);
  const [response] = await db
    .select({ id: surveyResponses.id })
    .from(surveyResponses)
    .where(eq(surveyResponses.evaluationId, ev.id))
    .limit(1);
  if (!response)
    return { evaluationId: ev.id, mode: ev.mode, answers: [], characterization, ethnicityAuthorized };
  const rows = await db
    .select({ questionId: surveyAnswers.questionId, answerValue: surveyAnswers.answerValue })
    .from(surveyAnswers)
    .where(eq(surveyAnswers.responseId, response.id));
  return {
    evaluationId: ev.id,
    mode: ev.mode,
    answers: rows.map((r) => ({ questionId: r.questionId, answerValue: r.answerValue ?? "" })),
    characterization,
    ethnicityAuthorized,
  };
}

// Parsea el motivo (arreglo JSON de strings) de forma tolerante: null/ilegible => []. No confia en el
// contenido de la BD para no romper el prefill si un dato viejo quedo mal formado.
export function parseReasonForVisit(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Estado de la evaluacion asociada a un resume_token, sea cual sea (para el mensaje de la pagina de
// reanudacion cuando el token ya NO abre la encuesta: distinguir cerrada / ya completada / enlace
// invalido; son tres situaciones y tres acciones del paciente distintas). null si el token no existe. El
// token se conserva tras completar o cerrar, asi que sigue resolviendo al estado actual de la evaluacion.
export async function getResumeTokenStatus(resumeToken: string): Promise<string | null> {
  const [ev] = await db
    .select({ status: evaluations.status })
    .from(evaluations)
    .where(eq(evaluations.resumeToken, resumeToken))
    .limit(1);
  return ev?.status ?? null;
}

