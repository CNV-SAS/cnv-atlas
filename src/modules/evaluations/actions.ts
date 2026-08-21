"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import QRCode from "qrcode";

import { getClientIp } from "@/core/http/client-ip";
import {
  limitConsentOtpByToken,
  limitSurveyByIp,
  limitSurveyByToken,
} from "@/core/rate-limit";
import { requireUser } from "@/modules/auth/session";
import { saveSurveyEdit } from "./data/survey-edit-writer";
import {
  generateOtpCode,
  maskEmail,
  storeOtp,
} from "@/modules/consent/otp/otp-service";
import { sendConsentOtpEmail } from "@/lib/email/resend";
import {
  sendConsentCopy,
  type ConsentCopyRecipient,
} from "@/modules/consent/consent-copy-service";
import type { ConsentInstanceData } from "@/modules/consent/consent-instance";
import type { ConsentType } from "@/modules/consent/validations";
import { CONSENT_TEXT_V1_0, CONSENT_VERSION } from "@/modules/consent/text/consent-v1.0";
import {
  getProfessionalIdForPatient,
  getProfessionalProfileIdByUser,
} from "@/modules/payments/data/payments-repository";

import {
  getEvaluationOwnership,
  getPatientPrefill,
} from "./data/evaluations-repository";
import { ConsentGateError, startFollowupWithoutSignature } from "./data/intake-writer";
import {
  abandonAwaitingEvaluation,
  confirmEvaluationIdentity,
  ConsentBranchMismatchError,
  resolveIdentityConflict,
} from "./data/evaluations-writer";
import { emitFollowupLink } from "./data/survey-links-writer";
import {
  saveProgress,
  signSurveyIntake,
  submitSurveyAnswers,
} from "./services/survey-intake";
import { getActiveSurvey } from "./data/survey-reader";
import { buildResumeUrl } from "./resume-url";
import {
  getProfessionalForConsent,
  resolveSurveyLinkByToken,
} from "./data/survey-links-reader";
import {
  canAbandonEvaluation,
  canConfirmIdentity,
  canEmitFollowupLink,
  canManageBaseSurveyLink,
} from "./policies/can-manage-evaluations";
import { getOrCreateBaseSurveyLink } from "./services/base-survey-link";
import { otpSendSchema } from "./validations";
import type {
  AbandonEvaluationState,
  BaseSurveyLinkState,
  BaseSurveyQrState,
  ConfirmIdentityState,
  FollowupLinkState,
  OtpSendState,
  ResolveConflictState,
  SaveProgressState,
  SignSurveyState,
  StartFollowupState,
  SurveyFormState,
} from "./validations";

// Lee una casilla del formulario: presente y "on" => true.
function checkbox(form: FormData, name: string): boolean {
  return form.get(name) === "on";
}

function str(form: FormData, name: string): string {
  return (form.get(name) as string | null)?.trim() ?? "";
}

// ── Helpers compartidos por firmar (fase 1) y guardar/enviar respuestas (fase 2) ────────────────────
function readConsentFromForm(form: FormData) {
  const ageBranchRaw = str(form, "ageBranch");
  return {
    servicio: checkbox(form, "servicio"),
    datos_sensibles: checkbox(form, "datos_sensibles"),
    aceptacion_medio_electronico: checkbox(form, "aceptacion_medio_electronico"),
    investigacion: checkbox(form, "investigacion"),
    comunicaciones_continuidad: checkbox(form, "comunicaciones_continuidad"),
    comunicaciones_comerciales: checkbox(form, "comunicaciones_comerciales"),
    ageBranch: ageBranchRaw === "menor" ? "menor" : "mayor",
    mayoria_de_edad: ageBranchRaw === "mayor",
    legalRepresentativeName: str(form, "legalRepresentativeName") || undefined,
    legalRepresentativeDocument: str(form, "legalRepresentativeDocument") || undefined,
    legalRepresentativeRelationship: str(form, "legalRepresentativeRelationship") || undefined,
    legalRepresentativeEmail: str(form, "legalRepresentativeEmail") || undefined,
    minorBirthDate: str(form, "minorBirthDate") || undefined,
    asentimiento_menor: checkbox(form, "asentimiento_menor"),
  };
}

