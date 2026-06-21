import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { isLinkUsable } from "../services/survey-link-service";
import type { SurveyLinkView } from "../types";

// Resuelve el token opaco de la URL de la encuesta para la pagina publica (sin
// sesion). Via service role (BYPASSA RLS): es una superficie publica legitima
// (SECURITY.md). Solo devuelve el link si sigue usable (no consumido, no vencido);
// nunca expone el token ni datos de mas.
export async function resolveSurveyLinkByToken(
  token: string,
): Promise<SurveyLinkView | null> {
  if (!token) return null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("survey_links")
    .select(
      "id, organization_id, professional_id, type, patient_id, prefill, expires_at, consumed_at",
    )
    .eq("token", token)
    .maybeSingle();
  if (error) {
    throw new Error(`survey-links-reader: resolveSurveyLinkByToken: ${error.message}`);
  }
  if (!data) return null;
  if (!isLinkUsable({ consumedAt: data.consumed_at, expiresAt: data.expires_at }, Date.now())) {
    return null;
  }
  return {
    id: data.id,
    organizationId: data.organization_id,
    professionalId: data.professional_id,
    type: data.type,
    patientId: data.patient_id,
    prefill: (data.prefill as SurveyLinkView["prefill"]) ?? null,
  };
}
