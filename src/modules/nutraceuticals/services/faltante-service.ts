import "server-only";

import { businessDaysUntil } from "@/core/dates/colombia-business-days";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
