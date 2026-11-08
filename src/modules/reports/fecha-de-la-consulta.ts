// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA FECHA DE LA CONSULTA, EN UN SOLO SITIO  ·  Santiago, 2026-11-08
//
// ═══ EL DEFECTO: DOS DOCUMENTOS DE LA MISMA CONSULTA CON DOS FECHAS ═══
//
// En la paciente de verificacion, el INFORME decia *"25 de agosto"* y la HISTORIA CLINICA *"20/8/2026"*.
// No es un error de formato: eran dos definiciones.
//
//   · el informe leia la fecha de la MEDICION (con `created_at` de respaldo), que se arreglo asi el
//     2026-11-03 porque la consulta salia ANTERIOR a la medicion y eso, leido por el paciente, es
//     absurdo: lo midieron en una consulta que ya habia terminado;
//   · la historia clinica leia `evaluations.created_at` a secas, que es el instante en que el
//     profesional ABRIO LA FICHA. Abrirla antes de la cita es normal (se prepara, se manda el enlace,
//     el paciente responde en casa). Lo que no es cierto es llamar a eso la fecha de la consulta.
//
// ═══ Y EN LA HISTORIA CLINICA ARRASTRABA ALGO MAS QUE UNA FECHA ═══
//
// La HC imprime la EDAD del paciente calculada A ESA FECHA. Con la fecha de apertura de la ficha, la
// edad impresa en la historia clinica podia no ser la misma que el motor uso para diagnosticar, que la
// calcula a la fecha de la TOMA (su EB-BIS v7 §3.1). Dos edades del mismo paciente en el mismo caso.
//
// ═══ LA DEFINICION QUE MANDA, Y POR QUE ESTA ═══
//
// LA ATENCION OCURRIO EL DIA DE LA MEDICION, que es cuando el paciente estuvo delante del equipo.
// `created_at` queda de respaldo para las consultas que todavia no tienen toma.
//
// Y ES LA MISMA REGLA QUE YA RIGE EN LA BASE: `evaluaciones_vigentes` agrupa por
// `coalesce(dia, created_at)`. Una consulta no puede contarse en octubre para la cohorte, en noviembre
// para el paciente y en agosto para su historia clinica.
//
// MODULO NEUTRO (sin `server-only`): lo usan el repositorio de informes y el lector de la historia
// clinica, los dos de servidor, y los tests.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * La fecha de la consulta, en ISO.
 *
 * @param createdAt      Cuando se abrio la ficha. Es el respaldo, no la definicion.
 * @param medicionesISO  Las fechas de medicion de la consulta. Si hay varias manda LA ULTIMA, que es la
 *                       toma vigente (la misma regla que el resto de los lectores: la que entro despues
 *                       es la que vale).
 */
export function fechaDeLaConsulta(
  createdAt: string,
  medicionesISO: (string | null | undefined)[],
): string {
  const fechas = medicionesISO.filter((d): d is string => Boolean(d && String(d).trim() !== ""));
  if (fechas.length === 0) return createdAt;
  // ORDEN LEXICOGRAFICO sobre ISO, que para fechas ISO es orden cronologico. No se pasa por `new Date()`
  // a proposito: una fecha pura (yyyy-MM-dd) convertida a Date se interpreta en UTC y puede retroceder
  // un dia al mostrarse, que es el defecto que ya aparecio en la leyenda del radar.
  return [...fechas].sort()[fechas.length - 1];
}