function readIdentityFromForm(form: FormData) {
  return {
    documentType: str(form, "documentType"),
    documentNumber: str(form, "documentNumber"),
    firstName: str(form, "firstName"),
    lastName: str(form, "lastName"),
    birthDate: str(form, "birthDate") || null,
    sex: str(form, "sex") || null,
    country: str(form, "country") || null,
    city: str(form, "city") || null,
    longestResidenceCity: str(form, "longestResidenceCity") || null,
    email: str(form, "email") || null,
    phone: str(form, "phone") || null,
  };
}

// Respuestas desde el formulario, contra las preguntas REALES de la version activa (server-side, no lo
// que el cliente diga existir). Multi-select -> JSON. El motor compara option_text, no ids.
function readAnswersFromForm(
  form: FormData,
  questions: { id: string; type: string }[],
): { questionId: string; answerValue: string }[] {
  return questions
    .map((q) => {
      if (q.type === "opcion_multiple") {
        const selected = form
          .getAll(`answer_${q.id}`)
          .map((v) => String(v).trim())
          .filter((v) => v.length > 0);
        return { questionId: q.id, answerValue: selected.length ? JSON.stringify(selected) : "" };
      }
      return { questionId: q.id, answerValue: str(form, `answer_${q.id}`) };
    })
    .filter((a) => a.answerValue.length > 0);
}

// Caracterizacion sociodemografica (E1) desde el formulario de la fase 2. El motivo (multi) va siempre; el
// bloque de perfil solo cuando la seccion lo renderiza (marcador hasProfileFields=1, presente en el intake
// inicial, ausente en seguimiento donde el perfil ya existe). Vacio se manda como null (VACIO, no default);
// la normalizacion final contra las listas la hace characterizationSchema en el servicio.
function readCharacterizationFromForm(form: FormData): {
  profile?: {
    educationLevel: string | null;
    occupation: string | null;
    maritalStatus: string | null;
    socioeconomicStratum: string | null;
    ethnicity: string | null;
    ancestry: string | null;
  };
  reasonForVisit: string[];
} {
  const nullable = (name: string) => str(form, name) || null;
  const reasonForVisit = form
    .getAll("motivo")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
  const characterization: ReturnType<typeof readCharacterizationFromForm> = { reasonForVisit };
  if (form.get("hasProfileFields") === "1") {
    characterization.profile = {
      educationLevel: nullable("educationLevel"),
      occupation: nullable("occupation"),
      maritalStatus: nullable("maritalStatus"),
      socioeconomicStratum: nullable("socioeconomicStratum"),
      // Etnia y ascendencia: solo llegan si el campo se mostro (autorizacion de investigacion). El writer
      // las re-gatea contra el consentimiento real.
      ethnicity: nullable("ethnicity"),
      ancestry: nullable("ancestry"),
    };
  }
  return characterization;
}

// URL absoluta de reanudacion para el correo (el paciente no tiene sesion). Sale del dominio canonico
// (NEXT_PUBLIC_APP_URL) via buildResumeUrl, MISMO helper que usa la pantalla "firmado": asi el enlace del
// correo y el de pantalla son identicos. El origen de la request es solo fallback de desarrollo.
async function resumeUrlFrom(resumeToken: string): Promise<string | null> {
  const h = await headers();
  const host = h.get("host");
  const fallback = host
    ? `${
        h.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")
      }://${host}`
    : null;
  return buildResumeUrl(resumeToken, fallback) || null;
}

