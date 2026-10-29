// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA EDAD DE LA FICHA CONTRA LA DEL EQUIPO  ·  MODULO PURO (su error 5)
//
// ═══ DE DONDE SALE ═══
//
// Tabla 1 de su entrega del 2026-10-26, error 5: *"La edad de ATLAS no coincide con la del equipo · 6
// casos (diferencias de 3 a 20 años) · Correccion solicitada: unificar la fuente de la fecha de
// nacimiento; si hay discrepancia mayor de 1 año, ALERTAR ANTES DE CALCULAR."*
//
// Sus seis casos, del anexo A: 23 contra 14, 34 contra 43, 39 contra 42, 52 contra 72, 54 contra 35, 58
// contra 67. Veinte años de diferencia en uno de ellos.
//
// ═══ POR QUE AVISA Y NO FRENA ═══
//
// Dice "alertar", no "rechazar", y la diferencia importa: cual de las dos edades es la buena no lo puede
// saber el sistema. La de la ficha sale de una fecha de nacimiento que alguien escribio; la del equipo, de
// lo que se teclee en el BiodyXpert antes de medir. Frenar el diagnostico dejaria al paciente sin nada
// mientras la unica persona que puede resolverlo (la que lo tiene delante) se queda sin ver el problema.
//
// Y un freno que LANZA desde una accion es un 500 con la pantalla caida, que ya nos paso.
//
// ═══ EL UMBRAL ES SUYO, Y VA CON SU FUENTE AL LADO ═══
//
// Un año, de su texto literal ("discrepancia mayor de 1 año"). Es un criterio que decide sobre un dato
// clinico, asi que la regla del 2026-10-02 exige la fuente escrita aqui mismo, y la tiene: es el. Y el
// corte es ESTRICTO (mayor que 1), no mayor o igual: una diferencia de exactamente un año la explica el
// redondeo del equipo, que reporta la edad con decimales y la sube (su error 6: 30,95 pasa a 31) mientras
// Atlas trunca a años cumplidos. Avisar de eso seria avisar de lo normal.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Su umbral, literal: se avisa cuando la diferencia es MAYOR que un año. */
export const DIFERENCIA_DE_EDAD_TOLERADA = 1;

export type DiscordanciaDeEdad = {
  /** Años cumplidos desde la fecha de nacimiento de la ficha, a la fecha de la medicion. */
  edadDeLaFicha: number;
  /** La edad que el equipo reporto en esa toma, truncada a años cumplidos. */
  edadDelEquipo: number;
  /** Diferencia en años, siempre positiva. */
  diferencia: number;
};

/**
 * La discordancia, o `null` si no hay ninguna que avisar.
 *
 * `null` TAMBIEN cuando falta una de las dos edades, y es lo correcto: no se puede afirmar que dos cosas
 * no coinciden si una no se tiene. El dato que falta ya lo dice quien corresponda (la ficha sin fecha de
 * nacimiento deja la EB-BIS en "pendiente", con su motivo).
 *
 * LA DEL EQUIPO SE TRUNCA ANTES DE COMPARAR, porque llega con decimales: comparar 30,95 contra 30 daria
 * una diferencia de 0,95 que no significa nada, y comparar su redondeo (31) contra 30 daria 1, que su
 * umbral estricto ya deja pasar. Truncando, los dos lados miden lo mismo: años cumplidos.
 */
export function discordanciaDeEdad(
  edadDeLaFicha: number | null | undefined,
  edadDelEquipo: number | null | undefined,
): DiscordanciaDeEdad | null {
  if (edadDeLaFicha == null || !Number.isFinite(edadDeLaFicha)) return null;
  if (edadDelEquipo == null || !Number.isFinite(edadDelEquipo)) return null;
  const delEquipo = Math.trunc(edadDelEquipo);
  const diferencia = Math.abs(edadDeLaFicha - delEquipo);
  if (diferencia <= DIFERENCIA_DE_EDAD_TOLERADA) return null;
  return { edadDeLaFicha, edadDelEquipo: delEquipo, diferencia };
}

/**
 * El aviso, en palabras, para el profesional.
 *
 * DICE LAS DOS CIFRAS Y NO ELIGE, porque el sistema no sabe cual es la buena, y DICE QUE HACER: la fecha
 * de nacimiento de la ficha es la fuente que su correccion pide unificar, asi que el camino es
 * verificarla. Un aviso que solo dice "no coinciden" deja a quien lo lee sin saber donde mirar.
 */
export function avisoDeEdadDiscordante(d: DiscordanciaDeEdad): string {
  return (
    `La edad de la ficha (${d.edadDeLaFicha} años) y la que registró el equipo ` +
    `(${d.edadDelEquipo} años) difieren en ${d.diferencia} años. ` +
    "La edad entra en el cálculo de la edad biológica estimada, así que verifica la fecha de nacimiento " +
    "del paciente antes de usar este resultado."
  );
}
