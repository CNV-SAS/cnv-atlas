// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS CUATRO REGLAS DEL MODULO S  ·  v15 §2.3, §2.7, §7.2 y §7.3  ·  2026-11-07
//
// ═══ QUE HAY AQUI, Y POR QUE JUNTO ═══
//
// Las cuatro cosas que la CNV-S DERIVA de sus respuestas, y que ninguna pantalla puede decidir por su
// cuenta: si la adherencia fue adecuada, si la medicion es comparable, si los sintomas digestivos se
// saltan, y si toca la reconfirmacion anual. Son reglas suyas, no interpretaciones nuestras, y viven en
// un solo sitio porque cada una la leen DOS superficies por lo menos (el formulario y la tarjeta de
// seguimiento, y luego el export).
//
// ═══ LO QUE NO SE GUARDA EN UNA COLUMNA, Y POR QUE ═══
//
// Su §2.7 lista `cnvsNoComparable` y `cnvsAdherenciaAdecuada` como campos. En Atlas son DERIVADOS de
// respuestas que ya estan selladas en `survey_answers`: darles columna seria el mismo hecho en dos
// sitios que pueden divergir, y el dia que su regla cambie habria filas viejas calculadas con la vieja y
// nadie sabria cuales. Se calculan al leerlas, con estas funciones, que son la unica definicion.
//
// MODULO NEUTRO (sin `server-only` ni `"use client"`): lo usan el formulario, que es de cliente, los
// lectores del servidor y los tests.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * LAS SIETE CLAVES DEL MODULO S, para quien tenga que pedirlas a la base.
 *
 * Viven aqui y no en cada lector: son las preguntas PROPIAS del instrumento de seguimiento (su tabla
 * 3 las llama `propio`), y una lista repetida en dos consultas se desincroniza en cuanto el añada una.
 */
export const CLAVES_DEL_MODULO_S = [
  "cnvs_s1",
  "cnvs_s2",
  "cnvs_s3",
  "cnvs_s4",
  "cnvs_s5",
  "cnvs_s6",
  "cnvs_gi_filtro",
] as const;

/** Las cinco opciones del S1, verbatim de su §2.3. */
export const S1_OPCIONES = [
  "Todos los días",
  "5 o más días por semana",
  "Menos de 5 días por semana",
  "No lo tomó",
  "Lo suspendió",
] as const;

/** Las dos que cuentan como adherencia al producto. Su regla: *"Todos los días o 5 o más"*. */
const S1_ADHERENTES = new Set<string>([S1_OPCIONES[0], S1_OPCIONES[1]]);

/**
 * LOS PRODUCTOS A LOS QUE HAY QUE PRESENTARLES EL S2, desde el S1 que el paciente acaba de contestar.
 *
 * Su §2.3: el S2 se presenta *"solo si S1 no es «Todos los días» ni «5 o más»"*, o sea para los que NO
 * cuentan como adherentes, que es la misma frontera de `S1_ADHERENTES`. Vive aqui, con la regla, y no en
 * el formulario: ahi estaba escrita a mano con las dos cadenas copiadas, o sea una SEGUNDA definicion de
 * "adherente al producto" en una pantalla. El dia que el mueva la frontera, se mueve en un sitio.
 */
export function noAdherentesAlProducto(s1: Record<string, string>): Set<string> {
  const salida = new Set<string>();
  for (const [id, v] of Object.entries(s1)) {
    if (!S1_ADHERENTES.has(String(v))) salida.add(id);
  }
  return salida;
}

/** Las dos del S3 que cuentan como adherencia al plan. Su regla: *"Casi todo o Todo"*. */
const S3_ADHERENTES = new Set<string>(["Casi todo", "Todo"]);

/**
 * LOS TRES EVENTOS DEL S4 QUE VUELVEN LA MEDICION NO COMPARABLE, verbatim de su §2.7:
 * *"enfermedad aguda, hospitalización o cirugía, o embarazo o lactancia"*.
 *
 * LOS OTROS TRES NO ENTRAN, y la diferencia importa: un medicamento nuevo, un cambio de turno o un
 * evento estresante mayor son contexto que el profesional tiene que ver, pero no invalidan la
 * bioimpedancia. Meterlos aqui dejaria fuera del delta a casi todo el mundo, y entonces la tarjeta de
 * seguimiento no compararia nunca.
 */
const S4_NO_COMPARABLES = new Set<string>([
  "Enfermedad aguda (fiebre, infección, diarrea)",
  "Hospitalización o cirugía",
  "Embarazo o lactancia",
]);

/** Las respuestas del Modulo S de una consulta, ya leidas por su clave. */
export type RespuestasDelModuloS = {
  /** S1: una respuesta POR PRODUCTO. `{}` o null = no se presento (no habia ninguno indicado). */
  s1: Record<string, string> | null;
  /** S3: en que medida siguio el plan de alimentacion. */
  s3: string | null;
  /** S4: los eventos marcados. */
  s4: string[] | null;
};