// Despacho de la copia del consentimiento (+ enlace de reanudacion si aplica). Fuera del camino de
// respuesta (el caller usa after): transparencia, no requisito de validez; un fallo no revierte nada. El
// destino: adulto -> paciente; menor -> representante (y el menor si dio correo).
async function dispatchConsentCopy(args: {
  link: { professionalId: string };
  consent: ReturnType<typeof readConsentFromForm>;
  identity: ReturnType<typeof readIdentityFromForm>;
  patientId: string;
  acceptedAt: number;
  resumeUrl: string | null;
}): Promise<void> {
  const { consent, identity } = args;
  const grantedForCopy: ConsentType[] = ["servicio", "datos_sensibles"];
  if (consent.investigacion) grantedForCopy.push("investigacion");
  if (consent.comunicaciones_continuidad) grantedForCopy.push("comunicaciones_continuidad");
  if (consent.comunicaciones_comerciales) grantedForCopy.push("comunicaciones_comerciales");

  const recipients: ConsentCopyRecipient[] = [];
  if (consent.ageBranch === "menor") {
    if (consent.legalRepresentativeEmail) {
      recipients.push({ email: consent.legalRepresentativeEmail, role: "representante" });
    }
    if (identity.email) recipients.push({ email: identity.email, role: "menor" });
  } else if (identity.email) {
    recipients.push({ email: identity.email, role: "titular" });
  }
  if (recipients.length === 0) return;

  const professional = (await getProfessionalForConsent(args.link.professionalId)) ?? {
    fullName: "",
    profession: "",
    license: null,
  };
  const fullName = `${identity.firstName} ${identity.lastName}`.trim();
  const instance: ConsentInstanceData = {
    branch: consent.ageBranch === "menor" ? "menor" : "mayor",
    patient: { name: fullName, document: identity.documentNumber },
    professional,
    representative:
      consent.ageBranch === "menor"
        ? {
            name: consent.legalRepresentativeName ?? "",
            document: consent.legalRepresentativeDocument ?? "",
            relationship: consent.legalRepresentativeRelationship ?? "",
            email: consent.legalRepresentativeEmail ?? "",
          }
        : null,
    assent:
      consent.ageBranch === "menor"
        ? { applies: consent.asentimiento_menor, minorName: fullName }
        : null,
    granted: [...grantedForCopy, "aceptacion_medio_electronico"],
    acceptedAt: args.acceptedAt,
  };
  await sendConsentCopy({
    patientId: args.patientId,
    acceptedAt: args.acceptedAt,
    granted: grantedForCopy,
    consentVersion: CONSENT_VERSION,
    consentTemplate: CONSENT_TEXT_V1_0,
    instance,
    recipients,
    resumeUrl: args.resumeUrl,
  });
}

// ── FASE 1: FIRMAR (reorganizacion del intake) ──────────────────────────────────────────────────────
// Consentimiento + identidad + codigo. Crea el shell firmado y devuelve el resume_token (con el que el
// formulario pasa a la encuesta y se reanuda). Envia la copia CON el enlace de reanudacion.
export async function signSurveyAction(
  _prev: SignSurveyState,
  form: FormData,
): Promise<SignSurveyState> {
  const fail = (error: string, fields: Record<string, string> | null = null): SignSurveyState => ({
    error,
    fields,
    resumeToken: null,
    ethnicityAuthorized: false,
  });

  const token = str(form, "token");
  if (!token) return fail("Link inválido.");
  const ip = await getClientIp();
  const [byIp, byToken] = await Promise.all([limitSurveyByIp(ip), limitSurveyByToken(token)]);
  if (!byIp.success || !byToken.success) {
    return fail("Demasiados intentos. Espera unos minutos e intenta de nuevo.");
  }
  const link = await resolveSurveyLinkByToken(token);
  if (!link) return fail("Este link no esta disponible, ya fue usado o vencio.");

  const sessionId = str(form, "otpSessionId");
  const otpCode = str(form, "otpCode");
  if (!sessionId || !otpCode) {
    return fail("Ingresa el código de verificación que enviamos al correo para firmar.");
  }

  const consent = readConsentFromForm(form);
  const identity = readIdentityFromForm(form);

  const result = await signSurveyIntake({
    link,
    consent,
    identity,
    otp: { sessionId, code: otpCode },
    ipAddress: ip === "unknown" ? null : ip,
  });
  if (!result.ok) return fail(result.error.message, result.error.fields ?? null);

  // El shell YA se creo (signSurveyIntake tuvo exito): a partir de aqui el resume_token es valido y el
  // paciente DEBE avanzar. Armar la URL de reanudacion y agendar la copia del consentimiento son TRANSPARENCIA,
  // no requisito de validez: si algo de eso falla, NO puede dejar al paciente en el boton sin mensaje ni perder
  // el resume_token (era el sintoma: sin error, sin Sentry, de vuelta al boton). Se registra y se avanza igual.
  const { patientId, resumeToken } = result.value;
  const ethnicityAuthorized = consent.investigacion === true;
  const acceptedAt = Date.now();
  // La URL de reanudacion (para el correo) puede fallar (armado de URL); si falla NO debe tumbar la firma NI
  // impedir la copia. Se captura y se sigue con resumeUrl null: la copia se envia igual (el enlace es un
  // extra del correo, no un requisito). Antes, si esto lanzaba, `after(...)` no se llamaba y la copia NO se
  // enviaba (los pacientes no la recibian) ademas de tumbar la accion.
  let resumeUrl: string | null = null;
  try {
    resumeUrl = await resumeUrlFrom(resumeToken);
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "sign-survey-action", op: "resume-url" } });
  }
  // La copia del consentimiento va SIEMPRE (transparencia). En `after`: un fallo aqui (correo, lectura del
  // profesional) queda fuera del camino de respuesta y no afecta la validez ni el avance del paciente.
  after(() => dispatchConsentCopy({ link, consent, identity, patientId, acceptedAt, resumeUrl }));

  // El formulario recibe el resume_token y pasa a la fase 2 (la encuesta). No redirige: sigue en la pagina.
  return { error: null, fields: null, resumeToken, ethnicityAuthorized };
}

