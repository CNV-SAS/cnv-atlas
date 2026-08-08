import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { ReferralTargetValue } from "../validations";

// Lecturas de remisiones (regla 1). Cliente anon + RLS: las policies de `referrals` y `treatments`
// (`is_patient_professional`) filtran, asi que si una lectura devuelve fila, el actor ES el profesional
// del paciente AHORA. Eso ademas es el gate de pertenencia antes de escribir: sin fila -> null -> forbidden.

function one<T>(embed: T | T[] | null | undefined): T | undefined {
  return Array.isArray(embed) ? embed[0] : (embed ?? undefined);
}

// Resuelve el paciente de un TRATAMIENTO (para registrar una remision anclada a el). null si la sesion
// no puede ver el tratamiento (no es del profesional): la RLS de treatments ya gatea la pertenencia.
export async function getTreatmentPatient(treatmentId: string): Promise<{ patientId: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("treatments")
    .select("id, diagnoses!inner(evaluations!inner(patient_id))")
    .eq("id", treatmentId)
    .maybeSingle();
  if (error) throw new Error(`referrals-reader: getTreatmentPatient: ${error.message}`);
  if (!data) return null;
  const diag = one(data.diagnoses as { evaluations: unknown } | { evaluations: unknown }[] | null);
  const evalRow = one(diag?.evaluations as { patient_id: string } | { patient_id: string }[] | null);
  const patientId = evalRow?.patient_id;
  return patientId ? { patientId } : null;
}

// Confirma que la sesion puede ver una remision (es el profesional del paciente AHORA). Gate de pertenencia
// para marcar el retorno; devuelve si ya tiene retorno (para no reintentar el write-once).
export async function getReferralOwnership(
  referralId: string,
): Promise<{ alreadyReturned: boolean } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("referrals")
    .select("id, returned_at")
    .eq("id", referralId)
    .maybeSingle();
  if (error) throw new Error(`referrals-reader: getReferralOwnership: ${error.message}`);
  if (!data) return null;
  return { alreadyReturned: data.returned_at != null };
}

export type PatientReferral = {
  id: string;
  referredTo: ReferralTargetValue;
  referredToOther: string | null;
  reason: string;
  referredAt: string;
  returnedAt: string | null;
  returnNotes: string | null;
  // De QUE consulta salio la remision (via treatment -> diagnosis -> evaluation): con varias consultas y
  // varias remisiones, sin esto la lista no se lee. null solo si el embed no resolvio (dato viejo).
  sourceEvaluationType: "inicial" | "seguimiento" | null;
  sourceEvaluationDate: string | null;
};

// Remisiones de un paciente (para la lista donde se marca el retorno). Por patient_id: SOBREVIVEN a las
// correcciones (el treatment vigente cambia; el acto queda). Mas recientes primero. RLS filtra a las del
// profesional del paciente (y admin). Trae el tipo y fecha de la evaluacion de origen (treatment_id no cambia
// aunque el treatment vigente si; el ancla es fiel al acto).
export async function listPatientReferrals(patientId: string): Promise<PatientReferral[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("referrals")
    .select(
      "id, referred_to, referred_to_other, reason, referred_at, returned_at, return_notes, treatments!inner(diagnoses!inner(evaluations!inner(type, created_at)))",
    )
    .eq("patient_id", patientId)
    .order("referred_at", { ascending: false });
  if (error) throw new Error(`referrals-reader: listPatientReferrals: ${error.message}`);
  return (data ?? []).map((r) => {
    const treatment = one(r.treatments as { diagnoses: unknown } | { diagnoses: unknown }[] | null);
    const diag = one(treatment?.diagnoses as { evaluations: unknown } | { evaluations: unknown }[] | null);
    const evalRow = one(
      diag?.evaluations as
        | { type: string; created_at: string }
        | { type: string; created_at: string }[]
        | null,
    );
    return {
      id: r.id,
      referredTo: r.referred_to as ReferralTargetValue,
      referredToOther: r.referred_to_other,
      reason: r.reason,
      referredAt: r.referred_at,
      returnedAt: r.returned_at,
      returnNotes: r.return_notes,
      sourceEvaluationType:
        evalRow?.type === "inicial" || evalRow?.type === "seguimiento" ? evalRow.type : null,
      sourceEvaluationDate: evalRow?.created_at ?? null,
    };
  });
}

export type PendingReferralHint = {
  referredTo: ReferralTargetValue;
  referredToOther: string | null;
  referredAt: string;
};

// Remisiones PENDIENTES de retorno del paciente de un tratamiento, para avisar al registrar una repetida
// (aviso suave: aqui el riesgo es desorden en el registro, no un doble cobro como en nutraceuticos; no
// bloquea, solo advierte). Resuelve el paciente via la RLS del treatment (misma pertenencia que el registro).
export async function getPendingReferralHints(treatmentId: string): Promise<PendingReferralHint[]> {
  const ctx = await getTreatmentPatient(treatmentId);
  if (!ctx) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("referrals")
    .select("referred_to, referred_to_other, referred_at")
    .eq("patient_id", ctx.patientId)
    .is("returned_at", null)
    .order("referred_at", { ascending: false });
  if (error) throw new Error(`referrals-reader: getPendingReferralHints: ${error.message}`);
  return (data ?? []).map((r) => ({
    referredTo: r.referred_to as ReferralTargetValue,
    referredToOther: r.referred_to_other,
    referredAt: r.referred_at,
  }));
}
