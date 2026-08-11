import "server-only";

import { businessDaysUntil } from "@/core/dates/colombia-business-days";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  getPendingSobrantes,
  resolveSobrante as writeResolveSobrante,
  type PendingSobrante,
} from "../data/count-writer";

// Servicio de los casos de faltante del propio integrante (T3b-3 ST3). Lectura de sus casos (con el tiempo
// habil que le queda para justificar) y envio de la justificacion (categoria + referencia). Todo por RLS: el
// integrante solo ve/justifica lo suyo. La justificacion es una TRANSICION reportado -> en_revision; el
// trigger valida el estado y proyecta la categoria/referencia al caso.

function nutraName(rel: unknown): string {
  if (Array.isArray(rel)) return (rel[0] as { name?: string } | undefined)?.name ?? "";
  return (rel as { name?: string } | null)?.name ?? "";
}

export type FaltanteCaseRow = {
  id: string;
  nutraceuticalName: string;
  quantity: number;
  sealedTotal: string;
  lote: string | null;
  status: string;
  chargeStatus: string;
  reportedAt: string;
  deadlineAt: string;
  remainingBusinessDays: number; // dias habiles que quedan (0 si vencido)
  justifiable: boolean; // reportado y dentro del plazo
  justificationCategory: string | null;
  justificationReference: string | null;
};

export async function getOwnFaltanteCases(userId: string): Promise<FaltanteCaseRow[] | null> {
  const supabase = await createSupabaseServerClient();
  const { data: prof } = await supabase.from("professional_profiles").select("id").eq("profile_id", userId).maybeSingle();
  if (!prof) return null;

  const { data, error } = await supabase
    .from("nutraceutical_faltante_cases")
    .select("id, quantity, sealed_total, lote, status, charge_status, reported_at, deadline_at, justification_category, justification_reference, nutraceuticals(name)")
    .eq("professional_id", prof.id)
    .order("reported_at", { ascending: false });
  if (error) throw new Error(`faltante-service: cases: ${error.message}`);

  const now = new Date();
  return (data ?? []).map((c) => {
    const deadline = new Date(c.deadline_at);
    const remaining = businessDaysUntil(now, deadline);
    return {
      id: c.id,
      nutraceuticalName: nutraName(c.nutraceuticals),
      quantity: c.quantity,
      sealedTotal: String(c.sealed_total),
      lote: c.lote,
      status: c.status,
      chargeStatus: c.charge_status,
      reportedAt: c.reported_at,
      deadlineAt: c.deadline_at,
      remainingBusinessDays: remaining,
      justifiable: c.status === "reportado" && now <= deadline,
      justificationCategory: c.justification_category,
      justificationReference: c.justification_reference,
    };
  });
}

// Envia la justificacion del integrante: transicion reportado -> en_revision con categoria + referencia. La
// referencia es OBLIGATORIA (la valida el schema). Rechaza si el caso no es justificable (no reportado, o
// vencido el plazo): un caso vencido ya no se justifica, lo cierra CNV.
export async function submitJustification(input: {
  userId: string;
  caseId: string;
  category: "hurto_denuncia" | "transporte_documentado" | "venta_no_registrada" | "devolucion_guia";
  reference: string;
}): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: c } = await supabase
    .from("nutraceutical_faltante_cases")
    .select("status, deadline_at")
    .eq("id", input.caseId)
    .maybeSingle();
  if (!c) return { ok: false, message: "Caso no encontrado." };
  if (c.status !== "reportado") return { ok: false, message: "Este caso ya no está esperando tu justificación." };
  if (new Date() > new Date(c.deadline_at)) {
    return { ok: false, message: "El plazo para justificar venció. El caso pasa a revisión de CNV." };
  }

  const { error } = await supabase.from("nutraceutical_faltante_transitions").insert({
    case_id: input.caseId,
    from_status: "reportado",
    to_status: "en_revision",
    justification_category: input.category,
    justification_reference: input.reference,
    actor_id: input.userId,
  });
  if (error) return { ok: false, message: "No se pudo enviar la justificación." };
  return { ok: true };
}

// ----- Lado CNV (T3b-3 ST4): cola de clasificacion. admin PROPONE injustificado; direccion CONFIRMA. -----

type FaltanteStatus =
  | "reportado"
  | "en_revision"
  | "justificado"
  | "venta_no_registrada"
  | "injustificado_pendiente"
  | "injustificado";

function relName(rel: unknown): string {
  // professional_profiles(profiles(full_name)) llega anidado; se resuelve defensivo (objeto o arreglo).
  const pp = Array.isArray(rel) ? rel[0] : rel;
  const prof = (pp as { profiles?: unknown } | null)?.profiles;
  const p = Array.isArray(prof) ? prof[0] : prof;
  return (p as { full_name?: string } | null)?.full_name ?? "";
}

export type FaltanteQueueRow = {
  id: string;
  nutraceuticalName: string;
  integranteName: string;
  quantity: number;
  sealedTotal: string;
  lote: string | null;
  status: string;
  reportedAt: string;
  deadlineAt: string;
  expired: boolean; // reportado con el plazo vencido: ya se puede clasificar sin esperar
  reincidencia: number; // injustificados de ese integrante en los ultimos 6 meses (contexto para clasificar)
  justificationCategory: string | null;
  justificationReference: string | null;
};

