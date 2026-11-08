// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE INSTRUMENTO SE APLICA EN UNA CONSULTA  ·  v15 §2.1, 2026-11-07
//
// Su regla, textual: *"La primera consulta usa la encuesta completa (línea base). **Desde la segunda
// consulta se aplica la CNV-S.**"*
//
// ═══ Y HOY NO SE APLICA A NADIE, A PROPOSITO ═══
//
// La CNV-S esta CONSTRUIDA y NO ACTIVA. El interruptor es esta constante, y es una constante y no una
// variable de entorno por tres razones concretas:
//
//   · una variable de entorno hay que documentarla en DEPLOY.md y tiene TRES estados (puesta, vacia,
//     ausente), que es justo la forma en que una bandera se queda encendida sin que nadie lo sepa;
//   · una constante se ve EN EL DIFF el dia que alguien la quiera encender de verdad;
//   · y para el smoke basta cambiarla en local, que es lo unico que hace falta hoy.
//
// CUANDO SE ENCIENDA, lo que hay que mirar primero esta escrito en `PLAN_CNVS_2026-11-07.md` §6: cambia
// la pantalla que llena el paciente, que es la superficie de los nueve hazards de navegador.
//
// MODULO NEUTRO (sin `server-only` ni `"use client"`): lo leen el lector de la encuesta, que es de
// servidor, el formulario, que es de cliente, y los tests.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El codigo del instrumento de la primera consulta. Es el que se guarda en los DATOS, y es suyo. */
export const CODIGO_LINEA_BASE = "CNV v2.0";

/** El codigo del instrumento de seguimiento. */
export const CODIGO_SEGUIMIENTO = "CNV-S 1.0";

/**
 * EL INTERRUPTOR. `false` = ningun paciente ve la CNV-S y todo seguimiento sigue con la encuesta
 * completa, que es exactamente lo que pasaba ayer.
 *
 * NO SE ENCIENDE sin: (a) el smoke en navegador del plan, (b) el visto bueno de Gildardo sobre el
 * Modulo S y (c) resolver la pregunta 39 (si el marco de referencia pide version nueva del instrumento).
 */
export const CNVS_ACTIVA = false;

/**
 * El codigo del instrumento que le toca a una consulta.
 *
 * UNA SOLA FUNCION lo decide, y por eso recibe el tipo de la consulta en vez de leerlo: si cada pantalla
 * resolviera su instrumento, el dia que la regla cambie habria que encontrarlas todas, y la que se quede
 * atras aplicaria OTRO cuestionario sin que nada falle. Es la misma razon por la que `sonComparables`
 * vive en un sitio.
 */
export function instrumentoParaLaConsulta(tipo: "inicial" | "seguimiento"): string {
  if (tipo === "seguimiento" && CNVS_ACTIVA) return CODIGO_SEGUIMIENTO;
  return CODIGO_LINEA_BASE;
}
