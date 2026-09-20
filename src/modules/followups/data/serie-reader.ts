import "server-only";

import { BIODY_COLUMNS } from "@/clinical-engine/edge/biody-columns";
import { normalizeHeader } from "@/modules/bis/services/header-map";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { capRef, clasificarCapacitancia } from "@/clinical-engine/capacitancia";
import { corteDeLaSerie, dentroDelCorte } from "../corte-de-la-serie";
import { edadEnFecha } from "@/lib/format/edad";

import { SERIE_MAX, type PuntoSerie, type RefCapacitancia, type SerieSeguimiento } from "./serie-types";

export { SERIE_MAX };
export type { PuntoSerie, SerieSeguimiento };

// SERIE de seguimiento: las evaluaciones VIGENTES del paciente con su medición y su snapshot, en orden
// cronológico, HASTA la evaluación desde la que se mira. Alimenta los gráficos de tendencia y el radar.
//
// EL TECHO NO ES UN DETALLE (Santiago, 2026-09-20): sin él, abrir la evaluación inicial mostraba el mismo
// radar que la de seguimiento, porque pintaba consultas que ese día no habían ocurrido. Ver
// `corte-de-la-serie.ts`.
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
    .select("patient_id, created_at, bis_measurements(measurement_date)")
    .eq("id", evaluationId)
    .maybeSingle();
  const patientId = ev?.patient_id as string | undefined;
  if (!patientId) return { puntos: [], omitidas: 0, refC: null };
  // HASTA DONDE LLEGA ESTA EVALUACION. Sin este techo, la pestaña Seguimiento de una evaluacion vieja
  // pintaba las consultas POSTERIORES, que el dia que se selló no existían. Ver `corte-de-la-serie.ts`.
  const corte = corteDeLaSerie(
    ((ev as { bis_measurements?: { measurement_date: string | null }[] }).bis_measurements ?? []).map(
      (m) => m.measurement_date,
    ),
    (ev as { created_at: string }).created_at,
  );
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, evaluation_id, created_at, snapshot, evaluations!inner(superseded_at, bis_measurements(measurement_date))",
    )
    .eq("patient_id", patientId)
    .eq("type", "paciente")
    // Mas reciente primero: de cada evaluacion se queda el PRIMERO que se vea (ver el dedupe abajo).
    .order("created_at", { ascending: false });
  if (error) throw new Error(`serie-reader: ${error.message}`);

  const puntos: PuntoSerie[] = [];
  // ═══ UN PUNTO POR EVALUACION, NO POR REPORTE (2026-09-19) ═══
  //
  // EL DEFECTO QUE CIERRA, reportado por Santiago: en las tres graficas salian TRES puntos el mismo dia
  // donde solo habia UNA evaluacion. La serie recorria los REPORTES, y una evaluacion puede tener varios:
  // regenerar el diagnostico crea otro, y desde el 2026-09-19 tambien lo hace emitir una version nueva del
  // informe. Cada uno se convertia en un punto de la trayectoria, en la misma fecha.
  //
  // NO ES COSMETICO: la trayectoria es lo que el profesional lee para decidir si el paciente mejora, y una
  // grafica que pinta tres veces la misma medicion sugiere tres controles que no existieron.
  //
  // SE QUEDA EL MAS RECIENTE de cada evaluacion, que es el documento vigente (el mismo criterio que usan
  // la tarjeta del informe y el lector del tratamiento).
  const vistas = new Set<string>();
  for (const row of (data ?? []) as unknown as (Fila & { evaluation_id: string })[]) {
    if (vistas.has(row.evaluation_id)) continue;
    vistas.add(row.evaluation_id);
    const ev = row.evaluations;
    // Una evaluacion REEMPLAZADA por una correccion no es un punto de la trayectoria: comparariamos
    // contra el yo pre-correccion del paciente (misma regla que ya aplica comparison-chronology).
    if (!ev || ev.superseded_at != null) continue;
    const fechas = (ev.bis_measurements ?? []).map((m) => m.measurement_date).filter((d): d is string => d != null);
    if (fechas.length === 0) continue; // sin medicion no hay punto en el tiempo
    const fecha = fechas.reduce((max, d) => (d > max ? d : max), fechas[0]);
    // Lo posterior a esta evaluacion no es parte de SU trayectoria.
    if (!dentroDelCorte(fecha, corte)) continue;
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
  const enPantalla = puntos.slice(-SERIE_MAX);

  // LA REFERENCIA DE CAPACITANCIA (porte del 2026-08-26 §9.1, cableado el 2026-09-01). El modulo estaba
  // portado con sus doce filas verbatim y su candado, y la tarjeta lo decia: "la referencia de su grupo
  // aun no se muestra aqui". Era una pieza terminada a la que le faltaba el ultimo cable.
  //
  // SE RESUELVE CON LA ULTIMA MEDICION, no con la primera: la decada de edad puede cambiar a lo largo del
  // seguimiento, y la comparacion que le importa al profesional es la de hoy.
  const ultimo = enPantalla[enPantalla.length - 1];
  let refC: RefCapacitancia | null = null;
  if (ultimo) {
    // El sexo y la fecha de nacimiento son PII y viven en `patient_profiles`, no en `patients`.
    const { data: pac } = await supabase
      .from("patient_profiles")
      .select("sex, birth_date")
      .eq("patient_id", patientId)
      .maybeSingle();
    const sexo = (pac?.sex as string | null) ?? null;
    const edad = edadEnFecha((pac?.birth_date as string | null) ?? null, ultimo.fecha);
    const r = capRef(sexo, edad);
    if (r) {
      const cl = clasificarCapacitancia(ultimo.c, sexo, edad);
      refC = {
        mediana: r.p50,
        p25: r.p25,
        p75: r.p75,
        n: r.n,
        valor: Number(ultimo.c),
        etiqueta: cl.l,
        banda: cl.banda,
        grupo: `${r.sexo === "M" ? "Hombres" : "Mujeres"} ${r.d[0]}-${r.d[1]}`,
      };
    }
  }

  return { puntos: enPantalla, omitidas, refC };
}
