import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeHeader } from "@/modules/bis/services/header-map";

// Lectura del protocolo de tratamiento de una evaluacion para la vista interna del
// profesional (B13). Todo por RLS (regla dura 3): el cliente anon con sesion solo ve los
// tratamientos de los pacientes del profesional; si la evaluacion no es suya, no hay filas
// -> null (la vista lo trata como no disponible). El tratamiento ya existe (lo crea el
// pipeline al generar el diagnostico); aqui se lee para enriquecerlo con los objetivos y el
// contenido del protocolo.

// Nombre canonico de la variable GET (Gasto Energetico Total) tal como queda en
// bis_raw_values tras normalizar el encabezado del export de Biody. Es el gasto MEDIDO por
// el equipo; se ofrece como precarga editable del objetivo calorico (el motor no lo calcula).
const GET_VARIABLE = normalizeHeader(
  "Gasto energético measurementDetails.VALEURCALCULEEEXPORT kcal",
);

export type PrescribedNutraceutical = {
  id: string;
  nutraceuticalId: string;
  name: string;
  dosage: string | null;
  durationDays: number | null;
};

export type DietGuideline = { id: string; text: string };
export type TreatmentNote = { id: string; note: string; createdAt: string };
export type CatalogItem = { id: string; name: string; unit: string | null };

export type MenuSuggestion = {
  id: string;
  provider: string;
  model: string;
  promptVersion: string;
  generatedText: string | null;
  status: string; // success, timeout, parse_failed, provider_error
  latencyMs: number | null;
  generatedAt: string;
};

export type TreatmentProtocol = {
  treatmentId: string;
  diagnosisConfirmed: boolean;
  kcalObjetivo: number | null;
  proteinaGramos: number | null;
  restricciones: string[];
  kcalSugerido: number | null; // GET medido por el Biody, si existe
  nutraceuticals: PrescribedNutraceutical[];
  guidelines: DietGuideline[];
  notes: TreatmentNote[];
  catalog: CatalogItem[];
  menuSuggestions: MenuSuggestion[]; // sugerencias de IA (B13), la mas reciente primero
};

export async function getTreatmentProtocol(
  evaluationId: string,
): Promise<TreatmentProtocol | null> {
  const supabase = await createSupabaseServerClient();

  // Diagnostico de la evaluacion (RLS). Sin diagnostico no hay tratamiento que ver.
  const { data: diag, error: dErr } = await supabase
    .from("diagnoses")
    .select("id, confirmed_at")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dErr) throw new Error(`treatment-reader: diagnoses: ${dErr.message}`);
  if (!diag) return null;

  // El tratamiento que el pipeline creo para ese diagnostico.
  const { data: treatment, error: tErr } = await supabase
    .from("treatments")
    .select("id, kcal_objetivo, proteina_g, restricciones")
    .eq("diagnosis_id", diag.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (tErr) throw new Error(`treatment-reader: treatments: ${tErr.message}`);
  if (!treatment) return null;

  const treatmentId = treatment.id;

  const [nutras, guides, notes, catalog, menus, get] = await Promise.all([
    supabase
      .from("treatment_nutraceuticals")
      .select("id, nutraceutical_id, dosage, duration_days, nutraceuticals(name)")
      .eq("treatment_id", treatmentId),
    supabase
      .from("treatment_diet_guidelines")
      .select("id, guideline_text")
      .eq("treatment_id", treatmentId),
    supabase
      .from("treatment_notes")
      .select("id, note, created_at")
      .eq("treatment_id", treatmentId)
      .order("created_at", { ascending: false }),
    supabase.from("nutraceuticals").select("id, name, unit").order("name", { ascending: true }),
    supabase
      .from("ai_menu_suggestions")
      .select("id, provider, model, prompt_version, generated_text, status, latency_ms, generated_at")
      .eq("treatment_id", treatmentId)
      .order("generated_at", { ascending: false }),
    // GET medido: bis_raw_values de la medicion de esta evaluacion (RLS via la evaluacion).
    supabase
      .from("bis_raw_values")
      .select("value, bis_measurements!inner(evaluation_id)")
      .eq("bis_measurements.evaluation_id", evaluationId)
      .eq("variable_name", GET_VARIABLE)
      .limit(1)
      .maybeSingle(),
  ]);

  if (nutras.error) throw new Error(`treatment-reader: nutraceuticals: ${nutras.error.message}`);
  if (guides.error) throw new Error(`treatment-reader: guidelines: ${guides.error.message}`);
  if (notes.error) throw new Error(`treatment-reader: notes: ${notes.error.message}`);
  if (catalog.error) throw new Error(`treatment-reader: catalog: ${catalog.error.message}`);
  if (menus.error) throw new Error(`treatment-reader: menu_suggestions: ${menus.error.message}`);
  if (get.error) throw new Error(`treatment-reader: get: ${get.error.message}`);

  const kcalSugerido = get.data?.value != null ? Math.round(Number(get.data.value)) : null;

  return {
    treatmentId,
    diagnosisConfirmed: Boolean(diag.confirmed_at),
    kcalObjetivo: treatment.kcal_objetivo,
    proteinaGramos: treatment.proteina_g,
    restricciones: treatment.restricciones ?? [],
    kcalSugerido,
    nutraceuticals: (nutras.data ?? []).map((n) => ({
      id: n.id,
      nutraceuticalId: n.nutraceutical_id,
      // El join anida el nombre del catalogo; puede venir como objeto o arreglo segun el shape.
      name: nutraceuticalName(n.nutraceuticals),
      dosage: n.dosage,
      durationDays: n.duration_days,
    })),
    guidelines: (guides.data ?? []).map((g) => ({ id: g.id, text: g.guideline_text })),
    notes: (notes.data ?? []).map((n) => ({
      id: n.id,
      note: n.note,
      createdAt: n.created_at,
    })),
    catalog: (catalog.data ?? []).map((c) => ({ id: c.id, name: c.name, unit: c.unit })),
    menuSuggestions: (menus.data ?? []).map((m) => ({
      id: m.id,
      provider: m.provider,
      model: m.model,
      promptVersion: m.prompt_version,
      generatedText: m.generated_text,
      status: m.status,
      latencyMs: m.latency_ms,
      generatedAt: m.generated_at,
    })),
  };
}

// El embed de PostgREST puede tipar la relacion como objeto o como arreglo; se resuelve
// defensivamente a un nombre legible.
function nutraceuticalName(rel: unknown): string {
  if (Array.isArray(rel)) {
    const first = rel[0] as { name?: string } | undefined;
    return first?.name ?? "Nutraceutico";
  }
  const obj = rel as { name?: string } | null;
  return obj?.name ?? "Nutraceutico";
}
