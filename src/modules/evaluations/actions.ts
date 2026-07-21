"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getClientIp } from "@/core/http/client-ip";
import { limitSurveyByIp, limitSurveyByToken } from "@/core/rate-limit";
import { requireUser } from "@/modules/auth/session";
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
import { createBaseSurveyLink, emitFollowupLink } from "./data/survey-links-writer";
import { getActiveSurvey } from "./data/survey-reader";
import {
  getBaseSurveyLinkForProfessional,
  resolveSurveyLinkByToken,
} from "./data/survey-links-reader";
import {
  canConfirmIdentity,
  canEmitFollowupLink,
  canManageBaseSurveyLink,
} from "./policies/can-manage-evaluations";
import { submitSurveyIntake } from "./services/survey-intake";
import type {
  BaseSurveyLinkState,
  ConfirmIdentityState,
  FollowupLinkState,
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
  if (!token) return fail("Link invalido.");

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
    ipAddress: ip === "unknown" ? null : ip,
  });

  if (!result.ok) return fail(result.error.message, result.error.fields ?? null);

  // Exito: a la pantalla de gracias (evita reenvio y el link de seguimiento ya
  // quedo consumido).
  redirect("/encuesta/gracias");
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
  if (!evaluationId) return { error: "Evaluacion invalida.", confirmed: false };

  const ownership = await getEvaluationOwnership(evaluationId);
  if (!ownership) return { error: "Evaluacion no encontrada.", confirmed: false };
  if (ownership.status !== "draft") {
    return { error: "Esta evaluacion ya fue confirmada.", confirmed: true };
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
  if (!patientId) return { error: "Paciente invalido.", linkPath: null };

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

  let base = await getBaseSurveyLinkForProfessional(professionalId);
  if (!base) {
    base =
      (await createBaseSurveyLink({
        organizationId: user.organizationId,
        professionalId,
        createdBy: user.id,
      })) ?? (await getBaseSurveyLinkForProfessional(professionalId));
  }
  if (!base) return { error: "No se pudo obtener el link de consultorio.", linkPath: null };

  return { error: null, linkPath: `/encuesta/${base.token}` };
}
