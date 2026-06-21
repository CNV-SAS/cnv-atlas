"use server";

import { redirect } from "next/navigation";

import { getClientIp } from "@/core/http/client-ip";
import { limitSurveyByIp, limitSurveyByToken } from "@/core/rate-limit";

import { getActiveSurvey } from "./data/survey-reader";
import { resolveSurveyLinkByToken } from "./data/survey-links-reader";
import { submitSurveyIntake } from "./services/survey-intake";
import type { SurveyFormState } from "./validations";

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

  // Consentimiento por capas: 3 necesarias + mayoria de edad + 3 opcionales.
  const consent = {
    servicio: checkbox(form, "servicio"),
    datos_sensibles: checkbox(form, "datos_sensibles"),
    internacional_ia: checkbox(form, "internacional_ia"),
    investigacion: checkbox(form, "investigacion"),
    comunicaciones_continuidad: checkbox(form, "comunicaciones_continuidad"),
    comunicaciones_comerciales: checkbox(form, "comunicaciones_comerciales"),
    mayoria_de_edad: checkbox(form, "mayoria_de_edad"),
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
  // no de lo que el cliente diga existir. Campos del form: answer_<questionId>.
  const answers = survey.questions
    .map((q) => ({ questionId: q.id, answerValue: str(form, `answer_${q.id}`) }))
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