// SOLO ESTAS TRES ENTRAN EN LAS DOS REGLAS DE ABAJO, y es deliberado: el S2 (por que no lo tomo), el
// S5 (si intento cambiar de peso) y el S6 (como se siente) son contexto que el profesional lee, no
// insumos de la adherencia ni de la comparabilidad. Un tipo que pidiera los seis obligaria a los
// llamadores a traer datos que la regla no usa.

/**
 * ¿LA ADHERENCIA FUE ADECUADA? Su regla: *"S1 en «Todos los días» o «5 o más» para todos los indicados,
 * y S3 en «Casi todo» o «Todo»"*.
 *
 * `null` cuando no se puede decir: sin S3 no hay la mitad de la regla, y afirmar "insuficiente" sobre
 * una encuesta a medias le atribuiria al paciente algo que no dijo. La tarjeta de seguimiento cruza esto
 * con el delta del DFI en su tabla 6, y media tabla de decision con un eje inventado es peor que
 * ninguna.
 *
 * CUANDO NO HAY NINGUN PRODUCTO INDICADO, la adherencia se decide SOLO con el S3. Es la decision A de la
 * pregunta 34, con su razon medida: de los 30 pacientes con dos o mas consultas, 18 no tienen ningun
 * nutraceutico en la anterior, asi que exigir el S1 dejaria a la mayoria sin adherencia calculable.
 */
export function adherenciaAdecuada(r: RespuestasDelModuloS): boolean | null {
  if (!r.s3 || r.s3.trim() === "") return null;
  const planOk = S3_ADHERENTES.has(r.s3);
  const productos = Object.entries(r.s1 ?? {}).filter(([, v]) => v != null && String(v).trim() !== "");
  if (productos.length === 0) return planOk;
  const todosOk = productos.every(([, v]) => S1_ADHERENTES.has(String(v)));
  return planOk && todosOk;
}

/**
 * ¿LA MEDICION DE ESTA CONSULTA ES COMPARABLE? `false` cuando el S4 trae uno de sus tres eventos.
 *
 * SIN S4 SE DEVUELVE `true`, y es deliberado: su regla dice cuando NO es comparable, y una encuesta sin
 * el S4 respondido no es una enfermedad aguda. Lo que la encuesta no diga no se puede leer como que
 * paso algo.
 *
 * Su §3 lo usa asi: *"una medición marcada como no comparable se guarda y se informa, pero no entra al
 * delta"*. No se descarta: se dice.
 */
export function medicionComparable(r: RespuestasDelModuloS): boolean {
  return eventosQueImpidenComparar(r).length === 0;
}

/**
 * CUALES de sus tres eventos trae el S4. Vacio = la medicion es comparable.
 *
 * LA TARJETA TIENE QUE PODER DECIR POR QUE no compara. "No comparable" a secas obliga al profesional a
 * abrir la encuesta para averiguar que paso, y lo que paso (una cirugia, un embarazo) es justamente lo
 * que necesita leer al lado de la medicion. La regla sigue siendo UNA: `medicionComparable` es esto
 * mismo preguntado en si/no.
 */