// La cola segun el rol: admin ve lo que espera CLASIFICACION (en_revision + reportado vencido); direccion ve
// lo que espera su CONFIRMACION (injustificado_pendiente). La RLS ya deja a CNV ver todos los casos.
export async function getFaltanteQueue(roles: { admin: boolean; direccion: boolean }): Promise<FaltanteQueueRow[]> {
  const statuses: FaltanteStatus[] = [];
  if (roles.admin) statuses.push("en_revision", "reportado");
  if (roles.direccion) statuses.push("injustificado_pendiente");
  if (statuses.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("nutraceutical_faltante_cases")
    .select("id, professional_id, quantity, sealed_total, lote, status, reported_at, deadline_at, justification_category, justification_reference, nutraceuticals(name), professional_profiles(profiles!profile_id(full_name))")
    .in("status", statuses)
    .order("reported_at", { ascending: true });
  if (error) throw new Error(`faltante-service: queue: ${error.message}`);

  // Reincidencia: injustificados por integrante en los ultimos 6 meses (una consulta, mapa por profesional).
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const { data: rein } = await supabase
    .from("nutraceutical_faltante_cases")
    .select("professional_id")
    .eq("status", "injustificado")
    .gte("reported_at", sixMonthsAgo.toISOString());
  const reinMap = new Map<string, number>();
  for (const r of rein ?? []) reinMap.set(r.professional_id, (reinMap.get(r.professional_id) ?? 0) + 1);

  const now = new Date();
  return (data ?? []).map((c) => ({
    id: c.id,
    nutraceuticalName: nutraName(c.nutraceuticals),
    integranteName: relName(c.professional_profiles),
    quantity: c.quantity,
    sealedTotal: String(c.sealed_total),
    lote: c.lote,
    status: c.status,
    reportedAt: c.reported_at,
    deadlineAt: c.deadline_at,
    expired: c.status === "reportado" && now > new Date(c.deadline_at),
    reincidencia: reinMap.get(c.professional_id) ?? 0,
    justificationCategory: c.justification_category,
    justificationReference: c.justification_reference,
  }));
}

async function insertTransition(
  caseId: string,
  from: FaltanteStatus,
  to: FaltanteStatus,
  actorId: string,
  reason: string | null,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("nutraceutical_faltante_transitions").insert({
    case_id: caseId,
    from_status: from,
    to_status: to,
    reason,
    actor_id: actorId,
  });
  if (error) return { ok: false, message: "No se pudo registrar la decisión." };
  return { ok: true };
}

// admin CLASIFICA un caso en revision (o reportado vencido). "injustificado" NO cobra: propone
// (injustificado_pendiente); el cobro lo materializa direccion al confirmar.
export async function classifyFaltante(input: {
  userId: string;
  caseId: string;
  decision: "justificado" | "venta_no_registrada" | "injustificado";
  reason: string | null;
}): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: c } = await supabase
    .from("nutraceutical_faltante_cases")
    .select("status, deadline_at")
    .eq("id", input.caseId)
    .maybeSingle();
  if (!c) return { ok: false, message: "Caso no encontrado." };

  const expiredReportado = c.status === "reportado" && new Date() > new Date(c.deadline_at);
  if (input.decision === "injustificado") {
    if (c.status !== "en_revision" && !expiredReportado) {
      return { ok: false, message: "Solo se propone injustificado sobre un caso justificado a revisión o con el plazo vencido." };
    }
    return insertTransition(input.caseId, c.status, "injustificado_pendiente", input.userId, input.reason);
  }
  // justificado / venta_no_registrada: requieren una justificacion enviada (en_revision).
  if (c.status !== "en_revision") {
    return { ok: false, message: "Este caso no está esperando clasificación." };
  }
  return insertTransition(input.caseId, "en_revision", input.decision, input.userId, input.reason);
}

// direccion CONFIRMA o RECHAZA la propuesta de injustificado. Confirmar materializa el cargo; rechazar lo
// cierra sin cargo (dirección puede vetar el cobro). Nada se materializa hasta este paso: dos personas.
export async function confirmFaltante(input: {
  userId: string;
  caseId: string;
  decision: "confirmar" | "rechazar";
  reason: string | null;
}): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: c } = await supabase
    .from("nutraceutical_faltante_cases")
    .select("status")
    .eq("id", input.caseId)
    .maybeSingle();
  if (!c) return { ok: false, message: "Caso no encontrado." };
  if (c.status !== "injustificado_pendiente") {
    return { ok: false, message: "Este caso no está esperando confirmación de dirección." };
  }
  const to = input.decision === "confirmar" ? "injustificado" : "justificado";
  return insertTransition(input.caseId, "injustificado_pendiente", to, input.userId, input.reason);
}

// ----- Sobrante (T3b-3 ST5): pasarela al writer de conteo (Drizzle owner). Lo autoriza la action (admin). -----
export { getPendingSobrantes };
export type { PendingSobrante };

export async function resolveSobrante(input: {
  userId: string;
  countLineId: string;
  reason: string;
}): Promise<{ ok: boolean; message?: string }> {
  return writeResolveSobrante({ countLineId: input.countLineId, actorId: input.userId, reason: input.reason });
}
