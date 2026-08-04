// Cronologia clinica de las evaluaciones de un paciente. PURA (sin server-only ni BD): se prueba sin
// RLS. La usa comparison-reader para elegir la evaluacion previa; vive aparte para ser testeable.
//
// POR QUE EXISTE (no plegar esto de vuelta al reader ni "simplificarlo" a un ORDER BY created_at):
// la cronologia clinica de un paciente es la de sus MEDICIONES (measurement_date), NO la de sus
// REGISTROS (created_at). Una correccion crea una evaluacion nueva con created_at de HOY pero PRESERVA
// la measurement_date original; ordenar por created_at pondria un inicial corregido despues de un
// seguimiento real y desordenaria la historia sin que nada lo indique. Un ORDER BY created_at en la
// consulta parece mas simple y es exactamente el bug. La logica vive aqui, visible y con test, a
// proposito. Ver docs/BACKLOG.md (flujo de correccion, C2-a).

// Datos minimos de una evaluacion para ordenarla en la cronologia clinica.
export type EvalForChronology = {
  id: string;
  measurementDate: string | null; // cuando se MIDIO el paciente (ancla clinica)
  createdAt: string; // cuando se creo el REGISTRO (se mueve con una correccion; solo desempate)
};

// Elige la evaluacion PREVIA para la comparacion longitudinal. Ordena por measurement_date (la
// cronologia clinica es la de las MEDICIONES), NO por created_at: una correccion crea la evaluacion
// nueva con created_at de HOY pero PRESERVA measurement_date, asi que ordenar por created_at pondria
// un inicial corregido despues de un seguimiento real y desordenaria la historia.
// - Solo candidatas CON medicion: una evaluacion sin medir (draft) no es comparable; no se cuela.
// - Desempate DETERMINISTA por created_at si dos comparten measurement_date (una corregida y su
//   version anterior comparten fecha de medicion; el filtro de superseded ya deja una sola vigente,
//   pero el desempate garantiza un resultado estable ante cualquier empate). Sin el, el orden
//   dependeria de como devuelva la base y podria cambiar entre ejecuciones.
// El filtro de superseded se aplica en la consulta (una reemplazada no llega como candidata).
export function pickPreviousEvaluation(
  current: EvalForChronology,
  candidates: EvalForChronology[],
): string | null {
  if (!current.measurementDate) return null; // la actual sin medicion no ancla la comparacion
  const curM = new Date(current.measurementDate).getTime();
  const curC = new Date(current.createdAt).getTime();
  const before = candidates
    .filter((e) => e.measurementDate != null)
    .map((e) => ({ id: e.id, m: new Date(e.measurementDate as string).getTime(), c: new Date(e.createdAt).getTime() }))
    .filter((e) => e.m < curM || (e.m === curM && e.c < curC));
  if (before.length === 0) return null;
  // measurement_date descendente; a igual fecha, created_at descendente (desempate estable).
  before.sort((a, b) => b.m - a.m || b.c - a.c);
  return before[0].id;
}
