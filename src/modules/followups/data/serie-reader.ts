import "server-only";

import { BIODY_COLUMNS } from "@/clinical-engine/edge/biody-columns";
import { normalizeHeader } from "@/modules/bis/services/header-map";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { SERIE_MAX, type PuntoSerie, type SerieSeguimiento } from "./serie-types";

export { SERIE_MAX };
export type { PuntoSerie, SerieSeguimiento };

// SERIE de seguimiento: todas las evaluaciones VIGENTES del paciente con su medición y su snapshot, en
// orden cronológico. Alimenta los gráficos de tendencia y el radar comparativo.
//
type Fila = {
  id: string;
  snapshot: unknown;
  evaluations: { superseded_at: string | null; bis_measurements: { measurement_date: string | null }[] } | null;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function getSerieSeguimiento(evaluationId: string): Promise<SerieSeguimiento> {
  const supabase = await createSupabaseServerClient();
  // El paciente sale de la propia evaluacion: la pagina no tiene que cargarlo aparte, y la RLS ya limita
  // el alcance (si la evaluacion no es del profesional, no hay fila y la serie sale vacia).
  const { data: ev } = await supabase
    .from("evaluations")
    .select("patient_id")
    .eq("id", evaluationId)
    .maybeSingle();
  const patientId = ev?.patient_id as string | undefined;
  if (!patientId) return { puntos: [], omitidas: 0 };
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, evaluation_id, snapshot, evaluations!inner(superseded_at, bis_measurements(measurement_date))",
    )
    .eq("patient_id", patientId)
    .eq("type", "paciente");
  if (error) throw new Error(`serie-reader: ${error.message}`);

  const puntos: PuntoSerie[] = [];
  for (const row of (data ?? []) as unknown as (Fila & { evaluation_id: string })[]) {
    const ev = row.evaluations;
    // Una evaluacion REEMPLAZADA por una correccion no es un punto de la trayectoria: comparariamos
    // contra el yo pre-correccion del paciente (misma regla que ya aplica comparison-chronology).
    if (!ev || ev.superseded_at != null) continue;
    const fechas = (ev.bis_measurements ?? []).map((m) => m.measurement_date).filter((d): d is string => d != null);
    if (fechas.length === 0) continue; // sin medicion no hay punto en el tiempo
    const fecha = fechas.reduce((max, d) => (d > max ? d : max), fechas[0]);
    const snap = row.snapshot as { indicators?: Record<string, unknown>; dfi?: { domains?: unknown } } | null;
    const ind = snap?.indicators ?? {};
    const dom = snap?.dfi?.domains;
    puntos.push({
      evaluationId: row.evaluation_id,
      fecha,
      // La capacitancia vive en el BIS CRUDO (no es salida del motor); se resuelve abajo.
      c: null,
      pabu: num(ind["pabu"]),
      icaBis: num(ind["icaBis"]),
      dominios: Array.isArray(dom)
        ? (dom as { id?: string; nombre?: string; sev?: number }[]).map((d) => ({
            id: String(d.id ?? ""),
            nombre: String(d.nombre ?? ""),
            sev: Number(d.sev ?? 0),
          }))
        : null,
    });
  }

  // Capacitancia de membrana: es el parametro de seguimiento del protocolo y NO es salida del motor, asi
  // que sale del crudo del equipo por su header de contrato.
  if (puntos.length > 0) {
    const headerC = normalizeHeader(BIODY_COLUMNS.C.header);
    const { data: crudos } = await supabase
      .from("bis_raw_values")
      .select("value, bis_measurements!inner(evaluation_id)")
      .eq("variable_name", headerC)
      .in(
        "bis_measurements.evaluation_id",
        puntos.map((p2) => p2.evaluationId),
      );
    const porEval = new Map<string, number>();
    for (const r of (crudos ?? []) as unknown as {
      value: string | number | null;
      bis_measurements: { evaluation_id: string } | { evaluation_id: string }[];
    }[]) {
      const m = Array.isArray(r.bis_measurements) ? r.bis_measurements[0] : r.bis_measurements;
      const v = Number(r.value);
      if (m?.evaluation_id && Number.isFinite(v)) porEval.set(m.evaluation_id, v);
    }
    for (const pt of puntos) pt.c = porEval.get(pt.evaluationId) ?? null;
  }

  puntos.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const omitidas = Math.max(0, puntos.length - SERIE_MAX);
  return { puntos: puntos.slice(-SERIE_MAX), omitidas };
}