// ── SEGUIMIENTO SIN FIRMA (dictamen legal 2026-08-20 §3) ────────────────────────────────────────────
// El seguimiento normal se salta la firma y el codigo: crea el shell verificando la vigencia (regla 15) y
// pasa a la encuesta. Si una autorizacion necesaria fue REVOCADA, no se crea nada y se avisa (revoked). Las
// excepciones (cambiar autorizaciones/contacto) y el bump sustantivo NO pasan por aqui: van al camino con firma.
export async function startFollowupAction(
  _prev: StartFollowupState,
  form: FormData,
): Promise<StartFollowupState> {
  const fail = (error: string): StartFollowupState => ({ error, resumeToken: null, revoked: false });

  const token = str(form, "token");
  if (!token) return fail("Link inválido.");
  const ip = await getClientIp();
  const [byIp, byToken] = await Promise.all([limitSurveyByIp(ip), limitSurveyByToken(token)]);
  if (!byIp.success || !byToken.success) {
    return fail("Demasiados intentos. Espera unos minutos e intenta de nuevo.");
  }
  const link = await resolveSurveyLinkByToken(token);
  if (!link || link.type !== "seguimiento" || !link.patientId) {
    return fail("Este link no esta disponible, ya fue usado o vencio.");
  }

  try {
    const result = await startFollowupWithoutSignature({
      organizationId: link.organizationId,
      professionalId: link.professionalId,
      patientId: link.patientId,
      linkId: link.id,
      ipAddress: ip === "unknown" ? null : ip,
    });
    return { error: null, resumeToken: result.resumeToken, revoked: false };
  } catch (e) {
    // Autorizacion necesaria revocada: el gate (regla 15) corrio ANTES de crear nada. No es un error tecnico;
    // se muestra el aviso de acudir al profesional (redaccion aprobada 2026-08-20).
    if (e instanceof ConsentGateError) {
      return { error: null, resumeToken: null, revoked: true };
    }
    throw e;
  }
}

