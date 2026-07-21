import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { followupExpiry, generateOpaqueToken } from "../services/survey-link-service";

// Emision de un link de seguimiento por el profesional. Va por el cliente con sesion
// (RLS): survey_links_insert valida con WITH CHECK que el professional_id sea el del
// profesional autenticado. De un solo uso, atado al paciente, con colchon de 30 dias.

export type EmitFollowupInput = {
  organizationId: string;
  professionalId: string;
  patientId: string;
  createdBy: string;
  prefill: { city: string | null; phone: string | null };
};

export async function emitFollowupLink(
  input: EmitFollowupInput,
): Promise<{ token: string } | null> {
  const supabase = await createSupabaseServerClient();
  const token = generateOpaqueToken();
  const expiresAt = followupExpiry(Date.now()).toISOString();
  const { error } = await supabase.from("survey_links").insert({
    organization_id: input.organizationId,
    professional_id: input.professionalId,
    type: "seguimiento",
    token,
    patient_id: input.patientId,
    prefill: input.prefill,
    expires_at: expiresAt,
    created_by: input.createdBy,
  });
  if (error) return null; // RLS lo rechaza si el professional_id no es del usuario
  return { token };
}

export type CreateBaseLinkInput = {
  organizationId: string;
  professionalId: string;
  createdBy: string;
};

// Crea el link base (inicial reusable) del profesional: token opaco, sin PII, sin expiracion ni
// consumo (patient_id/prefill/expires_at/consumed_at quedan null). Va por el cliente con sesion
// (survey_links_insert valida con WITH CHECK el professional_id). Devuelve null si choca con el
// indice unico parcial (otra request lo creo primero) o si la RLS lo rechaza; el llamador re-lee
// para resolver la carrera.
export async function createBaseSurveyLink(
  input: CreateBaseLinkInput,
): Promise<{ token: string } | null> {
  const supabase = await createSupabaseServerClient();
  const token = generateOpaqueToken();
  const { error } = await supabase.from("survey_links").insert({
    organization_id: input.organizationId,
    professional_id: input.professionalId,
    type: "inicial",
    token,
    created_by: input.createdBy,
  });
  if (error) return null;
  return { token };
}
