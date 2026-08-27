import "server-only";

import type { ProtocoloAjustes, ProtocoloSnapshot } from "@/clinical-engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeHeader } from "@/modules/bis/services/header-map";

// TreatmentProtocol (anotacion del reader) vive en el modulo neutro; ver el reexport abajo.
import type { IntercambioSaved, MenuSemanalSaved, TiemposSaved, TreatmentProtocol } from "./treatment-view-types";

// El intercambio y los tiempos cambiaron de forma (por-grupo -> por-alimento, ronda P-29). Un jsonb guardado con la
// forma VIEJA (`grupos` en vez de `porciones`) no se puede leer como el nuevo shape: se trata como AUSENTE
// (null) para caer a los defaults frescos, no como una fila corrupta que rompe el panel. Defensivo: no hay dato
// viejo en produccion (feature nueva, 0 guardados), pero un cast crudo dejaria pasar una forma incompatible.
function normalizeIntercambio(raw: unknown): IntercambioSaved | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  return v.porciones && typeof v.porciones === "object" ? (v as IntercambioSaved) : null;
}
function normalizeTiempos(raw: unknown): TiemposSaved | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const base = v.base as Record<string, unknown> | undefined;
  return base && base.porciones && typeof base.porciones === "object" ? (v as TiemposSaved) : null;
}

// Tiempos activos: un mapa plano de tiempo -> bool. Una forma que no sea esa se trata como "nunca
// guardados" (el panel cae a los activos por defecto) en vez de dejar la tabla en blanco.
function normalizeTiemposActivos(raw: unknown): Record<string, boolean> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  const entries = Object.entries(v).filter(([, val]) => typeof val === "boolean");
  return entries.length > 0 ? (Object.fromEntries(entries) as Record<string, boolean>) : null;
}

// Menu semanal: misma tolerancia que las otras dos formas jsonb. Una forma que no es la actual se trata
// como "nunca guardado" (la grilla cae a la precarga) en vez de reventar o pintar celdas vacias.
function normalizeMenuSemanal(raw: unknown): MenuSemanalSaved | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.diaInicio !== "number" || !v.celdas || typeof v.celdas !== "object") return null;
  return v as MenuSemanalSaved;
}

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

// Los tipos de la vista viven en treatment-view-types (modulo neutro) para que el panel cliente los
// importe sin el reader server-only. El reader los reexporta para el resto del server.
export type {
  PrescribedNutraceutical,
  DietGuideline,
  TreatmentNote,
  CatalogItem,
  MenuSuggestion,
  TreatmentProtocol,
} from "./treatment-view-types";

// El embed anidado de PostgREST puede volver objeto o arreglo segun el shape; misma tolerancia que
// nutraceuticalName. Sin patient_id no se puede registrar una contraindicacion, asi que se resuelve aqui.
function patientIdFrom(evaluations: unknown): string {
  const e = Array.isArray(evaluations) ? evaluations[0] : evaluations;
  return (e as { patient_id?: string } | null)?.patient_id ?? "";
}

