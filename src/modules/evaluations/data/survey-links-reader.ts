import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROFESSION_LABELS } from "@/modules/auth/admin-validations";

import { isLinkUsable } from "../services/survey-link-service";
import type { SignIdentityPrefill, SurveyLinkView } from "../types";

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

// Version del consentimiento VIGENTE del paciente (la del `servicio` activo, revoked_at IS NULL). La usa la
// pagina publica del SEGUIMIENTO para decidir si un cambio SUSTANTIVO de version obliga a re-firmar
// (requiresReconsent). Via service role (superficie publica: el token del link, patient-specific y de un solo
// uso, ya probo al paciente). null si no tiene 'servicio' vigente (caso anomalo; la pagina lo trata como que
// necesita firma, conservador). NO gatea aqui: el gate real (regla 15) corre en el writer, antes de crear.
export async function getHeldConsentVersion(patientId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("patient_consents")
    .select("consent_version")
    .eq("patient_id", patientId)
    .eq("consent_type", "servicio")
    .is("revoked_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(`survey-links-reader: getHeldConsentVersion: ${error.message}`);
  }
  return data?.consent_version ?? null;
}

// Prefill COMPLETO de identidad para el camino CON firma de un SEGUIMIENTO (excepcion o bump sustantivo): el
// paciente ya existe, asi que se le prellenan todos los campos para que solo confirme (Santiago §5b). Se lee
// FRESCO via service role (autorizado por el token del link, patient-specific y de un solo uso); NO se guarda
// en el link (el prefill del link es a proposito solo cuasi-identificadores, sin nombre ni documento, por
// privacidad: ver SurveyLinkPrefill). Asi el prefill completo no queda persistido en el link. null si no existe.
export async function getFollowupIdentityPrefill(
  patientId: string,
): Promise<SignIdentityPrefill | null> {
  const supabase = createSupabaseAdminClient();
  const [{ data: patient }, { data: profile }, { data: contact }] = await Promise.all([
    supabase.from("patients").select("document_type, document_number").eq("id", patientId).maybeSingle(),
    supabase
      .from("patient_profiles")
      .select("first_name, last_name, birth_date, sex, country, city")
      .eq("patient_id", patientId)
      .maybeSingle(),
    supabase.from("patient_contacts").select("email, phone").eq("patient_id", patientId).maybeSingle(),
  ]);
  if (!patient || !profile) return null;
  return {
    documentType: patient.document_type ?? null,
    documentNumber: patient.document_number ?? null,
    firstName: profile.first_name ?? null,
    lastName: profile.last_name ?? null,
    birthDate: profile.birth_date ?? null,
    sex: profile.sex ?? null,
    country: profile.country ?? null,
    city: profile.city ?? null,
    email: contact?.email ?? null,
    phone: contact?.phone ?? null,
  };
}

// Datos del profesional asignado que se muestran en el bloque del profesional del consentimiento
// (numeral 2): nombre, profesion (etiqueta) y registro. Es divulgacion INTENCIONAL al paciente (el
// consentimiento debe identificar al responsable clinico). Via service role (superficie publica, sin
// sesion, como el resolver del link). registro puede venir null: el bloque omite esa linea.
export type ConsentProfessional = { fullName: string; profession: string; license: string | null };

export async function getProfessionalForConsent(
  professionalId: string,
): Promise<ConsentProfessional | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("professional_profiles")
    // Hint OBLIGATORIO del FK: professional_profiles tiene TRES relaciones a profiles (profile_id,
    // rut_verified_by, rut_rejected_by), asi que un embed sin hint es AMBIGUO y revienta en runtime (no en
    // tsc). El nombre del profesional sale por profile_id. Ver CLAUDE.md (segunda relacion FK ambigua).
    .select("license, profession, profiles!profile_id!inner(full_name)")
    .eq("id", professionalId)
    .maybeSingle();
  if (error) {
    throw new Error(`survey-links-reader: getProfessionalForConsent: ${error.message}`);
  }
  if (!data) return null;
  const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
  return {
    fullName: (profile?.full_name as string) ?? "",
    profession: PROFESSION_LABELS[data.profession as keyof typeof PROFESSION_LABELS] ?? data.profession,
    license: (data.license as string | null) ?? null,
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
