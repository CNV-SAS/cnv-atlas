import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { type CorrectionChain, type CorrectionEdge, chainContaining } from "../correction-chain";

// Historial de correcciones de una evaluacion (CP2 de PLAN_S2_CORRECCION): la cadena v1->v2->v3 con el
// MOTIVO, quien y cuando de cada salto. Se ve DESDE LA VIGENTE y desde las viejas (el SupersededBanner
// solo apunta hacia adelante; esto muestra lo que hubo antes). CorrectionChain/CorrectionEdge viven en el
// modulo neutro `correction-chain` (puro, testeable sin BD); se re-exportan para el server.
export type { CorrectionChain, CorrectionEdge } from "../correction-chain";

// Un solo FK a profiles (corrected_by), asi que el embed no es ambiguo; el hint `corrected_by` lo deja
// explicito. RLS acota a las correcciones del propio profesional; el armado de la cadena en memoria
// ignora aristas de otras cadenas. Orden por fecha para estabilidad (el armado no depende del orden).
const SELECT =
  "old_evaluation_id, new_evaluation_id, reason, trigger_type, created_at, profiles!corrected_by(full_name)";

type Row = {
  old_evaluation_id: string;
  new_evaluation_id: string;
  reason: string;
  trigger_type: string;
  created_at: string;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

function mapRow(r: Row): CorrectionEdge {
  const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
  return {
    oldEvaluationId: r.old_evaluation_id,
    newEvaluationId: r.new_evaluation_id,
    reason: r.reason,
    triggerType: r.trigger_type,
    createdAt: r.created_at,
    correctedByName: prof?.full_name ?? "(sin nombre)",
  };
}

export async function getCorrectionChain(evaluationId: string): Promise<CorrectionChain> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clinical_corrections")
    .select(SELECT)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`correction-history-reader: ${error.message}`);
  return chainContaining(evaluationId, (data ?? []).map((r) => mapRow(r as Row)));
}
