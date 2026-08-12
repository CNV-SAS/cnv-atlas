import { appError, err, ok, type Result } from "@/core/errors";
import { CONSENT_DOCUMENT_HASH, CONSENT_VERSION } from "@/modules/consent/consent-hash";
import { verifyOtp, type OtpVerifyStatus } from "@/modules/consent/otp/otp-service";
import {
  assentApplies,
  computeAgeYears,
  consentSchema,
  grantedConsentTypes,
} from "@/modules/consent/validations";
import {
  findDuplicateCandidates,
  findPatientByDocument,
} from "@/modules/patients/data/patients-intake";
import { resolveIdentity } from "@/modules/patients/services/identity-resolution";

import {
  completeSurvey,
  ConsentGateError,
  getResumeTokenStatus,
  getSurveyProgress,
  ResumeTokenError,
  saveSurveyProgress,
  signIntakeEvaluation,
  type IntakeConsent,
  type SurveyAnswer,
  type SurveyProgressCharacterization,
} from "../data/intake-writer";
import { characterizationSchema, intakeAnswersSchema, intakeIdentitySchema } from "../validations";
import type { IntakeIdentityInput } from "../validations";
import type { SurveyIntakeResult, SurveyLinkView } from "../types";

// Orquesta el envio de la encuesta publica (recoleccion pura + identidad + gate). No toca BD
// directamente: valida la entrada, resuelve identidad (lecturas service role) y delega la escritura al
// intake-writer. Retorna Result; no hace throw para errores esperables (ARCHITECTURE).
//
// Reorganizacion del intake (2026-08-10): el flujo se parte en dos fases. `signSurveyIntake` (FIRMAR:
// consentimiento + identidad + codigo) va PRIMERO y crea el shell firmado + resume_token; la fase 2
// (`saveProgress` a medida y `submitSurveyAnswers` al final) va despues, autenticada por el token. La
// preparacion comun de la firma (validar + verificar codigo + resolver identidad) vive en
// resolveSignedIntake.

// Mensaje al paciente por estado del codigo: la accion difiere. 'invalid' -> mirar bien el correo;
// 'expired'/'too_many_attempts' -> pedir uno nuevo; 'unavailable' -> el servicio esta caido.
function otpMessage(status: Exclude<OtpVerifyStatus, "ok">): string {
  switch (status) {
    case "invalid":
      return "El código no es correcto. Revisa el correo e ingrésalo de nuevo.";
    case "expired":
      return "El código venció o ya no está disponible. Pide uno nuevo para continuar.";
    case "too_many_attempts":
      return "Demasiados intentos con ese código. Pide uno nuevo para continuar.";
    case "unavailable":
      return "La verificación no está disponible en este momento. No es un problema de tus datos: intenta de nuevo en unos minutos y, si continúa, avisa a tu profesional.";
  }
}

// Preparacion COMUN de la firma: valida consentimiento e identidad, VERIFICA el codigo (firma; se
// consume aqui, un solo uso) y resuelve identidad; arma los consentimientos a persistir (con la rama
// menor). Es todo lo que pasa ANTES de escribir, compartido por firmar (nuevo) y el flujo viejo. La
// verificacion del codigo va DESPUES de las validaciones de forma (para no quemar un codigo por un
// campo mal) y antes de cualquier escritura.
type SignedIntakePrep = {
  consents: IntakeConsent[];
  signature: { channel: string; maskedDestination: string; sentAt: number; validatedAt: number };
  resolution: Awaited<ReturnType<typeof resolveIdentity>>;
  identity: IntakeIdentityInput;
};