// ── FASE 2: guardar a medida (as-you-go) ────────────────────────────────────────────────────────────
// El cliente envia el SNAPSHOT COMPLETO de respuestas (contrato del writer). No completa: sigue en la
// encuesta. Un fallo NO bloquea (el cliente muestra "no se pudo guardar" y reintenta).
export async function saveProgressAction(
  _prev: SaveProgressState,
  form: FormData,
): Promise<SaveProgressState> {
  const resumeToken = str(form, "resumeToken");
  if (!resumeToken) return { saved: false, error: "Falta el enlace de la encuesta." };
  const survey = await getActiveSurvey();
  if (!survey) return { saved: false, error: "La encuesta no esta disponible en este momento." };
  const ip = await getClientIp();
  const answers = readAnswersFromForm(form, survey.questions);
  const res = await saveProgress({
    resumeToken,
    surveyVersionId: survey.surveyVersionId,
    answers,
    ipAddress: ip === "unknown" ? null : ip,
    characterization: readCharacterizationFromForm(form),
  });
  if (!res.ok) return { saved: false, error: res.error.message };
  return { saved: true, error: null };
}

// ── FASE 2: COMPLETAR ───────────────────────────────────────────────────────────────────────────────
export async function submitSurveyAnswersAction(
  _prev: SurveyFormState,
  form: FormData,
): Promise<SurveyFormState> {
  const fail = (error: string): SurveyFormState => ({ error, fields: null, done: false });
  const resumeToken = str(form, "resumeToken");
  if (!resumeToken) return fail("Falta el enlace de la encuesta.");
  const survey = await getActiveSurvey();
  if (!survey) return fail("La encuesta no esta disponible en este momento.");
  const ip = await getClientIp();
  const answers = readAnswersFromForm(form, survey.questions);
  const res = await submitSurveyAnswers({
    resumeToken,
    surveyVersionId: survey.surveyVersionId,
    answers,
    ipAddress: ip === "unknown" ? null : ip,
    characterization: readCharacterizationFromForm(form),
  });
  if (!res.ok) return fail(res.error.message);
  redirect("/encuesta/gracias");
}

// Envia el codigo de verificacion (OTP) del consentimiento por correo (B7, firma electronica).
// Resuelve la condicion 1 del art. 4 del Decreto 2364: el control del correo prueba que la firma
// corresponde a quien la ejerce. El destino lo decide el SERVIDOR segun la rama de edad (mayor ->
// correo del paciente; menor -> correo del representante), nunca un campo suelto del cliente. Orden:
// validar link -> validar entrada -> rate limit por token (anti email-bombing) -> generar + guardar
// (solo el hash, TTL corto) -> enviar. Nunca revela el correo completo; devuelve solo el enmascarado.
export async function sendConsentOtpAction(
  _prev: OtpSendState,
  form: FormData,
): Promise<OtpSendState> {
  const fail = (error: string): OtpSendState => ({
    error,
    sent: false,
    maskedDestination: null,
    remaining: null,
  });

  const token = str(form, "token");
  if (!token) return fail("Link inválido.");

  const link = await resolveSurveyLinkByToken(token);
  if (!link) return fail("Este link no esta disponible, ya fue usado o vencio.");

  // El correo destino sale de la rama: menor -> representante; mayor -> paciente.
  const ageBranch = str(form, "ageBranch") === "menor" ? "menor" : "mayor";
  const destination =
    ageBranch === "menor" ? str(form, "legalRepresentativeEmail") : str(form, "email");

  const parsed = otpSendSchema.safeParse({
    sessionId: str(form, "sessionId"),
    email: destination,
  });
  if (!parsed.success) {
    return fail(
      ageBranch === "menor"
        ? "Necesitamos el correo del representante para enviar el código de verificación."
        : "Necesitamos tu correo para enviarte el código de verificación.",
    );
  }

  // Rate limit por token: frena el email-bombing hacia el correo del paciente/representante.
  const limit = await limitConsentOtpByToken(token);
  if (!limit.success) {
    return fail("Enviaste demasiados códigos. Espera unos minutos e intenta de nuevo.");
  }

  const code = generateOtpCode();
  const masked = maskEmail(parsed.data.email);
  const stored = await storeOtp(parsed.data.sessionId, code, {
    channel: "email",
    maskedDestination: masked,
    // Hora del SERVIDOR (epoch-ms), no del cliente: es prueba del envio y no puede falsearse.
    sentAt: Date.now(),
  });
  if (!stored) {
    // Sin almacen (Upstash ausente o caido) no hay OTP: no se debe dejar pasar la firma en silencio.
    // Mensaje que aclara que NO es culpa del paciente y que avise al profesional (el servicio de
    // verificacion es una dependencia externa; si cae, bloquea el registro entero).
    return fail(
      "La verificación no está disponible en este momento. No es un problema de tus datos: intenta de nuevo en unos minutos y, si continúa, avisa a tu profesional.",
    );
  }

  const sent = await sendConsentOtpEmail(parsed.data.email, code);
  if (!sent.ok) return fail("No pudimos enviar el código. Revisa el correo e intenta de nuevo.");

  return {
    error: null,
    sent: true,
    maskedDestination: masked,
    remaining: limit.remaining,
  };
}

