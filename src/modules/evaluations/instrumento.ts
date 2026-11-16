// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE INSTRUMENTO SE APLICA EN UNA CONSULTA  ·  v15 §2.1, 2026-11-07
//
// Su regla, textual: *"La primera consulta usa la encuesta completa (línea base). **Desde la segunda
// consulta se aplica la CNV-S.**"*
//
// ═══ ACTIVA PARA TODOS DESDE EL 2026-11-16 ═══
//
// Estuvo construida y apagada desde el 7 de noviembre. Santiago la encendio el 16, con el smoke de los
// tres casos pasando; lo que sigue abierto esta escrito en `CNVS_ACTIVA`, abajo. El interruptor es esa
// constante, y es una constante y no una variable de entorno por tres razones concretas:
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
 * ═══ APROBADA PARA PACIENTES REALES  ·  ENCENDIDA EL 2026-11-16 ═══
 *
 * Esto NO es "la CNV-S existe": es *"se le aplica a una persona que vino a consulta"*. Con `true`, toda
 * consulta de SEGUIMIENTO (la segunda en adelante, de cualquier paciente) aplica la CNV-S.
 *
 * LA DECISION ES DE SANTIAGO, con el smoke de los tres casos repetido y pasando (sin nutraceuticos en
 * la anterior, todos adherentes, alguno no adherente), que es el que el gate de completitud bloqueaba
 * hasta el 15 de noviembre. Textual suyo: *"Decisión: CNVS_ACTIVA = true para pacientes reales"*.
 *
 * ═══ Y LO QUE SIGUE ABIERTO SIGUE ABIERTO, QUE NO ES LO MISMO QUE RESUELTO ═══
 *
 * El runbook pedia TRES precondiciones y se cumple una: el smoke. Las otras dos son de Gildardo y
 * quedan pendientes, asi que esto se enciende SIN su visto bueno clinico, por decision de Santiago:
 *
 *   · las cinco preguntas de la seccion H de `PENDIENTES_CIENTIFICOS.md` (39, 40, 43, 46, 47);
 *   · la 39 en particular, que es la unica que podria obligar a cambiar el INSTRUMENTO (si el marco de
 *     referencia por seccion pide una version nueva).
 *
 * Si la 39 se responde pidiendo version nueva, lo que ya se haya aplicado queda sellado con la 1.0 y
 * hay que emitir una 1.1; las consultas selladas NO se reescriben (regla 7). Eso es lo que esta
 * decision acepta, y queda escrito aqui para que no haya que reconstruirlo despues.
 *
 * COMO SE APAGA: se vuelve esta constante a `false` y se pushea. Una consulta que YA sello la CNV-S
 * sigue viendola (las pantallas leen el sello, no la regla), asi que apagar no rompe lo que esta a
 * medias: solo cambia que se le aplica a las consultas NUEVAS. No hay nada que migrar ni que deshacer.
 * Dejar `CNVS_EN_PRUEBAS = true` conserva el estado anterior: solo pacientes de prueba.
 */
export const CNVS_ACTIVA = true;

/**
 * ═══ EN PRUEBAS: SOLO PACIENTES DE PRUEBA, TAMBIEN EN PRODUCCION (Santiago, 2026-11-08) ═══
 *
 * *"En producción, la CNV-S se aplica SOLO a pacientes de prueba (is_test), no con un interruptor
 * global. Los reales siguen con CNV v2.0 hasta la aprobación."*
 *
 * ES UNA SEGUNDA BANDERA Y NO UN VALOR MAS DE LA PRIMERA, porque dicen dos cosas distintas: aquella es
 * una decision CLINICA (la encuesta esta aprobada) y esta es una decision OPERATIVA (se esta probando).
 * Juntarlas en un enum de tres estados obligaria a mirar cual es cual en cada lectura, y el dia que la
 * aprueben habria que acordarse de apagar el modo pruebas en el mismo movimiento.
 *
 * ═══ LA PUERTA ES `cuenta_como_de_prueba`, NO `is_test` ═══
 *
 * Y la diferencia importa: `is_test` es la DECISION sobre una persona, y `cuenta_como_de_prueba` es su
 * consecuencia mas la DERIVADA (0202/0203), que incluye a todo paciente de un profesional marcado de
 * prueba. Es exactamente lo que Santiago propone (*"los pacientes de un profesional marcado de
 * prueba"*), ya esta calculado, y es la misma columna por la que esos pacientes no entran a /obbia ni a
 * la cohorte. Filtrar por `is_test` dejaria fuera la derivada, que es el error que el candado del
 * barrido ya vigila en otro sitio.
 */
export const CNVS_EN_PRUEBAS = true;

/**
 * EL CABLE QUE FALTABA, PUESTO EL 2026-11-08: las cuatro acciones y las tres pantallas de la encuesta
 * resuelven el instrumento con esta funcion (`data/instrumento-de-la-consulta`) en vez de pedir siempre
 * la linea base. Sin el, el Modulo S se habria perdido EN SILENCIO al enviar.
 *
 * Lo que sigue sin escribirse: `survey_responses.confirmacion` y `minutos_de_diligenciamiento`. Las
 * columnas estan (0240) y el ESTADO de cada confirmacion es lo unico que se pierde; la RESPUESTA
 * confirmada si viaja, porque "Sin cambios" emite el valor anterior como respuesta.
 */
export const CABLE_PENDIENTE = null;

/**
 * El codigo del instrumento que le toca a una consulta.
 *
 * UNA SOLA FUNCION lo decide, y por eso recibe los datos en vez de leerlos: si cada pantalla resolviera
 * su instrumento, el dia que la regla cambie habria que encontrarlas todas, y la que se quede atras
 * aplicaria OTRO cuestionario sin que nada falle. Es la misma razon por la que `sonComparables` vive en
 * un sitio.
 *
 * ═══ EL ORDEN DE LAS TRES PUERTAS NO ES ARBITRARIO ═══
 *
 *   1. UNA INICIAL NUNCA ES CNV-S, pase lo que pase con los interruptores. Es su §2.1 y no admite
 *      excepcion: sin linea base no hay nada que confirmar ni contra que comparar.
 *   2. APROBADA: se aplica a todo el mundo.
 *   3. EN PRUEBAS: **solo** si el paciente cuenta como de prueba.
 *
 * Y LA PROPIEDAD QUE EL CANDADO FIJA: con `CNVS_ACTIVA` en `false`, un paciente REAL no puede recibir la
 * CNV-S por ningun camino. El modo pruebas no puede alcanzarlo.
 */
export function instrumentoParaLaConsulta(
  tipo: "inicial" | "seguimiento",
  /**
   * Si el paciente cuenta como de prueba (`patients.cuenta_como_de_prueba`, con su derivada). Es un
   * parametro OBLIGATORIO y no opcional con `false` por defecto: un llamador que se olvide tiene que
   * fallar al compilar, no decidir en silencio sobre un paciente real.
   */
  cuentaComoDePrueba: boolean,
): string {
  if (tipo !== "seguimiento") return CODIGO_LINEA_BASE;
  if (CNVS_ACTIVA) return CODIGO_SEGUIMIENTO;
  if (CNVS_EN_PRUEBAS && cuentaComoDePrueba) return CODIGO_SEGUIMIENTO;
  return CODIGO_LINEA_BASE;
}
