import { adherenciaAdecuada, eventosQueImpidenComparar, medicionComparable } from "./modulo-s";
import { sonComparables } from "./services/eb-trajectory";

import type { ModuloSDelPunto, PuntoSerie, RefCapacitancia } from "./data/serie-types";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// RESPUESTA A LA INTERVENCION  ·  v15 §3, 2026-11-07, COMPLETADA EL 2026-11-09
//
// ═══ QUE PIDE SU v15 ═══
//
// Su tarjeta *"Respuesta a la intervención · Encuesta CNV-S"* (`cnvsTarjetaSeguimiento`, su L15978) compara
// contra la ULTIMA CONSULTA COMPARABLE y muestra tres cosas:
//
//   1. el delta del DFI (riesgo integrado, 0 a 100, menor es mejor), de la capacitancia y de la PABU;
//   2. la adherencia, S1 a S6 y las mediciones no comparables;
//   3. el escenario de su tabla 6, que cruza el delta del DFI con la adherencia.
//
// ═══ HASTA EL 8 DE NOVIEMBRE ESTE MODULO HACIA LA 1 Y SOLO LA 1 ═══
//
// La 2 y la 3 dependen del Modulo S, que no existia en Atlas, y la tarjeta lo DECIA en vez de callarlo:
// media tabla de decision con un eje inventado habria dicho *"respuesta compatible con la ruta"* sobre un
// paciente del que no se sabia si siguio la ruta.
//
// AHORA EL MODULO S EXISTE, se guarda y se lee (`ModuloSDelPunto` viaja con cada punto de la serie), asi
// que la tarjeta completa su parte. Lo que NO cambia es la regla: cuando falta uno de los dos ejes, el
// escenario sigue sin decirse. La diferencia es que antes faltaba SIEMPRE y ahora falta cuando falta.
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

/**
 * EL MODULO S DE ESTA CONSULTA, ya interpretado: sus respuestas y las dos reglas que salen de ellas.
 *
 * LAS DOS REGLAS VIENEN DE `modulo-s`, QUE ES LA UNICA DEFINICION. Aquí no se decide qué cuenta como
 * adherencia ni qué evento impide comparar: se pregunta. Si esta tarjeta lo decidiera por su cuenta,
 * habría dos respuestas posibles a *"¿este paciente siguió la ruta?"* según por dónde se mire.
 */
export type SeguimientoDeLaConsulta = {
  /** ¿La adherencia fue adecuada? `null` cuando no se puede decir (sin S3 no hay media regla). */
  adherencia: boolean | null;
  /** ¿La medición de esta consulta entra al delta? `false` con uno de sus tres eventos del S4. */
  comparable: boolean;
  /** Los eventos del S4 que la vuelven no comparable, para poder DECIR por qué. */
  eventos: string[];
  /** Las respuestas, tal como se guardaron, para escribir S1 a S6. */
  respuestas: ModuloSDelPunto;
};

/**
 * EL ESCENARIO DE SU TABLA 6: cuatro casillas, dos ejes.
 *
 * `delta` y `adherencia` viajan con el título porque la casilla sola no se puede auditar: quien lee la
 * tarjeta tiene que poder ver con qué dos coordenadas se eligió, y quien la revisa dentro de un año, con
 * qué dos coordenadas se eligió entonces.
 */
export type EscenarioDeRespuesta = {
  /** La casilla, con sus palabras. */
  titulo: string;
  delta: "mejora" | "sin mejora";
  adherencia: "adecuada" | "insuficiente";
};

/**
 * La casilla de su tabla 6 (§3), verbatim:
 *
 * | Delta del DFI | Adherencia adecuada | Adherencia insuficiente |
 * |---|---|---|
 * | Mejora | Respuesta compatible con la ruta | Mejora no atribuible a la ruta |
 * | Sin cambio o empeoramiento | Respuesta insuficiente con exposición adecuada | Exposición insuficiente |
 *
 * `null` CUANDO FALTA CUALQUIERA DE LOS DOS EJES, y esa es la regla que sostiene la tarjeta: sin el
 * delta del DFI (una sola consulta, o dos de escalas distintas del motor) y sin la adherencia (una
 * encuesta sin el S3) no hay casilla. Elegir una de las cuatro con un eje supuesto es afirmar sobre el
 * paciente algo que no se midió, y las cuatro frases son afirmaciones fuertes: dos de ellas le atribuyen
 * al tratamiento el resultado y las otras dos se lo quitan.
 *
 * "SIN CAMBIO" VA CON "EMPEORAMIENTO", como él lo escribió, y no con "mejora": su fila es *"sin cambio o
 * empeoramiento"*. Agruparlo con la mejora convertiría una intervención que no movió nada en una
 * respuesta a la ruta.
 */
export function escenarioDeLaTabla6(
  direccionDelRiesgo: Direccion,
  adherencia: boolean | null,
): EscenarioDeRespuesta | null {
  if (direccionDelRiesgo == null || adherencia == null) return null;
  const mejora = direccionDelRiesgo === "mejora";
  const titulo = mejora
    ? adherencia
      ? "Respuesta compatible con la ruta"
      : "Mejora no atribuible a la ruta"
    : adherencia
      ? "Respuesta insuficiente con exposición adecuada"
      : "Exposición insuficiente";
  return {
    titulo,
    delta: mejora ? "mejora" : "sin mejora",
    adherencia: adherencia ? "adecuada" : "insuficiente",
  };
}