// Confirma la identidad de una evaluacion (draft -> in_progress) tras la revision del
// profesional. La RLS (getEvaluationOwnership) verifica que sea su paciente; el audit
// evaluation.identity_confirmed queda inline en la transaccion del escritor.
export async function confirmIdentityAction(
  _prev: ConfirmIdentityState,
  form: FormData,
): Promise<ConfirmIdentityState> {
  const user = await requireUser();
  if (!canConfirmIdentity(user)) return { error: "No autorizado.", confirmed: false };

  const evaluationId = (form.get("evaluationId") as string | null)?.trim() ?? "";
  if (!evaluationId) return { error: "Evaluación inválida.", confirmed: false };

  const ownership = await getEvaluationOwnership(evaluationId);
  if (!ownership) return { error: "Evaluación no encontrada.", confirmed: false };
  // GATE del conflicto de identidad: no se puede confirmar (draft -> in_progress) mientras el nombre
  // declarado difiera del registrado. Como BIS y diagnostico exigen in_progress, esto cierra todo lo
  // aguas abajo: nada contaminado se sella hasta que el profesional resuelva el conflicto.
  if (ownership.identityConflict) {
    return {
      error: "Hay un conflicto de identidad sin resolver: el nombre declarado no coincide con el registrado. Resuélvelo antes de confirmar.",
      confirmed: false,
    };
  }
  if (ownership.status !== "draft") {
    return { error: "Esta evaluación ya fue confirmada.", confirmed: true };
  }

  const ip = await getClientIp();
  try {
    const { confirmed } = await confirmEvaluationIdentity({
      evaluationId,
      patientId: ownership.patientId,
      actorId: user.id,
      actorEmail: user.email,
      ip: ip === "unknown" ? null : ip,
    });
    if (!confirmed) return { error: "No se pudo confirmar.", confirmed: false };
  } catch (e) {
    // Discrepancia edad/rama de consentimiento (DELTA2 B3): mensaje claro, sin confirmar.
    if (e instanceof ConsentBranchMismatchError) {
      return { error: e.message, confirmed: false };
    }
    throw e;
  }

  // Revalida la LISTA (sale de la cola) Y la EVALUACION (c: el confirmar vive dentro de la evaluacion; tras
  // confirmar, la pagina se re-renderiza con la identidad ya confirmada -> aparecen condiciones e import,
  // sin volver a la lista).
  revalidatePath("/evaluaciones");
  revalidatePath(`/evaluaciones/${evaluationId}`);
  return { error: null, confirmed: true };
}

