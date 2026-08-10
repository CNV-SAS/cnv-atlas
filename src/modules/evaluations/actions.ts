"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import QRCode from "qrcode";

import { getClientIp } from "@/core/http/client-ip";
import {
  limitConsentOtpByToken,
  limitSurveyByIp,
  limitSurveyByToken,
} from "@/core/rate-limit";
import { requireUser } from "@/modules/auth/session";
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
import type { ConsentType } from "@/modules/consent/validations";
import { CONSENT_TEXT_V1_5, CONSENT_VERSION } from "@/modules/consent/text/consent-v1.5";
import {
  getProfessionalIdForPatient,
  getProfessionalProfileIdByUser,
} from "@/modules/payments/data/payments-repository";

import {
  getEvaluationOwnership,
  getPatientPrefill,
} from "./data/evaluations-repository";
import {
  confirmEvaluationIdentity,
  ConsentBranchMismatchError,
} from "./data/evaluations-writer";
import { emitFollowupLink } from "./data/survey-links-writer";
import { getActiveSurvey } from "./data/survey-reader";
import { resolveSurveyLinkByToken } from "./data/survey-links-reader";
import {
  canConfirmIdentity,
  canEmitFollowupLink,
  canManageBaseSurveyLink,
} from "./policies/can-manage-evaluations";
import { getOrCreateBaseSurveyLink } from "./services/base-survey-link";
import { submitSurveyIntake } from "./services/survey-intake";
import { otpSendSchema } from "./validations";
import type {
  BaseSurveyLinkState,
  BaseSurveyQrState,
  ConfirmIdentityState,
  FollowupLinkState,
  OtpSendState,
  SurveyFormState,
} from "./validations";

// Lee una casilla del formulario: presente y "on" => true.
function checkbox(form: FormData, name: string): boolean {
  return form.get(name) === "on";
}

function str(form: FormData, name: string): string {
  return (form.get(name) as string | null)?.trim() ?? "";
}

