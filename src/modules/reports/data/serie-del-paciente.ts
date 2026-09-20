import "server-only";

import { BIODY_COLUMNS } from "@/clinical-engine/edge/biody-columns";
import { normalizeHeader } from "@/modules/bis/services/header-map";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { corteDeLaSerie, dentroDelCorte } from "@/modules/followups/corte-de-la-serie";

// ═══ LA TRAYECTORIA QUE EL PACIENTE PUEDE VER (2026-09-20) ═══
//
// QUE LLEVA Y POR QUE ESAS TRES. Peso, masa grasa y masa sin grasa, en kilos, por consulta.
//
// NO ES UNA ELECCION DE DISEÑO, es la regla de siempre: al paciente NO le va ningun indice del modelo
// (§7.1 de Gildardo), asi que la capacitancia, el PABU o el ICA-BIS quedan fuera, y tambien la edad
// bioelectrica. Lo que SI es suyo son las cifras de composicion que su propio archivo ya le manda en el
// informe amigable (P-50: peso, masa grasa en kg y %, masa magra...). Graficar lo que ya recibe en texto
// no le añade nada nuevo: se lo ordena en el tiempo.
//
// SALE DEL CRUDO DEL EQUIPO, no del snapshot del motor: son medidas, no salidas. Y una sola consulta para
// todas las mediciones del paciente, en vez de una por evaluacion, porque esto vive en el camino del
// ENVIO del informe y ahi cada lectura de mas se nota (la leccion del 504).

export type PuntoDelPaciente = {
  /** yyyy-MM-dd de la medicion. La vista la formatea. */
  fecha: string;
  pesoKg: number | null;
  grasaKg: number | null;
  magraKg: number | null;
};

/** Cuantas consultas se muestran. Mas puntos en una hoja carta no se leen. */
export const MAX_PUNTOS = 6;

type Fila = {
  value: string | number | null;
  variable_name: string;
  bis_measurements: { measurement_date: string | null; evaluations: { patient_id: string } | null } | null;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * La serie del paciente de ESTA evaluación, en orden cronológico. Vacía si no hay mediciones, y entonces
 * el documento no pinta el bloque: una gráfica de un solo punto no es una trayectoria.
 */
export async function getSerieDelPaciente(evaluationId: string): Promise<PuntoDelPaciente[]> {
  const supabase = await createSupabaseServerClient();

  const { data: ev } = await supabase
    .from("evaluations")
    .select("patient_id, created_at, bis_measurements(measurement_date)")
    .eq("id", evaluationId)
    .maybeSingle();
  const patientId = ev?.patient_id as string | undefined;
  if (!patientId) return [];
  // HASTA DONDE LLEGA ESTA EVALUACION (Santiago, 2026-09-20). El informe que se emite desde una evaluación
  // es el documento de ESE día: si la gráfica pintara consultas posteriores, reimprimir un informe viejo
  // devolvería otro documento. Ver `corte-de-la-serie.ts`.
  const corte = corteDeLaSerie(
    ((ev as { bis_measurements?: { measurement_date: string | null }[] }).bis_measurements ?? []).map(
      (m) => m.measurement_date,
    ),
    (ev as { created_at: string }).created_at,
  );

  const columnas = {
    peso: normalizeHeader(BIODY_COLUMNS.peso.header),
    grasa: normalizeHeader(BIODY_COLUMNS.FM.header),
    magra: normalizeHeader(BIODY_COLUMNS.FFM.header),
  };

  const { data, error } = await supabase
    .from("bis_raw_values")
    .select("value, variable_name, bis_measurements!inner(measurement_date, evaluations!inner(patient_id))")
    .eq("bis_measurements.evaluations.patient_id", patientId)
    .in("variable_name", [columnas.peso, columnas.grasa, columnas.magra]);
  if (error) return [];

  // POR FECHA DE MEDICION, que es la cronologia clinica (no la de creacion del registro). Dos mediciones
  // del mismo dia se funden en un punto: el paciente hizo una consulta, no dos.
  const porFecha = new Map<string, PuntoDelPaciente>();
  for (const fila of (data ?? []) as unknown as Fila[]) {
    const m = fila.bis_measurements;
    const fecha = m?.measurement_date?.slice(0, 10);
    if (!fecha) continue;
    // Lo posterior a esta evaluacion no es parte de SU trayectoria.
    if (!dentroDelCorte(fecha, corte)) continue;
    const punto = porFecha.get(fecha) ?? { fecha, pesoKg: null, grasaKg: null, magraKg: null };
    if (fila.variable_name === columnas.peso) punto.pesoKg = num(fila.value);
    if (fila.variable_name === columnas.grasa) punto.grasaKg = num(fila.value);
    if (fila.variable_name === columnas.magra) punto.magraKg = num(fila.value);
    porFecha.set(fecha, punto);
  }

  return [...porFecha.values()]
    .filter((p) => p.pesoKg != null || p.grasaKg != null || p.magraKg != null)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    .slice(-MAX_PUNTOS);
}