export async function getTreatmentProtocol(
  evaluationId: string,
): Promise<TreatmentProtocol | null> {
  const supabase = await createSupabaseServerClient();

  // Diagnostico de la evaluacion (RLS). Sin diagnostico no hay tratamiento que ver.
  const { data: diag, error: dErr } = await supabase
    .from("diagnoses")
    .select("id, confirmed_at, evaluations!inner(patient_id)")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dErr) throw new Error(`treatment-reader: diagnoses: ${dErr.message}`);
  if (!diag) return null;

  // El tratamiento que el pipeline creo para ese diagnostico.
  const { data: treatment, error: tErr } = await supabase
    .from("treatments")
    .select(
      "id, status, kcal_objetivo, proteina_g, restricciones, objetivo_texto, intercambio_porciones, tiempos, tiempos_activos, menu_semanal, nutraceutical_decision, nutraceutical_decision_reason, nutraceutical_decision_note, nutraceutical_decision_at, protocol_suggested, adj_peso_meta, adj_geb, adj_pal, adj_kcal_obj, adj_prot_gkg, adj_fat_pct",
    )
    .eq("diagnosis_id", diag.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (tErr) throw new Error(`treatment-reader: treatments: ${tErr.message}`);
  if (!treatment) return null;

  const treatmentId = treatment.id;

  // El paciente sale del embed del diagnostico; se resuelve ANTES porque la consulta de sus
  // contraindicaciones lo necesita (son de la PERSONA, no de esta consulta).
  const patientId = patientIdFrom((diag as { evaluations?: unknown }).evaluations);

  const [nutras, guides, notes, catalog, menus, get, report, contra] = await Promise.all([
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
    supabase
      .from("nutraceuticals")
      .select("id, name, unit, indication, commercial_availability, serving_size, presentation, composition")
      .order("name", { ascending: true }),
    supabase
      .from("ai_menu_suggestions")
      .select("id, provider, model, prompt_version, generated_text, menu_json, alergenos_detectados, patron_conflictos, status, latency_ms, generated_at")
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
    // Nutraceuticos RECOMENDADOS por el modelo: viven en el snapshot inmutable del reporte
    // (output.nutraceuticos, string). Se leen aparte de los nutraceuticos AGREGADOS por el
    // profesional (treatment_nutraceuticals): son dos conceptos distintos (recomienda vs agrega).
    supabase
      .from("reports")
      .select("snapshot")
      .eq("evaluation_id", evaluationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Contraindicaciones del PACIENTE. RLS propia (is_patient_professional): si el paciente no es tuyo,
    // no hay filas. Se piden aunque no haya nutraceuticos prescritos: lo que importa es advertir ANTES.
    supabase
      .from("patient_contraindications")
      .select("id, nutraceutical_id, reason, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
  ]);

  if (nutras.error) throw new Error(`treatment-reader: nutraceuticals: ${nutras.error.message}`);
  if (guides.error) throw new Error(`treatment-reader: guidelines: ${guides.error.message}`);
  if (notes.error) throw new Error(`treatment-reader: notes: ${notes.error.message}`);
  if (catalog.error) throw new Error(`treatment-reader: catalog: ${catalog.error.message}`);
  if (menus.error) throw new Error(`treatment-reader: menu_suggestions: ${menus.error.message}`);
  if (get.error) throw new Error(`treatment-reader: get: ${get.error.message}`);
  if (report.error) throw new Error(`treatment-reader: report snapshot: ${report.error.message}`);

  const kcalSugerido = get.data?.value != null ? Math.round(Number(get.data.value)) : null;
  // Recomendacion del modelo (string plano, p. ej. "MULTI-CELL BASE, OMEGA COMPLEX"). El P1/P2/dosis
  // estructurado es T3; hoy se muestra el string tal cual, separado de lo que agrega el profesional.
  const snap = report.data?.snapshot as { nutraceuticos?: unknown } | null;
  const recommendedNutraceuticals =
    snap && typeof snap.nutraceuticos === "string" && snap.nutraceuticos.trim()
      ? snap.nutraceuticos
      : null;
  const suggestedSnapshot = (treatment.protocol_suggested as ProtocoloSnapshot | null) ?? null;

  // DESCARTES DEL AVISO DE ALERGENO. Se leen de su TABLA DE DOMINIO, no del audit log: el audit log es
  // solo-admin para SELECT, asi que con la sesion del profesional devolvia vacio SIEMPRE y el descarte
  // nunca se veia (defecto cazado en el smoke; ver 0088). La traza del mismo hecho sigue en el audit log.
  //
  // El aviso NO se borra al descartarlo: el hallazgo vive en ai_menu_suggestions, que es inmutable, y el
  // descarte vive aparte. Descartar es decir "lo mire y esta bien", no "no paso nada".
  const idsMenu = (menus.data ?? []).map((m) => m.id);
  const descartes = new Map<string, { porEmail: string; motivo: string; en: string }>();
  if (idsMenu.length > 0) {
    const { data: filas } = await supabase
      .from("menu_allergen_dismissals")
      .select("suggestion_id, dismissed_by_email, reason, dismissed_at")
      .in("suggestion_id", idsMenu);
    for (const f of filas ?? []) {
      descartes.set(f.suggestion_id, {
        porEmail: f.dismissed_by_email,
        motivo: f.reason,
        en: f.dismissed_at,
      });
    }
  }


  return {
    treatmentId,
    diagnosisConfirmed: Boolean(diag.confirmed_at),
    approved: treatment.status === "approved",
    kcalObjetivo: treatment.kcal_objetivo,
    proteinaGramos: treatment.proteina_g,
    // Peso meta VISIBLE (pieza 1): pesoCalculo/label salen del snapshot sugerido sellado; adjPesoMeta es
    // el override del profesional (columna adj_peso_meta). Sin snapshot, pesoCalculo/label quedan null.
    pesoCalculo: suggestedSnapshot?.pesoCalculo ?? null,
    pesoCalculoLabel: suggestedSnapshot?.pesoCalculoLabel ?? null,
    adjPesoMeta: treatment.adj_peso_meta != null ? Number(treatment.adj_peso_meta) : null,
    // Ajustes de la cadena (pieza 2). Numeros: los numeric (pal/prot_gkg) vuelven como string de PostgREST,
    // los integer (geb/kcal_obj/fat_pct) como numero; se normalizan TODOS con Number para que la firma de
    // ajustes coincida byte a byte con la que recomputa el writer bajo lock (misma normalizacion alla).
    adjGeb: treatment.adj_geb != null ? Number(treatment.adj_geb) : null,
    adjPal: treatment.adj_pal != null ? Number(treatment.adj_pal) : null,
    adjKcalObj: treatment.adj_kcal_obj != null ? Number(treatment.adj_kcal_obj) : null,
    adjProtGkg: treatment.adj_prot_gkg != null ? Number(treatment.adj_prot_gkg) : null,
    adjFatPct: treatment.adj_fat_pct != null ? Number(treatment.adj_fat_pct) : null,
    restricciones: treatment.restricciones ?? [],
    objetivoTexto: treatment.objetivo_texto ?? null,
    intercambioPorciones: normalizeIntercambio(treatment.intercambio_porciones),
    tiempos: normalizeTiempos(treatment.tiempos),
    patientId,
    contraindications: (contra?.data ?? []).map((c: { id: string; nutraceutical_id: string | null; reason: string; created_at: string }) => ({
      id: c.id,
      nutraceuticalId: c.nutraceutical_id ?? null,
      reason: c.reason,
      createdAt: c.created_at,
    })),
    tiemposActivos: normalizeTiemposActivos(treatment.tiempos_activos),
    // Sin `at` no hay decision: la fecha es parte del dato, no un adorno (ver el schema).
    nutraceuticalDecision:
      treatment.nutraceutical_decision && treatment.nutraceutical_decision_at
        ? {
            decision: treatment.nutraceutical_decision as "si" | "no" | "pendiente",
            reason: treatment.nutraceutical_decision_reason ?? null,
            note: treatment.nutraceutical_decision_note ?? null,
            at: treatment.nutraceutical_decision_at,
          }
        : null,
    menuSemanal: normalizeMenuSemanal(treatment.menu_semanal),
    kcalSugerido,
    nutraceuticals: (nutras.data ?? []).map((n) => ({
      id: n.id,
      nutraceuticalId: n.nutraceutical_id,
      // El join anida el nombre del catalogo; puede venir como objeto o arreglo segun el shape.
      name: nutraceuticalName(n.nutraceuticals),
      dosage: n.dosage,
      durationDays: n.duration_days,
    })),
    recommendedNutraceuticals,
    guidelines: (guides.data ?? []).map((g) => ({ id: g.id, text: g.guideline_text })),
    notes: (notes.data ?? []).map((n) => ({
      id: n.id,
      note: n.note,
      createdAt: n.created_at,
    })),
    catalog: (catalog.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      unit: c.unit,
      indication: c.indication ?? null,
      commercialAvailability: c.commercial_availability ?? "no_disponible",
      servingSize: c.serving_size ?? null,
      presentation: c.presentation ?? null,
      composition: c.composition ?? null,
    })),
    menuSuggestions: (menus.data ?? []).map((m) => ({
      id: m.id,
      provider: m.provider,
      model: m.model,
      promptVersion: m.prompt_version,
      generatedText: m.generated_text,
      menuJson: (m.menu_json as TreatmentProtocol["menuSuggestions"][number]["menuJson"]) ?? null,
      alergenosDetectados:
        (m.alergenos_detectados as TreatmentProtocol["menuSuggestions"][number]["alergenosDetectados"]) ?? null,
      patronConflictos:
        (m.patron_conflictos as TreatmentProtocol["menuSuggestions"][number]["patronConflictos"]) ?? null,
      alergenoDescartado: descartes.get(m.id) ?? null,
      status: m.status,
      latencyMs: m.latency_ms,
      generatedAt: m.generated_at,
    })),
    protocolSuggested: suggestedSnapshot,
  };
}

