import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  type PriorEvaluation,
  resolveTrajectory,
  type TrajectoryResult,
} from "@/modules/followups/services/eb-trajectory";

// P0 Parte 2 (P5): por qué el PACIENTE no ve un cambio en su reporte de seguimiento. Se RECOMPUTA EN VIVO
// (no se sella): el motivo puede cambiar si una corrección supera a la previa (cambia cuál es la
// comparable), así que refleja el estado VIGENTE ahora, no el de la emisión. Es para el PROFESIONAL, no
// para el paciente. Devuelve el motivo cuando no hay banda (no_prior | interval_too_short), o null cuando
// no aplica (inicial, o sí hay banda comparable).

type MeasEmbed = { measurement_date: string | null };
function latestMeasDate(embed: MeasEmbed[] | MeasEmbed | null | undefined): string | null {
  if (!embed) return null;
  const rows = Array.isArray(embed) ? embed : [embed];
  const dates = rows.map((r) => r.measurement_date).filter((d): d is string => d != null);
  if (dates.length === 0) return null;
  return dates.reduce((max, d) => (new Date(d).getTime() > new Date(max).getTime() ? d : max), dates[0]);
}

// EB sellada del reporte de una evaluacion (snapshot -> indicators -> eb). null si no hay reporte o EB.
function ebOf(reports: { snapshot: unknown }[] | { snapshot: unknown } | null | undefined): number | null {
  const r = Array.isArray(reports) ? reports[0] : reports;
  const eb = (r?.snapshot as { indicators?: { eb?: number | null } } | undefined)?.indicators?.eb;
  return eb == null ? null : Number(eb);
}

// `dfi.complete` sellado en el snapshot del reporte. undefined si no hay reporte (sin sellar aun).
function dfiCompleteOf(
  reports: { snapshot: unknown }[] | { snapshot: unknown } | null | undefined,
): boolean | undefined {
  const r = Array.isArray(reports) ? reports[0] : reports;
  return (r?.snapshot as { dfi?: { complete?: boolean } } | undefined)?.dfi?.complete;
}

export type TrajectoryNotice =
  | { kind: "no_prior" }
  | { kind: "interval_too_short"; nearestWeeks: number }
  | { kind: "incompleto" }; // la encuesta incompleta suprime la banda (D-007): el paciente no ve el cambio

export async function getTrajectoryNotice(evaluationId: string): Promise<TrajectoryNotice | null> {
  const supabase = await createSupabaseServerClient();

  // Evaluacion actual: solo aplica a SEGUIMIENTO. Trae su tipo, paciente, fecha de medicion y EB sellada.
  const { data: current, error: cErr } = await supabase
    .from("evaluations")
    .select("patient_id, type, bis_measurements(measurement_date), reports(snapshot)")
    .eq("id", evaluationId)
    .maybeSingle();
  if (cErr) throw new Error(`trajectory-notice-reader: current: ${cErr.message}`);
  if (!current || current.type !== "seguimiento") return null;

  // Diagnóstico incompleto: la banda se suprime (D-007), y ESA es la razón que el profesional debe ver
  // (no un intervalo o una falta de previa). Tiene precedencia: aunque hubiera previa comparable, con la
  // encuesta a medias no se comunica el cambio. Es accionable (completar la encuesta en la próxima consulta).
  if (dfiCompleteOf(current.reports) === false) return { kind: "incompleto" };

  const currentDate = latestMeasDate(current.bis_measurements);
  const currentEb = ebOf(current.reports);
  if (!currentDate || currentEb == null) return null;

  // Previas VIGENTES del paciente con EB sellada + fecha de medicion (misma disciplina que C2-a).
  const { data: cands, error: pErr } = await supabase
    .from("evaluations")
    .select("id, bis_measurements(measurement_date), reports(snapshot)")
    .eq("patient_id", current.patient_id)
    .is("superseded_at", null)
    .neq("id", evaluationId);
  if (pErr) throw new Error(`trajectory-notice-reader: candidates: ${pErr.message}`);

  const priors: PriorEvaluation[] = (cands ?? []).map((e) => ({
    evaluationId: e.id,
    date: latestMeasDate(e.bis_measurements) ?? "",
    eb: ebOf(e.reports),
  }));

  const result: TrajectoryResult = resolveTrajectory(currentDate, currentEb, priors);
  if (result.kind === "band") return null; // hay banda comparable: el reporte la comunica, no hay aviso
  if (result.kind === "interval_too_short") return { kind: "interval_too_short", nearestWeeks: result.nearestWeeks };
  return { kind: "no_prior" };
}