async function resolveSignedIntake(input: {
  link: SurveyLinkView;
  consent: unknown;
  identity: unknown;
  otp: { sessionId: string; code: string };
}): Promise<Result<SignedIntakePrep>> {
  const consent = consentSchema.safeParse(input.consent);
  if (!consent.success) {
    return err(
      appError("validation", "Debes aceptar las autorizaciones necesarias y declarar que eres mayor de edad."),
    );
  }
  const identity = intakeIdentitySchema.safeParse(input.identity);
  if (!identity.success) {
    return err(appError("validation", "Revisa los datos de identificación."));
  }

  // FIRMA ELECTRONICA (dictamen art. 4 Decreto 2364): verificar el codigo. Se CONSUME aqui (un solo uso).
  const otp = await verifyOtp(input.otp.sessionId, input.otp.code);
  if (otp.status !== "ok") {
    // 'unavailable' es fallo de infraestructura (Upstash caido), no del paciente: se mapea a internal.
    const code = otp.status === "unavailable" ? "internal" : "validation";
    return err(appError(code, otpMessage(otp.status)));
  }
  const signature = {
    channel: otp.meta?.channel ?? "email",
    maskedDestination: otp.meta?.maskedDestination ?? "",
    sentAt: otp.meta?.sentAt ?? 0,
    validatedAt: Date.now(), // hora del servidor: el instante probatorio del acto de firma
  };

  const resolution = await resolveIdentity(
    { findPatientByDocument, findDuplicateCandidates },
    {
      organizationId: input.link.organizationId,
      documentType: identity.data.documentType,
      documentNumber: identity.data.documentNumber,
      firstName: identity.data.firstName,
      lastName: identity.data.lastName,
      birthDate: identity.data.birthDate,
    },
  );

  // Consentimientos otorgados, sellados con la version y el hash canonicos vigentes.
  const consents: IntakeConsent[] = grantedConsentTypes(consent.data).map((type) => ({
    type,
    consentVersion: CONSENT_VERSION,
    documentHash: CONSENT_DOCUMENT_HASH,
  }));
  // Firma electronica (v1.7): la aceptacion del medio electronico se persiste como registro propio (no
  // es una de las 3 finalidades del gate). Es la evidencia de que el titular acepto firmar por medios
  // electronicos.
  consents.push({
    type: "aceptacion_medio_electronico",
    consentVersion: CONSENT_VERSION,
    documentHash: CONSENT_DOCUMENT_HASH,
  });
  // Rama menor (DELTA2 B4): registro del representante legal y, si el menor tiene 14-17, el asentimiento.
  if (consent.data.ageBranch === "menor") {
    consents.push({
      type: "representante_legal",
      consentVersion: CONSENT_VERSION,
      documentHash: CONSENT_DOCUMENT_HASH,
      legalRepresentative: {
        name: consent.data.legalRepresentativeName!,
        document: consent.data.legalRepresentativeDocument!,
        relationship: consent.data.legalRepresentativeRelationship!,
        email: consent.data.legalRepresentativeEmail!,
      },
    });
    const age = consent.data.minorBirthDate
      ? computeAgeYears(consent.data.minorBirthDate, new Date())
      : null;
    if (assentApplies(age)) {
      consents.push({
        type: "asentimiento_menor",
        consentVersion: CONSENT_VERSION,
        documentHash: CONSENT_DOCUMENT_HASH,
      });
    }
  }

  return ok({ consents, signature, resolution, identity: identity.data });
}

// ── FASE 1: FIRMAR ────────────────────────────────────────────────────────────────────────────────
export type SignSurveyIntakeInput = {
  link: SurveyLinkView;
  consent: unknown;
  identity: unknown;
  otp: { sessionId: string; code: string };
  ipAddress: string | null;
};

export type SignSurveyResult = SurveyIntakeResult & { resumeToken: string };

