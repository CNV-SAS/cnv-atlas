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

  let efrState: EfrStateContent | null = null;
  const indicatorNames: Record<string, string> = {};
  if (diag) {
    // Contenido clinico del estado EFR y nombres de indicadores del registry activo.
    const [state, defs] = await Promise.all([
      supabase
        .from("efr_states")
        .select("diagnosis_name, mechanism, biomarkers, risks, suggested_nutraceuticals")
        .eq("model_version_id", diag.model_version_id)
        .eq("state_number", diag.efr_state_number)
        .maybeSingle(),
      supabase
        .from("indicator_definitions")
        .select("code, name")
        .eq("model_version_id", diag.model_version_id),
    ]);
    if (state.error) throw new Error(`results-reader: efr_states: ${state.error.message}`);
    if (defs.error) throw new Error(`results-reader: indicator_definitions: ${defs.error.message}`);
    if (state.data) {
      efrState = {
        diagnosisName: state.data.diagnosis_name,
        mechanism: state.data.mechanism,
        biomarkers: state.data.biomarkers,
        risks: state.data.risks,
        suggestedNutraceuticals: state.data.suggested_nutraceuticals,
      };
    }
    for (const d of defs.data ?? []) indicatorNames[d.code] = d.name;
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
