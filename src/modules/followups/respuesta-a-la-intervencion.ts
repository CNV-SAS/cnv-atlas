import { sonComparables } from "./services/eb-trajectory";

import type { PuntoSerie, RefCapacitancia } from "./data/serie-types";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// RESPUESTA A LA INTERVENCION  ·  v15 §3, 2026-11-07
//
// ═══ QUE PIDE SU v15, Y QUE PARTE ENTRA HOY ═══
//
// Su tarjeta *"Respuesta a la intervención · Encuesta CNV-S"* (`cnvsTarjetaSeguimiento`, su L15978) compara
// contra la ULTIMA CONSULTA COMPARABLE y muestra tres cosas:
//
//   1. el delta del DFI (riesgo integrado, 0 a 100, menor es mejor), de la capacitancia y de la PABU;
//   2. la adherencia, S1 a S6 y las mediciones no comparables;
//   3. el escenario de su tabla 6, que cruza el delta del DFI con la adherencia.
//
// ESTE MODULO HACE LA 1, Y SOLO LA 1. La 2 y la 3 dependen del **Modulo S** de la encuesta CNV-S, que
// todavia no existe en Atlas: su tabla 6 tiene dos columnas ("adherencia adecuada" y "adherencia
// insuficiente") y sin el Modulo S no hay ninguna de las dos. Media tabla de decision, con un eje
// inventado, seria peor que ninguna: diria "respuesta compatible con la ruta" sobre un paciente del que no
// se sabe si siguio la ruta.
//
// La tarjeta lo DICE, en vez de callarlo. Es la regla de la casa con las piezas a medias.
//
// ═══ LAS TRES CIFRAS NO MEJORAN EN LA MISMA DIRECCION, Y ESO ES LO DELICADO ═══
//
//   · EL RIESGO INTEGRADO: menor es mejor. Lo dice su propio documento.
//   · LA CAPACITANCIA: mejorar es ACERCARSE A LA MEDIANA de su grupo de sexo y decada, no subir. Es su
//     regla del 2026-08-27 §9, y su razon esta medida: la capacitancia discrimina masa muscular baja por
//     ABAJO y adiposidad por ARRIBA, asi que un paciente que pasa de 2,40 a 4,00 nF puede estar ganando
//     grasa, no integridad de membrana. SIN REFERENCIA NO SE DICE SI MEJORO: se dice cuanto se movio.
//   · LA PABU: mejorar es acercarse a **φ = 1,618**, y tambien es bidireccional. Su ICA-BIS es justo esa
//     desviacion, y su lectura dice que la salud converge a φ: el deficit estructural la desvia por
//     encima y el exceso de adiposidad por debajo.
//
// Una tarjeta que pintara las tres con "subio = verde" diria lo contrario de su archivo en dos de las
// tres. Por eso cada una trae su propia direccion resuelta y la pantalla solo la pinta.
//
// ═══ Y NO SE RESTA ENTRE DOS ESCALAS ═══
//
// `sonComparables` compara la version MAYOR del motor y se niega a restar entre dos (criterio de
// `docs/VERSIONES.md`, cableado el 2026-10-24 para la banda de trayectoria). La misma puerta aqui: con la
// v7 y la v5 en los dos extremos, el delta mediria el cambio de ESCALA y se lo ensenaria al profesional
// como el cambio del paciente. "La ultima consulta COMPARABLE" de su v15 es literalmente esto.
//
// MODULO NEUTRO (sin `server-only` ni `"use client"`): lo importan el componente de pantalla y los tests.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El número áureo, que es la referencia de la PABU en su archivo. */
export const PHI = 1.618;

/** Hacia dónde se movió una cifra, ya interpretado. `null` = no se puede decir. */
export type Direccion = "mejora" | "empeora" | "sin-cambio" | null;

export type DeltaSeguimiento = {
  /** El valor de la consulta anterior comparable. */
  antes: number;
  /** El de esta consulta. */
  ahora: number;
  /** `ahora - antes`, con su signo. */
  delta: number;
  /**
   * Si eso es mejoría, empeoramiento o ninguna de las dos. `null` cuando la dirección no se puede decir:
   * la capacitancia sin referencia poblacional es el caso real.
   */
  direccion: Direccion;
};