// Server action del envio de la encuesta publica (sin sesion). Orden: rate limit
// (IP y token, agresivo, SECURITY.md) -> resolver el link en servidor (no se confia
// en el cliente) -> orquestar el intake. Al exito redirige a la pantalla de gracias.
export async function submitSurveyAction(
  _prev: SurveyFormState,
  form: FormData,
): Promise<SurveyFormState> {
  const fail = (error: string, fields: Record<string, string> | null = null): SurveyFormState => ({
    error,
    fields,
    done: false,
  });

  const token = str(form, "token");
  if (!token) return fail("Link inválido.");

  // Rate limit agresivo por IP y por token antes de cualquier trabajo.
  const ip = await getClientIp();
  const [byIp, byToken] = await Promise.all([
    limitSurveyByIp(ip),
    limitSurveyByToken(token),
  ]);
  if (!byIp.success || !byToken.success) {
    return fail("Demasiados intentos. Espera unos minutos e intenta de nuevo.");
  }

  // Resolver el link en servidor: el token de la URL es la fuente de verdad, no
  // los campos ocultos del formulario.
  const link = await resolveSurveyLinkByToken(token);
  if (!link) return fail("Este link no esta disponible, ya fue usado o vencio.");

  const survey = await getActiveSurvey();
  if (!survey) return fail("La encuesta no esta disponible en este momento.");

  // Firma electronica (B7): el codigo se verifica en el servicio, atomico con la creacion. Aqui solo
  // se exige que venga (sin codigo no hay firma). Mensaje propio para no confundir "no lo pediste/no lo
  // ingresaste" con "codigo incorrecto" (ese lo da el servicio tras verificar).
  const sessionId = str(form, "otpSessionId");
  const otpCode = str(form, "otpCode");
  if (!sessionId || !otpCode) {
    return fail("Ingresa el código de verificación que enviamos al correo para firmar.");
  }

  // Consentimiento por capas: rama de edad (mayor/menor) + 3 necesarias + 3 opcionales.
  // mayoria_de_edad se deriva de una seleccion EXPLICITA de "mayor" (no de un default):
  // sin seleccion, la rama mayor se rechaza por falta de la declaracion. Los campos del
  // representante van undefined cuando estan vacios para no fallar la validacion de la
  // rama mayor (un correo "" no es un email valido; undefined si es opcional ausente).
  const ageBranchRaw = str(form, "ageBranch");
  const consent = {
    servicio: checkbox(form, "servicio"),
    datos_sensibles: checkbox(form, "datos_sensibles"),
    internacional_ia: checkbox(form, "internacional_ia"),
    investigacion: checkbox(form, "investigacion"),
    comunicaciones_continuidad: checkbox(form, "comunicaciones_continuidad"),
    comunicaciones_comerciales: checkbox(form, "comunicaciones_comerciales"),
    ageBranch: ageBranchRaw === "menor" ? "menor" : "mayor",
    mayoria_de_edad: ageBranchRaw === "mayor",
    legalRepresentativeName: str(form, "legalRepresentativeName") || undefined,
    legalRepresentativeDocument: str(form, "legalRepresentativeDocument") || undefined,
    legalRepresentativeRelationship:
      str(form, "legalRepresentativeRelationship") || undefined,
    legalRepresentativeEmail: str(form, "legalRepresentativeEmail") || undefined,
    minorBirthDate: str(form, "minorBirthDate") || undefined,
    asentimiento_menor: checkbox(form, "asentimiento_menor"),
  };

  const identity = {
    documentType: str(form, "documentType"),
    documentNumber: str(form, "documentNumber"),
    firstName: str(form, "firstName"),
    lastName: str(form, "lastName"),
    birthDate: str(form, "birthDate") || null,
    sex: str(form, "sex") || null,
    country: str(form, "country") || null,
    city: str(form, "city") || null,
    email: str(form, "email") || null,
    phone: str(form, "phone") || null,
  };

  // Respuestas: se toman de las preguntas reales de la version activa (server-side),
  // no de lo que el cliente diga existir. Campos del form: answer_<questionId>. Se guarda
  // el TEXTO de la opcion (option_text), no su id: es lo que compara el motor congelado.
  // Los multi-select llegan como varios valores con el mismo name -> se codifican como
  // JSON (["HTA","Prediabetes"]); build-engine-input los decodifica a array.
  const answers = survey.questions
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

  const result = await submitSurveyIntake({
    link,
    surveyVersionId: survey.surveyVersionId,
    consent,
    identity,
    answers,
    otp: { sessionId, code: otpCode },
    ipAddress: ip === "unknown" ? null : ip,
  });

  if (!result.ok) return fail(result.error.message, result.error.fields ?? null);

  // Copia automatica del consentimiento (B7, dictamen): transparencia, NO requisito de validez. Se
  // envia DESPUES del commit y FUERA del camino de respuesta (after), para no bloquear la pantalla de
  // gracias ni revertir la creacion si el correo falla. El servicio registra el intento (exito/fallo)
  // en la traza y no lanza. Destino: adulto -> paciente; menor -> representante (y el menor si dio correo).
  const acceptedAt = Date.now();
  const grantedForCopy: ConsentType[] = ["servicio", "datos_sensibles", "internacional_ia"];
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

  const patientId = result.value.patientId;
  after(async () => {
    await sendConsentCopy({
      patientId,
      acceptedAt,
      granted: grantedForCopy,
      consentVersion: CONSENT_VERSION,
      consentText: CONSENT_TEXT_V1_5,
      recipients,
    });
  });

  // Exito: a la pantalla de gracias (evita reenvio y el link de seguimiento ya
  // quedo consumido).
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
    // Sin almacen (Upstash) no hay OTP: no se debe dejar pasar la firma en silencio.
    return fail("El servicio de verificación no esta disponible. Intenta más tarde.");
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

  revalidatePath("/evaluaciones");
  return { error: null, confirmed: true };
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
