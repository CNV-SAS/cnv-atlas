import "server-only";

import { type EngineIndicators, isEngineOutput } from "@/clinical-engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getReportDispatch,
  getReportForEvaluation,
} from "@/modules/reports/data/reports-repository";

// Comparacion de seguimiento (B13): confronta los resultados de una evaluacion contra los
// de la evaluacion PREVIA del mismo paciente. Se computa al leer, desde los dos snapshots
// inmutables (no se guardan deltas). Todo por RLS (regla dura 3): si la evaluacion o su
// previa no son del profesional, no hay filas -> null. Devuelve null tambien cuando no hay
// evaluacion previa comparable (evaluacion inicial): no hay nada contra que comparar.

// Los 12 indicadores en orden estable, mapeando codigo <-> clave del EngineOutput.
const INDICATORS: { code: string; key: keyof EngineIndicators }[] = [
  { code: "IFC", key: "ifc" },
  { code: "IRC", key: "irc" },
  { code: "PABU", key: "pabu" },
  { code: "ICA-BIS", key: "icaBis" },
  { code: "ISCM", key: "iscm" },
  { code: "IEHH", key: "iehh" },
  { code: "IAE", key: "iae" },
  { code: "EB", key: "eb" },
  { code: "FMI", key: "FMI" },
  { code: "FFMI", key: "FFMI" },
  { code: "AF", key: "AF" },
  { code: "IR", key: "IR" },
];

export type IndicatorDelta = {
  code: string;
  current: number | null;
  previous: number | null;
  delta: number | null; // current - previous (null si falta alguno)
};

export type FollowupComparison = {
  currentDate: string;
  previousDate: string;
  currentEfrState: number;
  previousEfrState: number;
  currentRisk: { nivel: string; score: number };
  previousRisk: { nivel: string; score: number };
  indicators: IndicatorDelta[];
};

export async function getFollowupComparison(
  evaluationId: string,
): Promise<FollowupComparison | null> {
  const supabase = await createSupabaseServerClient();

  // Evaluacion actual: paciente y fecha, para ubicar la previa (RLS).
  const { data: current, error: cErr } = await supabase
    .from("evaluations")
    .select("patient_id, created_at")
    .eq("id", evaluationId)
    .maybeSingle();
  if (cErr) throw new Error(`comparison-reader: current evaluation: ${cErr.message}`);
  if (!current) return null;

  // Evaluacion previa del mismo paciente (la mas reciente anterior a la actual).
  const { data: prev, error: pErr } = await supabase
    .from("evaluations")
    .select("id")
    .eq("patient_id", current.patient_id)
    .lt("created_at", current.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pErr) throw new Error(`comparison-reader: previous evaluation: ${pErr.message}`);
  if (!prev) return null; // primera evaluacion: nada que comparar

  // Snapshots inmutables de ambas evaluaciones. Si a alguna le falta reporte (no completo
  // el ciclo), no hay comparacion posible.
  const [curReport, prevReport] = await Promise.all([
    getReportForEvaluation(evaluationId),
    getReportForEvaluation(prev.id),
  ]);
  if (!curReport || !prevReport) return null;

  const [curDispatch, prevDispatch] = await Promise.all([
    getReportDispatch(curReport.reportId),
    getReportDispatch(prevReport.reportId),
  ]);
  if (!curDispatch || !prevDispatch) return null;

  const cur = curDispatch.snapshot;
  const pre = prevDispatch.snapshot;

  // Si alguno de los snapshots es de una era anterior del motor (stub-0.1.0 pre-B11), su
  // forma no coincide y no se puede comparar campo a campo: se omite la comparacion.
  if (!isEngineOutput(cur) || !isEngineOutput(pre)) return null;

  const indicators: IndicatorDelta[] = INDICATORS.map(({ code, key }) => {
    const current = cur.indicators[key];
    const previous = pre.indicators[key];
    const delta = current != null && previous != null ? round(current - previous) : null;
    return { code, current, previous, delta };
  });

  return {
    currentDate: curDispatch.evaluationDate,
    previousDate: prevDispatch.evaluationDate,
    currentEfrState: cur.efrPhenotype.stateNumber,
    previousEfrState: pre.efrPhenotype.stateNumber,
    currentRisk: { nivel: cur.dfi.riesgo.nivel, score: cur.dfi.riesgo.score },
    previousRisk: { nivel: pre.dfi.riesgo.nivel, score: pre.dfi.riesgo.score },
    indicators,
  };
}

// Redondeo a 2 decimales para evitar ruido de coma flotante en el delta mostrado.
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