export type RespuestaALaIntervencion = {
  /** La consulta contra la que se compara. */
  anterior: { evaluationId: string; fecha: string };
  /** El riesgo integrado del DFI (0 a 100, menor es mejor). `null` si alguno de los dos sellos no lo trae. */
  riesgo: DeltaSeguimiento | null;
  /** La capacitancia de membrana. Su dirección es `null` sin referencia poblacional. */
  capacitancia: DeltaSeguimiento | null;
  /** La PABU, con φ como referencia. */
  pabu: DeltaSeguimiento | null;
};

/** Un cambio por debajo de esto no se llama cambio: es ruido de redondeo de la propia cifra. */
const EPSILON = 0.005;

/** Una cifra donde MENOR es mejor (el riesgo integrado). */
function menorEsMejor(antes: number, ahora: number): DeltaSeguimiento {
  const delta = ahora - antes;
  return {
    antes,
    ahora,
    delta,
    direccion: Math.abs(delta) < EPSILON ? "sin-cambio" : delta < 0 ? "mejora" : "empeora",
  };
}

/**
 * Una cifra BIDIRECCIONAL, donde mejorar es acercarse a una referencia.
 *
 * Es la forma de la capacitancia (mediana de su grupo) y de la PABU (φ). Sin referencia la dirección es
 * `null` y la tarjeta dice cuánto se movió sin afirmar si eso es bueno, que es lo único honesto: subir
 * puede ser mejoría o lo contrario según de qué lado de la referencia estaba.
 */
function acercarseEsMejor(antes: number, ahora: number, referencia: number | null): DeltaSeguimiento {
  const delta = ahora - antes;
  if (referencia == null) return { antes, ahora, delta, direccion: null };
  const distanciaAntes = Math.abs(antes - referencia);
  const distanciaAhora = Math.abs(ahora - referencia);
  const cambio = distanciaAhora - distanciaAntes;
  return {
    antes,
    ahora,
    delta,
    direccion: Math.abs(cambio) < EPSILON ? "sin-cambio" : cambio < 0 ? "mejora" : "empeora",
  };
}

/**
 * La respuesta a la intervención de la consulta de `puntos.at(-1)`, o `null` si no hay con qué comparar.
 *
 * `null` en los tres casos en que compararía algo que no se puede comparar: una sola consulta, ninguna
 * anterior de la MISMA escala del motor, o la última sin versión sellada.
 *
 * LA ANTERIOR COMPARABLE SE BUSCA HACIA ATRÁS, no se toma la penúltima: si la penúltima es de otra era del
 * motor pero la anterior a esa es de la misma, esa última sí se puede comparar. Es lo que dice "la última
 * consulta comparable" y no "la anterior".
 */
export function respuestaALaIntervencion(
  puntos: PuntoSerie[],
  refC: RefCapacitancia | null,
): RespuestaALaIntervencion | null {
  if (puntos.length < 2) return null;
  const ahora = puntos[puntos.length - 1];

  let anterior: PuntoSerie | null = null;
  for (let i = puntos.length - 2; i >= 0; i -= 1) {
    if (sonComparables(ahora.engineVersion, puntos[i].engineVersion)) {
      anterior = puntos[i];
      break;
    }
  }
  if (!anterior) return null;

  const par = (a: number | null, b: number | null): [number, number] | null =>
    a != null && b != null ? [a, b] : null;

  const rie = par(anterior.riesgoScore, ahora.riesgoScore);
  const cap = par(anterior.c, ahora.c);
  const pab = par(anterior.pabu, ahora.pabu);

  return {
    anterior: { evaluationId: anterior.evaluationId, fecha: anterior.fecha },
    riesgo: rie ? menorEsMejor(rie[0], rie[1]) : null,
    // LA MEDIANA DE SU GRUPO, no un rango: su regla dice "acercarse a la mediana", y los percentiles son
    // para decir cuánto margen hay, no para decidir la dirección.
    capacitancia: cap ? acercarseEsMejor(cap[0], cap[1], refC?.mediana ?? null) : null,
    pabu: pab ? acercarseEsMejor(pab[0], pab[1], PHI) : null,
  };
}