// Cierra (archiva) un shell firmado sin responder ('awaiting_survey' -> 'abandoned'). Lo hace el
// profesional dueno del paciente (policy + RLS via getEvaluationOwnership). No borra nada: el
// consentimiento y su registro se conservan. El guard de estado evita cerrar una que ya tiene respuestas.
export async function abandonEvaluationAction(
  _prev: AbandonEvaluationState,
  form: FormData,
): Promise<AbandonEvaluationState> {
  const user = await requireUser();
  if (!canAbandonEvaluation(user)) return { error: "No autorizado.", closed: false };

  const evaluationId = str(form, "evaluationId");
  if (!evaluationId) return { error: "Evaluación inválida.", closed: false };

  const ownership = await getEvaluationOwnership(evaluationId);
  if (!ownership) return { error: "Evaluación no encontrada.", closed: false };
  if (ownership.status !== "awaiting_survey") {
    // Solo se cierran shells firmados sin responder; si ya tiene respuestas (o ya se cerro), no procede.
    return {
      error: "Solo se puede cerrar una evaluación firmada que aún no se completó.",
      closed: false,
    };
  }

  const ip = await getClientIp();
  const { closed } = await abandonAwaitingEvaluation({
    evaluationId,
    patientId: ownership.patientId,
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });
  if (!closed) return { error: "No se pudo cerrar la evaluación.", closed: false };

  // Refresca la ficha (la fila pasa a "Abandonada") y el panel (sale de la cola de firmados-sin-responder).
  revalidatePath(`/pacientes/${ownership.patientId}`);
  revalidatePath("/evaluaciones");
  return { error: null, closed: true };
}

// Resuelve un conflicto de identidad (documento coincide, nombre difiere). El profesional del paciente
// (policy + RLS) decide: "same" (misma persona) limpia el flag y la evaluacion sigue el flujo normal;
// "different" (no es la misma) la cierra. La decision queda auditada con ambos nombres.
export async function resolveIdentityConflictAction(
  _prev: ResolveConflictState,
  form: FormData,
): Promise<ResolveConflictState> {
  const user = await requireUser();
  if (!canConfirmIdentity(user)) return { error: "No autorizado.", resolved: false };

  const evaluationId = str(form, "evaluationId");
  const decisionRaw = str(form, "decision");
  if (!evaluationId) return { error: "Evaluación inválida.", resolved: false };
  if (decisionRaw !== "same" && decisionRaw !== "different") {
    return { error: "Decisión inválida.", resolved: false };
  }

  const ownership = await getEvaluationOwnership(evaluationId);
  if (!ownership) return { error: "Evaluación no encontrada.", resolved: false };
  if (!ownership.identityConflict) {
    return { error: "Esta evaluación no tiene un conflicto de identidad pendiente.", resolved: false };
  }

  const ip = await getClientIp();
  const { resolved } = await resolveIdentityConflict({
    evaluationId,
    patientId: ownership.patientId,
    decision: decisionRaw,
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });
  if (!resolved) return { error: "No se pudo resolver.", resolved: false };

  revalidatePath("/evaluaciones");
  revalidatePath(`/evaluaciones/${evaluationId}`); // c: la resolucion tambien vive en la evaluacion
  revalidatePath(`/pacientes/${ownership.patientId}`);
  return { error: null, resolved: true };
}

// Emite un link de seguimiento (un solo uso, colchon 30 dias) para un paciente del
// profesional. Devuelve la ruta /encuesta/<token> para compartir.
export async function emitFollowupLinkAction(
  _prev: FollowupLinkState,
  form: FormData,
): Promise<FollowupLinkState> {
  const user = await requireUser();
  if (!canEmitFollowupLink(user)) return { error: "No autorizado.", linkPath: null };

  const patientId = (form.get("patientId") as string | null)?.trim() ?? "";
  if (!patientId) return { error: "Paciente inválido.", linkPath: null };

  // El profesional emite con su propio perfil; un admin lo emite a nombre del
  // profesional asignado al paciente (mismo patron que el checkout de B6). El link
  // siempre queda atribuido a un profesional (professional_id es NOT NULL).
  const professionalId =
    (await getProfessionalProfileIdByUser(user.id)) ??
    (await getProfessionalIdForPatient(patientId));
  if (!professionalId) {
    return { error: "El paciente no tiene un profesional asignado.", linkPath: null };
  }

  // RLS: solo devuelve el prefill si el paciente es del profesional.
  const prefill = await getPatientPrefill(patientId);
  if (!prefill) return { error: "Paciente no encontrado.", linkPath: null };

  const result = await emitFollowupLink({
    organizationId: user.organizationId,
    professionalId,
    patientId,
    createdBy: user.id,
    prefill,
  });
  if (!result) return { error: "No se pudo crear el link.", linkPath: null };

  return { error: null, linkPath: `/encuesta/${result.token}` };
}