// El embed de PostgREST puede tipar la relacion como objeto o como arreglo; se resuelve
// defensivamente a un nombre legible.
function nutraceuticalName(rel: unknown): string {
  if (Array.isArray(rel)) {
    const first = rel[0] as { name?: string } | undefined;
    return first?.name ?? "Nutracéutico";
  }
  const obj = rel as { name?: string } | null;
  return obj?.name ?? "Nutracéutico";
}

// --- T2 A3: lectura para aprobar el protocolo ---
// Lo que approveProtocol necesita, todo por RLS (regla 3): si la evaluacion no es del profesional,
// las filas no existen -> null. Trae el professional_id de la evaluacion para el chequeo EXPLICITO
// de asignacion (defensa en profundidad, no solo RLS), el sugerido y los adj_* para recomputar el
// efectivo, el status para el gate de borrador, y la fecha de la medicion BIS para sellarla junto a
// la de aprobacion (la distancia medicion<->prescripcion debe quedar auditable).
export type TreatmentForApproval = {
  treatmentId: string;
  status: string;
  protocolSuggested: ProtocoloSnapshot | null;
  adjustments: ProtocoloAjustes;
  evaluationProfessionalId: string;
  bisMeasurementDate: string | null;
};

export async function getTreatmentForApproval(
  evaluationId: string,
): Promise<TreatmentForApproval | null> {
  const supabase = await createSupabaseServerClient();

  const { data: evalRow, error: eErr } = await supabase
    .from("evaluations")
    .select("professional_id")
    .eq("id", evaluationId)
    .maybeSingle();
  if (eErr) throw new Error(`treatment-reader(approval): evaluations: ${eErr.message}`);
  if (!evalRow) return null;

  const { data: diag, error: dErr } = await supabase
    .from("diagnoses")
    .select("id")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dErr) throw new Error(`treatment-reader(approval): diagnoses: ${dErr.message}`);
  if (!diag) return null;

  const { data: t, error: tErr } = await supabase
    .from("treatments")
    .select(
      "id, status, protocol_suggested, adj_geb, adj_pal, adj_kcal_obj, adj_prot_gkg, adj_fat_pct, adj_peso_meta",
    )
    .eq("diagnosis_id", diag.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (tErr) throw new Error(`treatment-reader(approval): treatments: ${tErr.message}`);
  if (!t) return null;

  const { data: meas, error: mErr } = await supabase
    .from("bis_measurements")
    .select("measurement_date")
    .eq("evaluation_id", evaluationId)
    .order("measurement_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (mErr) throw new Error(`treatment-reader(approval): bis_measurements: ${mErr.message}`);

  const n = (v: unknown): number | null => (v == null ? null : Number(v));
  return {
    treatmentId: t.id,
    status: t.status,
    protocolSuggested: (t.protocol_suggested as ProtocoloSnapshot | null) ?? null,
    adjustments: {
      geb: n(t.adj_geb),
      pal: n(t.adj_pal),
      kcalObj: n(t.adj_kcal_obj),
      protGkg: n(t.adj_prot_gkg),
      fatPct: n(t.adj_fat_pct),
      pesoMeta: n(t.adj_peso_meta),
    },
    evaluationProfessionalId: evalRow.professional_id,
    bisMeasurementDate: meas?.measurement_date ?? null,
  };
}
