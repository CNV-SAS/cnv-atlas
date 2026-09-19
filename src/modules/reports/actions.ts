"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getClientIp } from "@/core/http/client-ip";
import { limitReportSendByUser } from "@/core/rate-limit";
import { requireUser } from "@/modules/auth/session";

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
const resendReasonSchema = z
  .string()
  .trim()
  .min(3, "Escribe el motivo del reenvío.")
  .max(300, "El motivo es demasiado largo.");

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