export function eventosQueImpidenComparar(r: RespuestasDelModuloS): string[] {
  return (r.s4 ?? []).filter((e) => S4_NO_COMPARABLES.has(e));
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA REGLA DE SALTO DE LOS SINTOMAS DIGESTIVOS  ·  §7.2
//
// Textual: *"Si la respuesta es «No» y en la consulta anterior los siete se registraron como «Nunca», se
// guardan los siete como «Nunca» sin presentarlos. En cualquier otro caso se presentan los siete."*
//
// LAS DOS CONDICIONES SON **Y**, y escribirlo como un O es el error facil: con solo el "No" de hoy se
// saltarian los siete de un paciente que la vez pasada tenia reflujo frecuente, y su historia diria
// "Nunca" sobre un sintoma que nadie volvio a preguntar.
//
// Y LO QUE SE SALTA **SE GUARDA**: los siete quedan en "Nunca", no vacios. Un salto que deja huecos
// convierte una regla de ahorro en una encuesta incompleta, y el gate del diagnostico la frenaria.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** La respuesta que se guarda cuando el bloque se salta. Es la opcion de su escala, no un texto nuestro. */
export const GI_NUNCA = "Nunca";

export type SaltoDigestivo =
  | { seSalta: true; sePresentan: false; seGuardan: string[] }
  | {
      seSalta: false;
      /** Si los siete se presentan AHORA. `false` sin salto solo mientras falte el filtro. */
      sePresentan: boolean;
      motivo: "con sintomas" | "la anterior no fue toda nunca" | "sin anterior" | "falta el filtro";
    };

/**
 * ¿Se saltan los siete sintomas digestivos?
 *
 * @param filtro        La respuesta a su pregunta filtro ("Sí" / "No"). null = sin responder.
 * @param anteriores    Las siete respuestas de la consulta ANTERIOR, por clave. null = no hay anterior.
 * @param clavesDeLosSiete Las claves de los siete items (45 a 51), para poder decir que se guarda.
 *
 * ═══ Y MIENTRAS EL FILTRO ESTE SIN RESPONDER, SI EL SALTO PUEDE APLICAR, NO SE PRESENTAN ═══
 *
 * (Santiago, 2026-11-09, al revisar el smoke.) Antes se presentaban desde el primer momento y se
 * recogian al responder "No", asi que el paciente veia aparecer y desaparecer siete preguntas: se lee
 * como que la pantalla se equivoco, y quien ya habia empezado a contestarlas pierde lo que llevaba.
 *
 * SOLO SE ESPERA CUANDO EL SALTO ES POSIBLE, que es cuando la anterior trae los siete en "Nunca". Si no
 * lo es, responder el filtro no va a cambiar nada y esperar seria esconder preguntas por nada.
 */
export function saltoDeLosDigestivos(
  filtro: string | null,
  anteriores: Record<string, string | null> | null,
  clavesDeLosSiete: string[],
): SaltoDigestivo {
  // TIENEN QUE ESTAR LOS SIETE, y en "Nunca". Si alguno falta en la anterior, no se sabe: presentar es
  // lo unico que no inventa un dato.
  const puedeAplicar =
    anteriores != null && clavesDeLosSiete.every((k) => anteriores[k] === GI_NUNCA);

  if (filtro == null || filtro.trim() === "") {
    return { seSalta: false, sePresentan: !puedeAplicar, motivo: "falta el filtro" };
  }
  if (filtro !== "No") return { seSalta: false, sePresentan: true, motivo: "con sintomas" };
  if (anteriores == null) return { seSalta: false, sePresentan: true, motivo: "sin anterior" };
  if (!puedeAplicar) {
    return { seSalta: false, sePresentan: true, motivo: "la anterior no fue toda nunca" };
  }
  return { seSalta: true, sePresentan: false, seGuardan: clavesDeLosSiete.map(() => GI_NUNCA) };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA RECONFIRMACION ANUAL  ·  §7.3
//
// Textual: *"si pasó un año o más desde la última confirmación completa, se presentan todos los ítems
// abiertos más el ítem 38, antecedentes familiares. Cuentan como confirmación completa la línea base y
// cada reconfirmación hecha."*
//
// EL ITEM 38 ES EL DETALLE QUE SE PIERDE AL LEERLO RAPIDO: en una CNV-S normal el 38 esta RETIRADO (su
// tabla 3), asi que no se pregunta nunca. En la reconfirmacion anual vuelve, y es el unico retirado que
// vuelve. Sin esto, los antecedentes familiares de un paciente se preguntarian UNA VEZ en su vida.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El item que vuelve SOLO en la reconfirmacion anual. Es su numero 38 y en Atlas esta clave. */
export const CLAVE_ANTECEDENTES_FAMILIARES = "d5_38";

/** Un año, en milisegundos. El corte es suyo: "un año o más". */
const UN_ANIO_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * ¿Toca la reconfirmacion anual en esta consulta?
 *
 * @param ultimaCompleta La fecha de la ultima confirmacion COMPLETA (la linea base, o la ultima
 *                       reconfirmacion hecha). null = no hay ninguna, y entonces no toca: el paciente no
 *                       ha tenido una primera consulta con esta encuesta y la CNV-S no deberia aplicarse.
 * @param ahora          La fecha de esta consulta.
 */
export function tocaReconfirmacionAnual(
  ultimaCompleta: Date | string | null,
  ahora: Date | string,
): boolean {
  if (ultimaCompleta == null) return false;
  const desde = new Date(ultimaCompleta).getTime();
  const hasta = new Date(ahora).getTime();
  if (Number.isNaN(desde) || Number.isNaN(hasta)) return false;
  // "UN AÑO O MAS": el corte es cerrado, como lo escribio. Exactamente un año entra.
  return hasta - desde >= UN_ANIO_MS;
}

/**
 * Las claves que se presentan para confirmar en esta consulta.
 *
 * Sin reconfirmacion son los ocho de su tabla 3; con ella, esos ocho MAS el 38. No se devuelve una
 * bandera para que la pantalla decida: la lista llega resuelta, que es la regla de la casa.
 */
export function clavesAConfirmar(
  deLaTabla3: string[],
  conReconfirmacionAnual: boolean,
): string[] {
  if (!conReconfirmacionAnual) return [...deLaTabla3];
  return deLaTabla3.includes(CLAVE_ANTECEDENTES_FAMILIARES)
    ? [...deLaTabla3]
    : [...deLaTabla3, CLAVE_ANTECEDENTES_FAMILIARES];
}