// Get-or-create del link base (inicial reusable) de consultorio del profesional. ESTABLE: si ya
// existe, devuelve el mismo (no se regenera en cada clic). El professional_id se resuelve del
// usuario autenticado (atribucion por servidor, nunca del form); un admin no tiene perfil
// profesional, asi que no aplica. El indice unico parcial garantiza uno solo por profesional; si
// una request paralela lo crea justo antes, el insert choca (devuelve null) y se re-lee.
export async function getOrCreateBaseSurveyLinkAction(): Promise<BaseSurveyLinkState> {
  const user = await requireUser();
  if (!canManageBaseSurveyLink(user)) return { error: "No autorizado.", linkPath: null };

  const professionalId = await getProfessionalProfileIdByUser(user.id);
  if (!professionalId) {
    return { error: "Tu cuenta no tiene un perfil profesional.", linkPath: null };
  }

  const base = await getOrCreateBaseSurveyLink({
    organizationId: user.organizationId,
    professionalId,
    createdBy: user.id,
  });
  if (!base) return { error: "No se pudo obtener el link de consultorio.", linkPath: null };

  return { error: null, linkPath: `/encuesta/${base.token}` };
}

// Genera el QR del link base de consultorio (ST-I2). Server-side y PII-FREE: el QR codifica SOLO la
// URL absoluta construida con el token OPACO existente (origin/encuesta/<token>); no lleva nombre,
// documento ni professional_id. Reusa el get-or-create (el link es estable). El origin sale de
// NEXT_PUBLIC_APP_URL (el QR se imprime, necesita URL absoluta, no relativa).
export async function generateBaseSurveyQrAction(): Promise<BaseSurveyQrState> {
  const user = await requireUser();
  if (!canManageBaseSurveyLink(user)) return { error: "No autorizado.", qrDataUrl: null };

  const professionalId = await getProfessionalProfileIdByUser(user.id);
  if (!professionalId) {
    return { error: "Tu cuenta no tiene un perfil profesional.", qrDataUrl: null };
  }

  const base = await getOrCreateBaseSurveyLink({
    organizationId: user.organizationId,
    professionalId,
    createdBy: user.id,
  });
  if (!base) return { error: "No se pudo obtener el link de consultorio.", qrDataUrl: null };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!appUrl) return { error: "Falta configurar la URL de la app.", qrDataUrl: null };

  const qrDataUrl = await QRCode.toDataURL(`${appUrl}/encuesta/${base.token}`, {
    width: 320,
    margin: 1,
  });
  return { error: null, qrDataUrl };
}

// (a) El profesional edita/completa la encuesta del paciente ANTES del diagnostico. Recibe las respuestas
// ya estructuradas (el form cliente las arma del FormData). La autorizacion (asignado), el guard
// pre-diagnostico y el audit los hace el writer; aqui solo se resuelve el actor y se traducen los motivos.
export type SurveyEditState = { error: string | null; success: boolean };

const SURVEY_EDIT_ERROR: Record<string, string> = {
  not_assigned: "No estás asignado a este paciente.",
  already_diagnosed:
    "Esta evaluación ya tiene un diagnóstico. Para cambiar una respuesta ahora, usa Corregir la evaluación.",
  not_editable: "Esta evaluación no se puede editar (revisa su estado).",
};

export async function saveSurveyEditAction(input: {
  evaluationId: string;
  answers: { questionId: string; answerValue: string }[];
}): Promise<SurveyEditState> {
  const user = await requireUser();
  const ip = await getClientIp();

  const result = await saveSurveyEdit({
    evaluationId: input.evaluationId,
    actorId: user.id,
    actorEmail: user.email,
    answers: input.answers,
    ip: ip === "unknown" ? null : ip,
  });
  if (!result.ok) return { error: SURVEY_EDIT_ERROR[result.reason] ?? "No se pudo guardar.", success: false };

  revalidatePath(`/evaluaciones/${input.evaluationId}`);
  revalidatePath(`/evaluaciones/${input.evaluationId}/encuesta`);
  return { error: null, success: true };
}
