import "server-only";

import { type EngineOutput, isEngineOutput } from "@/clinical-engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getReportDispatch,
  getReportForEvaluation,
  type ReportStatus,
} from "@/modules/reports/data/reports-repository";

// Lectura de los resultados clinicos de una evaluacion para la VISTA INTERNA del
// profesional (B12). Fuente de verdad UNICA: el snapshot inmutable del reporte (EngineOutput +
// efrContent): 12 indicadores + clasificaciones + fenotipo EFR/estructural/FyR + DFI + el
// contenido clinico del estado EFR (nombre/mecanismo/biomarcadores/riesgos), TODO congelado al
// diagnosticar (ii). La vista es autosuficiente: NO cruza el registry vivo por state_number. Del
// registry solo se leen el estado de confirmacion del diagnostico y los nombres de indicadores
// (rotulos, por model_version_id). Todo por RLS (regla dura 3): el cliente anon con sesion solo
// ve las evaluaciones de sus pacientes; si no es suyo, no hay filas -> null (la pagina 404).

export type EfrStateContent = {
  diagnosisName: string;
  mechanism: string | null;
  biomarkers: string | null;
  risks: string | null;
  suggestedNutraceuticals: string | null;
};

// Forma del snapshot inmutable que persiste el pipeline: el EngineOutput MAS el contenido
// clinico del estado EFR congelado (efrContent, ii). efrContent es REQUERIDO: la vista lee toda
// la evidencia clinica de aqui, sin cruzar el registry vivo. (En runtime un dato previo a ii
// podria no traerlo; se maneja con `?? null` y la vista degrada, pero el contrato lo exige.)
type StoredSnapshot = EngineOutput & { efrContent: EfrStateContent };

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
  // model_version_id del diagnostico: para leer los 81 estados de referencia (efr_states) de la
  // MISMA era del diagnostico del paciente (exploracion de la Diana, era-consistente). null si no
  // hay diagnostico o el snapshot es incompatible.
  modelVersionId: string | null;
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
      modelVersionId: null,
    };
  }

  // Contenido clinico del estado EFR: SIEMPRE del snapshot inmutable, donde se congela al
  // diagnosticar (ii). La vista es AUTOSUFICIENTE: NO cruza contra el registry vivo (ni efr_states
  // ni nada por state_number), para que una edicion futura del contenido de un estado no
  // re-escriba diagnosticos historicos. Un snapshot con la forma actual del motor trae efrContent
  // (ST1); si faltara (dato previo a ii, ya limpiado), efrState es null y la vista degrada.
  const efrState: EfrStateContent | null =
    (rawSnapshot as StoredSnapshot).efrContent ?? null;

  // Del registry solo quedan dos lecturas, ninguna por state_number ni evidencia clinica: el
  // estado de confirmacion del diagnostico, y los NOMBRES de indicadores (rotulos, por
  // model_version_id; fuera del alcance de ii por decision, ver docs/RESULTADOS_GAP.md).
  const supabase = await createSupabaseServerClient();
  const { data: diag, error: dErr } = await supabase
    .from("diagnoses")
    .select("model_version_id, confirmed_at")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dErr) throw new Error(`results-reader: diagnoses: ${dErr.message}`);

  const indicatorNames: Record<string, string> = {};
  if (diag) {
    const { data: defs, error: defsErr } = await supabase
      .from("indicator_definitions")
      .select("code, name")
      .eq("model_version_id", diag.model_version_id);
    if (defsErr) throw new Error(`results-reader: indicator_definitions: ${defsErr.message}`);
    for (const d of defs ?? []) indicatorNames[d.code] = d.name;
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
    modelVersionId: diag?.model_version_id ?? null,
  };
}
