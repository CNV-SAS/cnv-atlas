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