export async function signSurveyIntake(
  input: SignSurveyIntakeInput,
): Promise<Result<SignSurveyResult>> {
  const prep = await resolveSignedIntake(input);
  if (!prep.ok) return prep;
  const { consents, signature, resolution, identity } = prep.value;

  const linkId = input.link.type === "seguimiento" ? input.link.id : null;
  try {
    const signed = await signIntakeEvaluation({
      organizationId: input.link.organizationId,
      professionalId: input.link.professionalId,
      mode: resolution.mode,
      patientId: resolution.matchedPatientId,
      identity,
      consents,
      linkId,
      ipAddress: input.ipAddress,
      signature,
      identityConflict: resolution.identityConflict,
    });
    return ok({
      evaluationId: signed.evaluationId,
      patientId: signed.patientId,
      resumeToken: signed.resumeToken,
      mode: resolution.mode,
      duplicateCandidates: resolution.duplicateCandidates,
    });
  } catch (e) {
    if (e instanceof ConsentGateError) {
      return err(
        appError("forbidden", "No es posible crear la evaluación sin las autorizaciones necesarias vigentes."),
      );
    }
    throw e;
  }
}

// ── FASE 2: RESPUESTAS (as-you-go) ──────────────────────────────────────────────────────────────────
export type SurveyPhase2Input = {
  resumeToken: string;
  surveyVersionId: string;
  answers: unknown;
  ipAddress: string | null;
  // Caracterizacion sociodemografica opcional (E1). Se valida con characterizationSchema (tolerante:
  // normaliza contra las listas, vacio => null). Nunca bloquea el envio de la encuesta.
  characterization?: unknown;
};

const RESUME_INVALID = "El enlace de la encuesta no es válido o la encuesta ya se completó.";

// GUARDAR PROGRESO (a medida). El snapshot completo de respuestas; queda en 'awaiting_survey'.
export async function saveProgress(input: SurveyPhase2Input): Promise<Result<{ evaluationId: string }>> {
  const answers = intakeAnswersSchema.safeParse(input.answers);
  if (!answers.success) return err(appError("validation", "Hay respuestas inválidas en la encuesta."));
  const characterization = characterizationSchema.safeParse(input.characterization);
  try {
    const res = await saveSurveyProgress({
      resumeToken: input.resumeToken,
      surveyVersionId: input.surveyVersionId,
      answers: answers.data,
      ipAddress: input.ipAddress,
      characterization: characterization.success ? characterization.data : null,
    });
    return ok({ evaluationId: res.evaluationId });
  } catch (e) {
    if (e instanceof ResumeTokenError) return err(appError("validation", RESUME_INVALID));
    throw e;
  }
}

// COMPLETAR: guardado final + pasa a 'draft'.
export async function submitSurveyAnswers(input: SurveyPhase2Input): Promise<Result<{ evaluationId: string }>> {
  const answers = intakeAnswersSchema.safeParse(input.answers);
  if (!answers.success) return err(appError("validation", "Hay respuestas inválidas en la encuesta."));
  const characterization = characterizationSchema.safeParse(input.characterization);
  try {
    const res = await completeSurvey({
      resumeToken: input.resumeToken,
      surveyVersionId: input.surveyVersionId,
      answers: answers.data,
      ipAddress: input.ipAddress,
      characterization: characterization.success ? characterization.data : null,
    });
    return ok({ evaluationId: res.evaluationId });
  } catch (e) {
    if (e instanceof ResumeTokenError) return err(appError("validation", RESUME_INVALID));
    throw e;
  }
}

// LEER PROGRESO: para reanudar (prefill). null si el token ya no abre nada. Incluye el modo
// (inicial/seguimiento) para el rotulo del envio en la pagina de reanudacion.
export async function readSurveyProgress(
  resumeToken: string,
): Promise<{
  evaluationId: string;
  mode: "inicial" | "seguimiento";
  answers: SurveyAnswer[];
  characterization: SurveyProgressCharacterization;
} | null> {
  return getSurveyProgress(resumeToken);
}

// Estado actual del token cuando ya NO abre la encuesta, para el mensaje de reanudacion (cerrada /
// completada / invalido). null si el token no existe.
export async function readResumeTokenStatus(resumeToken: string): Promise<string | null> {
  return getResumeTokenStatus(resumeToken);
}
