"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getClientIp } from "@/core/http/client-ip";
import { limitReportSendByUser } from "@/core/rate-limit";
import { requireUser } from "@/modules/auth/session";
import { getActorProfession } from "@/modules/treatment/data/actor-profession-reader";

import { getReportDispatch } from "./data/reports-repository";
import { emitirVersionNueva, ReportStateError } from "./data/reports-writer";
import { getHistoriaClinicaSoap } from "./data/hc-soap-reader";
import { escribirNotaSubjetiva } from "./data/soap-notas-writer";
import { entregarHistoriaClinica } from "./services/entregar-hc";
import { canManageReports } from "./policies/can-manage-reports";
import { resendReport, sendReport } from "./services/send-report";

// Estado de los botones (useActionState). Forma FormToastState para el toast.
export type ReportActionState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};

const fail = (error: string): ReportActionState => ({ error, success: null, warning: null });

function reportIdOf(form: FormData): string {
  return (form.get("reportId") as string | null)?.trim() ?? "";
}

// LAS DOS ACCIONES DE LA CEREMONIA SE RETIRARON (2026-09-18): `approveReportAction` y
// `confirmTrajectoryCommunicationAction`. El reporte es una hoja mas: se ve, se imprime, se envia. El freno
// del cambio desfavorable vive ahora en la entrega (`freno-de-trayectoria`), asi que la regla clinica sigue
// en pie sin pedirle al profesional dos pulsaciones previas. Ver `reports-writer` para el porque completo.

// Envia el reporte al paciente (render -> Storage -> correo -> marcar enviado). Rate
// limit por usuario para no saturar Resend.
export async function sendReportAction(
  _prev: ReportActionState,
  form: FormData,
): Promise<ReportActionState> {
  const user = await requireUser();
  if (!canManageReports(user)) return fail("No autorizado.");
  const reportId = reportIdOf(form);
  if (!reportId) return fail("Reporte inválido.");

  // EL MODO SE RETIRO (2026-09-18): los tres ("Atlas", "solo mis notas", "ambos") existian para elegir entre
  // el reporte y unas notas que ya no se escriben. El servicio decide solo: si el profesional dejo su
  // observacion de la consulta, viaja con el reporte; si no, va el reporte solo.

  const rl = await limitReportSendByUser(user.id);
  if (!rl.success) return fail("Has enviado demasiados reportes. Espera unos minutos.");

  const ip = await getClientIp();
  const result = await sendReport({
    reportId,
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });
  if (!result.ok) return fail(result.error.message);

  revalidatePath("/ani-bis-e");
  // La hoja del reporte vive dentro de la evaluacion: se revalida la ruta dinamica para que el estado
  // (sin enviar -> enviado) se refresque alli.
  revalidatePath("/ani-bis-e/[id]", "page");
  // /reportes ya no esta en el menu, pero la ruta sigue viva como registro; se revalida para que el
  // historico no muestre un estado viejo a quien llegue por enlace.
  revalidatePath("/reportes");
  return {
    error: null,
    success: "Reporte enviado al paciente.",
    warning: null,
  };
}

// Motivo del reenvio: obligatorio y corto. Obligatorio porque un documento clinico que sale dos veces
// deja rastro de por que; corto porque no es una nota clinica, es una razon operativa ("el correo rebotó",
// "corrigieron la dirección"). Tope de tamaño como toda entrada externa (regla de validacion).
// OPCIONAL desde el 2026-09-19: la pantalla ya no lo pide (reenviar es confirmar y listo). El esquema se
// queda porque la action sigue aceptandolo si algun dia vuelve a haber un sitio donde escribirlo, y el
// tope de tamano es la regla de toda entrada externa.
const resendReasonSchema = z
  .string()
  .trim()
  .max(300, "El motivo es demasiado largo.")
  .nullish()
  .transform((v) => (v && v.length > 0 ? v : null));

export async function resendReportAction(
  _prev: ReportActionState,
  form: FormData,
): Promise<ReportActionState> {
  const user = await requireUser();
  if (!canManageReports(user)) return fail("No autorizado.");
  const reportId = reportIdOf(form);
  if (!reportId) return fail("Reporte inválido.");

  const parsed = resendReasonSchema.safeParse((form.get("reason") as string | null) ?? "");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Motivo inválido.");

  // Mismo limite que el envio: un reenvio manda un correo igual que el primero.
  const rl = await limitReportSendByUser(user.id);
  if (!rl.success) return fail("Has enviado demasiados reportes. Espera unos minutos.");

  const ip = await getClientIp();
  const result = await resendReport({
    reportId,
    reason: parsed.data,
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });
  if (!result.ok) return fail(result.error.message);

  revalidatePath("/ani-bis-e");
  revalidatePath("/ani-bis-e/[id]", "page");
  revalidatePath("/reportes");
  return {
    error: null,
    success: `Se reenvió el mismo documento al paciente (reenvío ${result.value.attempt}).`,
    warning: null,
  };
}

