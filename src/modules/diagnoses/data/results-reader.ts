import "server-only";

import { type EngineOutput, isEngineOutput } from "@/clinical-engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getReportDispatch,
  getReportForEvaluation,
  type ReportStatus,
} from "@/modules/reports/data/reports-repository";

// Lectura de los resultados clinicos de una evaluacion para la VISTA INTERNA del
// profesional (B12). Fuente de verdad: el snapshot inmutable del reporte (EngineOutput,
// 12 indicadores + clasificaciones + fenotipo EFR/estructural/FyR + DFI). Se enriquece con
// el contenido clinico completo del estado EFR (efr_states: mecanismo, biomarcadores,
// riesgos) y con el estado de confirmacion del diagnostico. Todo por RLS (regla dura 3):
// el cliente anon con sesion solo ve las evaluaciones de los pacientes del profesional;
// si no es suyo, no hay filas -> null (la pagina responde 404).

export type EfrStateContent = {
  diagnosisName: string;
  mechanism: string | null;
  biomarkers: string | null;
  risks: string | null;
  suggestedNutraceuticals: string | null;
};

export type EvaluationResults = {
  snapshot: EngineOutput;
  // El snapshot coincide con la forma ACTUAL del motor. false para snapshots de eras
  // anteriores (stub-0.1.0 pre-B11): la vista degrada en vez de tronar.
  compatible: boolean;
  engineVersion: string | null; // versions.engine del snapshot, para informar el formato
  efrState: EfrStateContent | null;
  confirmed: boolean;
  confirmedAt: string | null;
  reportStatus: ReportStatus;
  patientName: string;
  documentLabel: string;
  evaluationDate: string;
  indicatorNames: Record<string, string>; // codigo -> nombre del registry
};

export type EvaluationHeader = {
  patientName: string;
  documentLabel: string;
  evaluationDate: string;
};

// Cabecera minima de una evaluacion por RLS (existe y es del profesional?). Distingue
// "evaluacion sin diagnostico todavia" (estado vacio elegante) de "no existe o no es suya"
// (404): getEvaluationResults devuelve null en ambos casos, esto rompe el empate.
export async function getEvaluationHeaderForSession(
  evaluationId: string,
): Promise<EvaluationHeader | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluations")
    .select(
      "created_at, patients!inner(document_type, document_number, patient_profiles!inner(first_name, last_name))",
    )
    .eq("id", evaluationId)
    .maybeSingle();
  if (error) throw new Error(`results-reader: evaluation header: ${error.message}`);
  if (!data) return null;
  const one = <T,>(e: T | T[] | null): T | undefined => (Array.isArray(e) ? e[0] : (e ?? undefined));
  const patient = one(
    data.patients as
      | { document_type: string; document_number: string; patient_profiles: unknown }
      | { document_type: string; document_number: string; patient_profiles: unknown }[]
      | null,
  );
  const profile = one(
    (patient?.patient_profiles ?? null) as
      | { first_name: string; last_name: string }
      | { first_name: string; last_name: string }[]
      | null,
  );
  return {
    patientName: `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim(),
    documentLabel: `${patient?.document_type ?? ""} ${patient?.document_number ?? ""}`.trim(),
    evaluationDate: data.created_at,
  };
}

export async function getEvaluationResults(
  evaluationId: string,
): Promise<EvaluationResults | null> {
  // Reporte del paciente para la evaluacion (RLS). Sin reporte no hay snapshot que ver.
  const report = await getReportForEvaluation(evaluationId);
  if (!report) return null;
  const dispatch = await getReportDispatch(report.reportId);
  if (!dispatch) return null;

  // Compatibilidad del snapshot con la forma actual del motor. Los snapshots de eras
  // anteriores (stub-0.1.0 pre-B11) no tienen efrPhenotype/dfi/structural: se degrada la
  // vista en vez de tronar. reports es inmutable, no se pueden migrar.
  const rawSnapshot = dispatch.snapshot as unknown;
  const engineVersion =
    (rawSnapshot as { versions?: { engine?: string } } | null)?.versions?.engine ?? null;
  if (!isEngineOutput(rawSnapshot)) {
    return {
      snapshot: dispatch.snapshot,
      compatible: false,
      engineVersion,
      efrState: null,
      confirmed: false,
      confirmedAt: null,
      reportStatus: dispatch.status,
      patientName: dispatch.patientName,
      documentLabel: dispatch.documentLabel,
      evaluationDate: dispatch.evaluationDate,
      indicatorNames: {},
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: diag, error: dErr } = await supabase
    .from("diagnoses")
    .select("efr_state_number, model_version_id, confirmed_at")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dErr) throw new Error(`results-reader: diagnoses: ${dErr.message}`);

  // Contenido clinico del estado EFR: PRIMERO del snapshot inmutable, donde se congela al
  // diagnosticar (ii). Asi la evidencia clinica no se re-deriva del registry vivo: una edicion
  // futura del contenido de un estado no re-escribe diagnosticos historicos.
  const efrFromSnapshot =
    (rawSnapshot as { efrContent?: EfrStateContent | null }).efrContent ?? null;

  let efrState: EfrStateContent | null = efrFromSnapshot;
  const indicatorNames: Record<string, string> = {};
  if (diag) {
    // Nombres de indicadores del registry (rotulos, no evidencia clinica que decida: fuera del
    // alcance de la congelacion ii; ver docs/RESULTADOS_GAP.md).
    const { data: defs, error: defsErr } = await supabase
      .from("indicator_definitions")
      .select("code, name")
      .eq("model_version_id", diag.model_version_id);
    if (defsErr) throw new Error(`results-reader: indicator_definitions: ${defsErr.message}`);
    for (const d of defs ?? []) indicatorNames[d.code] = d.name;

    // FALLBACK al registry vivo SOLO para diagnosticos previos a (ii), que no congelaron el
    // contenido en el snapshot. Se elimina en ST5 una vez limpios los diagnosticos rancios (#6):
    // ojo, este fallback lee por state_number y por eso re-etiqueta si el registry cambio.
    if (!efrState) {
      const { data: state, error: stateErr } = await supabase
        .from("efr_states")
        .select("diagnosis_name, mechanism, biomarkers, risks, suggested_nutraceuticals")
        .eq("model_version_id", diag.model_version_id)
        .eq("state_number", diag.efr_state_number)
        .maybeSingle();
      if (stateErr) throw new Error(`results-reader: efr_states: ${stateErr.message}`);
      if (state) {
        efrState = {
          diagnosisName: state.diagnosis_name,
          mechanism: state.mechanism,
          biomarkers: state.biomarkers,
          risks: state.risks,
          suggestedNutraceuticals: state.suggested_nutraceuticals,
        };
      }
    }
  }

  return {
    snapshot: dispatch.snapshot,
    compatible: true,
    engineVersion,
    efrState,
    confirmed: Boolean(diag?.confirmed_at),
    confirmedAt: diag?.confirmed_at ?? null,
    reportStatus: dispatch.status,
    patientName: dispatch.patientName,
    documentLabel: dispatch.documentLabel,
    evaluationDate: dispatch.evaluationDate,
    indicatorNames,
  };
}
