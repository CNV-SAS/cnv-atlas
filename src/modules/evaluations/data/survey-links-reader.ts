import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

// Lee el link base (inicial reusable) del profesional: el "link de consultorio" fijo que se
// comparte como QR. Va por el cliente con sesion (RLS survey_links_select solo devuelve los links
// del profesional dueno). El indice unico parcial garantiza a lo sumo uno, asi que maybeSingle es
// seguro. No lleva PII (patient_id/prefill null). Solo display.
export async function getBaseSurveyLinkForProfessional(
  professionalId: string,
): Promise<{ token: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("survey_links")
    .select("token")
    .eq("professional_id", professionalId)
    .eq("type", "inicial")
    .is("patient_id", null)
    .maybeSingle();
  if (error) {
    throw new Error(`survey-links-reader: getBaseSurveyLinkForProfessional: ${error.message}`);
  }
  return data ? { token: data.token } : null;
}
