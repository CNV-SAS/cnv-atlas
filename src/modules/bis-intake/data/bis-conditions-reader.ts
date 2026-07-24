import "server-only";

import { normalizeSexo } from "@/clinical-engine/edge/normalize";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { BisConditionAnswers, BisConditionCatalog, BisIntakeRecord } from "../types";

type ProfileEmbed = { sex: string | null };
type PatientEmbed = { patient_profiles: ProfileEmbed | ProfileEmbed[] | null };
function one<T>(embed: T | T[] | null): T | undefined {
  return Array.isArray(embed) ? embed[0] : (embed ?? undefined);
}

// Sexo canonico del paciente de una evaluacion (RLS), para decidir si se muestra el bloque
// femenino de la captura. null si no se resuelve (dato ausente/desconocido): en ese caso la UI no
// muestra el bloque femenino, pero el bloque general (incluido el marcapasos) sigue.
export async function getEvaluationPatientSex(
  evaluationId: string,
): Promise<"M" | "F" | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluations")
    .select("patients!inner(patient_profiles!inner(sex))")
    .eq("id", evaluationId)
    .maybeSingle();
  if (error) throw new Error(`bis-conditions-reader: patientSex: ${error.message}`);
  const patient = one<PatientEmbed>(data?.patients as PatientEmbed | PatientEmbed[] | null);
  const profile = one(patient?.patient_profiles ?? null);
  if (!profile?.sex) return null;
  try {
    return normalizeSexo(profile.sex);
  } catch {
    return null; // valor desconocido: no se asume sexo
  }
}

// Lecturas RLS del catalogo de condiciones y de la captura por evaluacion. El catalogo es de
// lectura amplia (authenticated); la captura la deja ver la RLS solo al profesional del paciente.

// Catalogo ACTIVO = la version de mayor published_at con sus condiciones (mismo patron que
// survey_versions / model_versions). null si aun no se sembro ninguna version.
export async function getActiveBisConditionCatalog(): Promise<BisConditionCatalog | null> {
  const supabase = await createSupabaseServerClient();
  const { data: version, error: vErr } = await supabase
    .from("bis_condition_versions")
    .select("id, version_number")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (vErr) throw new Error(`bis-conditions-reader: version: ${vErr.message}`);
  if (!version) return null;

  const { data: rows, error: cErr } = await supabase
    .from("bis_conditions")
    .select(
      "key, label, scope, kind, input_type, requires_detail, detail_label, detail_type, order_index",
    )
    .eq("bis_condition_version_id", version.id)
    .order("order_index", { ascending: true });
  if (cErr) throw new Error(`bis-conditions-reader: conditions: ${cErr.message}`);

  return {
    versionId: version.id,
    versionNumber: version.version_number,
    conditions: (rows ?? []).map((r) => ({
      key: r.key,
      label: r.label,
      scope: r.scope as BisConditionCatalog["conditions"][number]["scope"],
      kind: r.kind as BisConditionCatalog["conditions"][number]["kind"],
      inputType: r.input_type as BisConditionCatalog["conditions"][number]["inputType"],
      requiresDetail: r.requires_detail,
      detailLabel: r.detail_label,
      detailType: r.detail_type as BisConditionCatalog["conditions"][number]["detailType"],
      orderIndex: r.order_index,
    })),
  };
}

// Captura ya persistida de una evaluacion (para la UI y el gate del import). null si aun no se
// respondieron las condiciones o la RLS no deja leerla.
export async function getBisIntakeForEvaluation(
  evaluationId: string,
): Promise<BisIntakeRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluation_bis_intake")
    .select(
      "bis_condition_version_id, condition_answers, contraindicated, grip_strength_kg, weight_goal_kg, updated_at",
    )
    .eq("evaluation_id", evaluationId)
    .maybeSingle();
  if (error) throw new Error(`bis-conditions-reader: intake: ${error.message}`);
  if (!data) return null;

  return {
    versionId: data.bis_condition_version_id,
    answers: (data.condition_answers ?? {}) as BisConditionAnswers,
    contraindicated: data.contraindicated,
    gripStrengthKg: data.grip_strength_kg == null ? null : Number(data.grip_strength_kg),
    weightGoalKg: data.weight_goal_kg == null ? null : Number(data.weight_goal_kg),
    updatedAt: data.updated_at,
  };
}
