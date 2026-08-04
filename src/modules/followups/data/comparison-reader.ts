import "server-only";

import { type EngineIndicators, isEngineOutput } from "@/clinical-engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { pickPreviousEvaluation } from "./comparison-chronology";
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

// La fecha de medicion de una evaluacion = la mas reciente de sus mediciones (normalmente una).
type MeasEmbed = { measurement_date: string | null };
function latestMeasDate(embed: MeasEmbed[] | MeasEmbed | null | undefined): string | null {
  if (!embed) return null;
  const rows = Array.isArray(embed) ? embed : [embed];
  const dates = rows.map((r) => r.measurement_date).filter((d): d is string => d != null);
  if (dates.length === 0) return null;
  return dates.reduce((max, d) => (new Date(d).getTime() > new Date(max).getTime() ? d : max), dates[0]);
}

export async function getFollowupComparison(
  evaluationId: string,
): Promise<FollowupComparison | null> {
  const supabase = await createSupabaseServerClient();

  // Evaluacion actual con la fecha de su medicion (ancla de la cronologia clinica).
  const { data: current, error: cErr } = await supabase
    .from("evaluations")
    .select("patient_id, created_at, bis_measurements(measurement_date)")
    .eq("id", evaluationId)
    .maybeSingle();
  if (cErr) throw new Error(`comparison-reader: current evaluation: ${cErr.message}`);
  if (!current) return null;

  // Candidatas a "previa": las VIGENTES del mismo paciente (una reemplazada por correccion NO es
  // candidata: superseded_at IS NULL), cada una con la fecha de su medicion. El pick lo hace
  // pickPreviousEvaluation por measurement_date, no por created_at (ver su doc): asi un inicial
  // corregido meses despues no queda ordenado como si fuera la consulta mas reciente.
  const { data: cands, error: pErr } = await supabase
    .from("evaluations")
    .select("id, created_at, bis_measurements(measurement_date)")
    .eq("patient_id", current.patient_id)
    .is("superseded_at", null)
    .neq("id", evaluationId);
  if (pErr) throw new Error(`comparison-reader: candidate evaluations: ${pErr.message}`);

  const curMeasDate = latestMeasDate(current.bis_measurements);
  const candidates = (cands ?? []).map((e) => ({
    id: e.id,
    measurementDate: latestMeasDate(e.bis_measurements),
    createdAt: e.created_at,
  }));
  const prevId = pickPreviousEvaluation(
    { id: evaluationId, measurementDate: curMeasDate, createdAt: current.created_at },
    candidates,
  );
  if (!prevId) return null; // primera evaluacion comparable: nada contra que comparar
  const prevMeasDate = candidates.find((e) => e.id === prevId)?.measurementDate ?? null;

  // Snapshots inmutables de ambas evaluaciones. Si a alguna le falta reporte (no completo
  // el ciclo), no hay comparacion posible.
  const [curReport, prevReport] = await Promise.all([
    getReportForEvaluation(evaluationId),
    getReportForEvaluation(prevId),
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
    // Las fechas MOSTRADAS son las de MEDICION (misma cronologia que el pick): mostrar la fecha del
    // registro (report.created_at) diria "previa: hoy" para una medicion de enero corregida hoy. Cae
    // a la fecha del reporte solo si faltara la medicion (no ocurre: comparar exige medicion).
    currentDate: curMeasDate ?? curDispatch.evaluationDate,
    previousDate: prevMeasDate ?? prevDispatch.evaluationDate,
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
