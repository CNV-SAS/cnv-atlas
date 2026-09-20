// ═══ UNA EVALUACION NO VE EL FUTURO (Santiago, 2026-09-20) ═══
//
// LO QUE ENCONTRO: abrio la evaluación INICIAL de un paciente y la pestaña Seguimiento le mostró el MISMO
// radar y los mismos mapas que la de seguimiento 1. Y su razonamiento es el correcto: el día de la inicial
// solo había una medición, así que no había evolución que mostrar. Comparar contra una consulta que
// todavía no había ocurrido no significa nada.
//
// LA CAUSA: los dos lectores de trayectoria resolvían el PACIENTE a partir de la evaluación y a partir de
// ahí leían TODAS sus mediciones, sin techo. Es la misma familia que las tres marcas en la gráfica: un
// lector que lee de más, y el resultado no se ve roto, se ve plausible. Verificado contra la nube antes de
// tocar nada: hay un paciente con dos puntos (2026-07-13 inicial y 2026-09-14 seguimiento), y hoy la
// inicial pinta los dos.
//
// POR QUE IMPORTA MAS DE LO QUE PARECE: una evaluación es un registro clínico SELLADO. Lo que se ve al
// abrirla tiene que ser lo que se vio ese día, porque es lo que sustenta el diagnóstico y el tratamiento
// que llevan su firma. Una pantalla que mezcla lo de entonces con lo de ahora no es "más información": es
// un documento clínico que ya no dice lo que decía.
//
// PURO (sin BD ni cliente): lo usan los dos lectores de trayectoria y sus tests. Vive aparte justo porque
// son DOS, y la regla escrita dos veces es la que se divide en dos reglas distintas.

/** Solo la parte de fecha (yyyy-MM-dd). Las mediciones llegan como fecha y `created_at` como instante. */
const soloFecha = (valor: string): string => valor.slice(0, 10);

/**
 * Hasta qué día llega la trayectoria que se ve DESDE esta evaluación.
 *
 * Es la fecha de MEDICION de la propia evaluación, que es su ancla clínica (la misma cronología que usa
 * `pickPreviousEvaluation`). Si todavía no se ha medido, el corte es el día en que se creó el registro:
 * una consulta abierta hoy ve toda la historia, y una abierta en julio no ve septiembre.
 */
export function corteDeLaSerie(
  medicionesDeLaEvaluacion: (string | null | undefined)[],
  createdAt: string,
): string {
  const fechas = medicionesDeLaEvaluacion
    .filter((d): d is string => typeof d === "string" && d.length > 0)
    .map(soloFecha);
  if (fechas.length === 0) return soloFecha(createdAt);
  return fechas.reduce((max, d) => (d > max ? d : max), fechas[0]);
}

/** Si un punto de la trayectoria ya existía cuando esta evaluación se hizo. El del mismo día, sí. */
export function dentroDelCorte(fecha: string, corte: string): boolean {
  return soloFecha(fecha) <= corte;
}