// ENTREGARLE LA HISTORIA CLINICA AL PACIENTE (derecho de acceso, Resolucion 1995 / Ley 1581).
//
// LA POLICY ES `canManageReports` y no una nueva: entregar la historia es la misma familia de acto que
// enviarle el reporte, sobre el mismo paciente y por el mismo canal. Una policy nueva para el mismo
// permiso seria un segundo sitio donde decidir lo mismo, que es como se desincronizan.
//
// NO REVALIDA la ruta: el refresco lo hace el cliente tras el aviso (misma razon que en el resto, el
// revalidate arrastra la pagina al inicio y desmonta el form antes de que el toast se vea).
export async function entregarHistoriaClinicaAction(
  _prev: ReportActionState,
  form: FormData,
): Promise<ReportActionState> {
  const user = await requireUser();
  if (!canManageReports(user)) return fail("No autorizado.");
  const evaluationId = (form.get("evaluationId") as string | null)?.trim() ?? "";
  if (!evaluationId) return fail("Evaluación inválida.");

  const ip = await getClientIp();
  const result = await entregarHistoriaClinica({
    evaluationId,
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });
  if (!result.ok) return fail(result.error.message);

  return {
    error: null,
    // Se dice A DONDE se envio: "enviada" a secas deja al profesional sin saber si fue al correo correcto.
    success: `Historia clínica enviada a ${result.value.enviadaA}. Queda registrada la entrega.`,
    warning: null,
  };
}

// EMITIR UNA VERSIÓN NUEVA del informe (2026-09-19). Es la tercera salida, y la que faltaba: reenviar
// manda el mismo documento, corregir rehace la cadena porque un dato estaba mal, y esta manda el MISMO
// diagnóstico con lo que cambió después (una observación escrita tras el envío, un plan ajustado).
//
// Rate limit compartido con el envío: emitir sin enviar no cuesta nada, pero esta acción existe para
// mandar, y quien la pulsa en serie está mandando correos en serie.
export async function emitirVersionNuevaAction(
  _prev: ReportActionState,
  form: FormData,
): Promise<ReportActionState> {
  const user = await requireUser();
  if (!canManageReports(user)) return fail("No autorizado.");
  const reportId = reportIdOf(form);
  if (!reportId) return fail("Informe inválido.");

  // La ownership se verifica leyendo el informe bajo RLS antes de escribir (regla dura 3).
  const dispatch = await getReportDispatch(reportId);
  if (!dispatch) return fail("Informe no encontrado.");

  const ip = await getClientIp();
  try {
    await emitirVersionNueva({
      reportId,
      actorId: user.id,
      actorEmail: user.email,
      ip: ip === "unknown" ? null : ip,
    });
  } catch (e) {
    if (e instanceof ReportStateError) return fail(e.message);
    throw e;
  }

  // NO REVALIDA: el refresco lo hace la PANTALLA (`useFormToastAndRefresh` en la tarjeta), porque aqui el
  // documento que la tarjeta muestra CAMBIA (pasa a ser la version nueva, en borrador) y sin refrescar
  // seguiria ofreciendo reenviar algo que ya no es lo vigente. Uno de los dos, nunca los dos: con
  // revalidate + refresh son dos ciclos que montan segmentos, o sea dos saltos al inicio y un formulario
  // que se desmonta antes de que se vea el aviso (candado `refresco-una-sola-vez`).
  return {
    error: null,
    success: "Versión nueva lista. Revísala y envíasela al paciente.",
    warning: null,
  };
}

// ESCRIBIR LA ANAMNESIS DEL APARTADO S (2026-09-20). Es lo que el paciente contó en consulta y no estaba
// en la encuesta: lo único del apartado Subjetivo que no puede salir de un formulario.
//
// APPEND-ONLY: no hay editar ni borrar. Corregirse es escribir otra, y las dos quedan (decisión de
// Gildardo para las notas clínicas, §8).
//
// LA PROFESIÓN SE SELLA EN EL ACTO, como en las demás notas clínicas: quien escribe puede cambiar de rol
// después, y el documento tiene que seguir diciendo desde qué profesión se asumió esta anamnesis.
const notaSubjetivaSchema = z
  .string()
  .trim()
  .min(3, "Escribe la anamnesis antes de guardarla.")
  .max(4000, "La nota es demasiado larga.");

export async function agregarNotaSubjetivaAction(
  _prev: ReportActionState,
  form: FormData,
): Promise<ReportActionState> {
  const user = await requireUser();
  if (!canManageReports(user)) return fail("No autorizado.");
  const evaluationId = (form.get("evaluationId") as string | null)?.trim() ?? "";
  if (!evaluationId) return fail("Evaluación inválida.");

  const parsed = notaSubjetivaSchema.safeParse((form.get("nota") as string | null) ?? "");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Nota inválida.");

  // La ownership se verifica leyendo el documento bajo RLS antes de escribir (regla dura 3): si la
  // evaluación no es suya, sus lectores no la alcanzan y aquí es indistinguible de que no exista.
  const soap = await getHistoriaClinicaSoap(evaluationId);
  if (!soap) return fail("Esta evaluación no tiene historia clínica.");

  const { profession } = await getActorProfession(user.id);
  const ip = await getClientIp();
  await escribirNotaSubjetiva({
    evaluationId,
    nota: parsed.data,
    actorId: user.id,
    actorEmail: user.email,
    profesion: profession,
    ip: ip === "unknown" ? null : ip,
  });

  // No revalida: el refresco lo hace la pantalla tras el aviso (candado `refresco-una-sola-vez`).
  return { error: null, success: "Anamnesis agregada.", warning: null };
}