export type RespuestaALaIntervencion = {
  /**
   * La consulta contra la que se compara. `null` cuando no hay ninguna con la que comparar y la tarjeta
   * sale solo con el Módulo S: es el caso de la primera CNV-S de un paciente cuya consulta anterior se
   * selló con otra escala del motor, o de una medición que su S4 dejó fuera del delta.
   */
  anterior: { evaluationId: string; fecha: string } | null;
  /** El riesgo integrado del DFI (0 a 100, menor es mejor). `null` si alguno de los dos sellos no lo trae. */
  riesgo: DeltaSeguimiento | null;
  /** La capacitancia de membrana. Su dirección es `null` sin referencia poblacional. */
  capacitancia: DeltaSeguimiento | null;
  /** La PABU, con φ como referencia. */
  pabu: DeltaSeguimiento | null;
  /** El Módulo S de esta consulta. `null` = no aplicó la CNV-S, y entonces no se habla de adherencia. */
  seguimiento: SeguimientoDeLaConsulta | null;
  /** La casilla de su tabla 6. `null` cuando falta uno de los dos ejes. */
  escenario: EscenarioDeRespuesta | null;
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

/** El Módulo S de un punto, con sus dos reglas resueltas. `null` si ese punto no lo tiene. */
function interpretar(moduloS: ModuloSDelPunto | null): SeguimientoDeLaConsulta | null {
  if (!moduloS) return null;
  return {
    adherencia: adherenciaAdecuada(moduloS),
    comparable: medicionComparable(moduloS),
    eventos: eventosQueImpidenComparar(moduloS),
    respuestas: moduloS,
  };
}

/**
 * La respuesta a la intervención de la consulta de `puntos.at(-1)`, o `null` si no hay nada que decir.
 *
 * `null` SOLO cuando no hay ni delta ni Módulo S: sin consultas, o con una sola que además no aplicó la
 * CNV-S. Con el Módulo S respondido la tarjeta sale aunque no haya con qué comparar, porque la adherencia
 * y los eventos intercurrentes son lectura de ESTA consulta y no de la pareja.
 *
 * LA ANTERIOR COMPARABLE SE BUSCA HACIA ATRÁS, no se toma la penúltima: si la penúltima es de otra era del
 * motor pero la anterior a esa es de la misma, esa última sí se puede comparar. Es lo que dice "la última
 * consulta comparable" y no "la anterior".
 *
 * ═══ Y UNA MEDICIÓN NO COMPARABLE NO ENTRA AL DELTA (su §3) ═══
 *
 * Textual: *"una medición marcada como no comparable se guarda y se informa, pero no entra al delta"*. Se
 * aplica a los DOS extremos, y hay que decirlo porque solo uno es evidente:
 *
 *   · si la de HOY lo es (su S4 trae enfermedad aguda, hospitalización o cirugía, o embarazo o
 *     lactancia), no se resta nada: el delta mediría el evento, no la intervención;
 *   · y si lo es la ANTERIOR, se sigue buscando hacia atrás, igual que con las escalas del motor. Restar
 *     contra la consulta de una neumonía hace que cualquier recuperación se lea como respuesta a la ruta.
 */
export function respuestaALaIntervencion(
  puntos: PuntoSerie[],
  refC: RefCapacitancia | null,
): RespuestaALaIntervencion | null {
  if (puntos.length === 0) return null;
  const ahora = puntos[puntos.length - 1];
  const seguimiento = interpretar(ahora.moduloS);

  // CON LA DE HOY FUERA DEL DELTA no se busca pareja: no es que no haya, es que no se resta.
  let anterior: PuntoSerie | null = null;
  if (seguimiento == null || seguimiento.comparable) {
    for (let i = puntos.length - 2; i >= 0; i -= 1) {
      if (!sonComparables(ahora.engineVersion, puntos[i].engineVersion)) continue;
      const suyo = interpretar(puntos[i].moduloS);
      if (suyo && !suyo.comparable) continue;
      anterior = puntos[i];
      break;
    }
  }
  if (!anterior && !seguimiento) return null;

  const par = (a: number | null, b: number | null): [number, number] | null =>
    anterior != null && a != null && b != null ? [a, b] : null;

  const rie = par(anterior?.riesgoScore ?? null, ahora.riesgoScore);
  const cap = par(anterior?.c ?? null, ahora.c);
  const pab = par(anterior?.pabu ?? null, ahora.pabu);

  const riesgo = rie ? menorEsMejor(rie[0], rie[1]) : null;

  return {
    anterior: anterior ? { evaluationId: anterior.evaluationId, fecha: anterior.fecha } : null,
    riesgo,
    // LA MEDIANA DE SU GRUPO, no un rango: su regla dice "acercarse a la mediana", y los percentiles son
    // para decir cuánto margen hay, no para decidir la dirección.
    capacitancia: cap ? acercarseEsMejor(cap[0], cap[1], refC?.mediana ?? null) : null,
    pabu: pab ? acercarseEsMejor(pab[0], pab[1], PHI) : null,
    seguimiento,
    escenario: escenarioDeLaTabla6(riesgo?.direccion ?? null, seguimiento?.adherencia ?? null),
  };
}
