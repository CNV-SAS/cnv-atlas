import {
  d1Clasificar,
  d1EstadoGrupo,
  d1TextoPatron,
  type D1Clasificacion,
} from "./frozen/engine.d1-clasificacion.js";
import { FREQ_GROUPS } from "./frozen/engine.patron.js";
import type { PatronGrupoView } from "./patron";

// ADAPTADOR DE LA CLASIFICACION DE D1 (patron usual de consumo) — compute-at-view-time, NO se sella.
//
// El frozen (`engine.d1-clasificacion.js`) habla el idioma de SU archivo: un `enc` con la frecuencia por
// clave `d1_N_i` como ordinal 0-4. Atlas ya resuelve eso en el reader del patron (`patron.ts`), que
// devuelve los 15 grupos con su ordinal. Esto es el puente, y nada mas: no decide nada clinico.
//
// POR QUE EL PUENTE Y NO UNA SEGUNDA LECTURA DE LA ENCUESTA: el reader ya tiene el acoplamiento por texto
// y posicion probado contra la semilla (`patron-coupling.test.ts`) y ya sabe distinguir "no respondio" de
// "no se pudo leer". Volver a leer las respuestas aqui seria la segunda fuente del mismo dato, que es la
// forma de defecto que este bloque entero existe para cerrar.

export type { D1Clasificacion, D1Estado, D1Grupo, D1Patron } from "./frozen/engine.d1-clasificacion.js";
export { d1TextoPatron } from "./frozen/engine.d1-clasificacion.js";

/** El `enc` que consume el clasificador, armado desde los grupos que resolvio el reader. */
function encDeGrupos(grupos: PatronGrupoView[]): Record<string, number> {
  const enc: Record<string, number> = {};
  for (const g of grupos) {
    if (g.ordinal !== null) enc[`d1_${g.n}_i`] = g.ordinal;
  }
  return enc;
}

/**
 * Clasifica el patron usual desde los grupos del reader.
 *
 * `conRespaldo` va en FALSE, igual que en su vista D1: las claves sin sufijo `_i` son de los registros
 * antiguos de su HTML y ninguna version publicada de la encuesta de Atlas las declara (medido el
 * 2026-11-05: 0 de 319 `field_key`). Pasar true aqui no leeria nada y sugeriria que hay algo que leer.
 */
export function clasificarD1(grupos: PatronGrupoView[]): D1Clasificacion {
  return d1Clasificar(encDeGrupos(grupos), false);
}

/** La frase del patron a partir de los grupos del reader, en un paso. */
export function textoPatronDeGrupos(grupos: PatronGrupoView[]): string {
  return d1TextoPatron(clasificarD1(grupos));
}

// ─── La tarjeta de categoria (porte de su vista D1, v16 L15305-15320) ───────────────────────────────
//
// LO QUE CAMBIA FRENTE AL PROMEDIO: la tarjeta de riesgo se lee por el PEOR grupo, no por la media de
// los cuatro. La de moderados toma el peor entre su lectura por grupo (que hoy solo distingue el 15,
// carnes rojas) y la media de los otros tres, que conserva su lectura por promedio porque en 8, 9 y 10
// no hay senal de riesgo. La de protectores no cambia: ahi mas frecuencia SI es mejor.
//
// "Sin datos" sigue saliendo de que NINGUN grupo de la tarjeta tenga frecuencia, no de la clasificacion:
// una tarjeta vacia no es "Adecuado".

export type EtiquetaTarjetaD1 = "Sin datos" | "Adecuado" | "Moderado" | "Elevado" | "Bajo";

/** Orden de severidad de las tres etiquetas comparables (su `_rk`). */
const RANGO: Record<string, number> = { Adecuado: 0, Moderado: 1, Elevado: 2 };

const promedio = (vals: number[]): number | null =>
  vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

/**
 * Estado de una tarjeta de categoria y la fraccion (0-1) que llena su barra.
 *
 * La barra de riesgo mide el PEOR grupo y no la media, por lo mismo que la etiqueta: con la media, un
 * grupo diario entre tres en "nunca" dibujaba una barra corta.
 */
export function tarjetaD1(
  cat: "protector" | "neutro" | "riesgo",
  numeros: readonly number[],
  grupos: PatronGrupoView[],
): { etiqueta: EtiquetaTarjetaD1; fraccionBarra: number } {
  const porN = new Map(grupos.map((g) => [g.n, g.ordinal]));
  const vals = numeros.map((n) => porN.get(n) ?? null).filter((v): v is number => v !== null);
  const avg = promedio(vals);
  if (avg === null) return { etiqueta: "Sin datos", fraccionBarra: 0 };

  const estados = numeros.map((n) =>
    d1EstadoGrupo(FREQ_GROUPS.find((x) => x.n === n), porN.get(n) ?? null),
  );
  const peor: EtiquetaTarjetaD1 = estados.includes("exceso")
    ? "Elevado"
    : estados.includes("moderar")
      ? "Moderado"
      : "Adecuado";

  if (cat === "riesgo") {
    return { etiqueta: peor, fraccionBarra: Math.max(...vals) / 4 };
  }
  if (cat === "neutro") {
    // Los tres grupos sin senal de riesgo (8, 9 y 10) conservan su lectura por promedio.
    const neuAvg = promedio(
      numeros.filter((n) => n !== 15).map((n) => porN.get(n) ?? null).filter((v): v is number => v !== null),
    );
    const neuEst: EtiquetaTarjetaD1 =
      neuAvg === null ? "Adecuado" : neuAvg <= 2 ? "Adecuado" : neuAvg <= 3 ? "Moderado" : "Elevado";
    const etiqueta = RANGO[peor] >= RANGO[neuEst] ? peor : neuEst;
    return { etiqueta, fraccionBarra: avg / 4 };
  }
  return {
    etiqueta: avg >= 3 ? "Adecuado" : avg >= 2 ? "Moderado" : "Bajo",
    fraccionBarra: avg / 4,
  };
}

/**
 * La categoria que se muestra al lado de cada grupo en la grilla (su v16 §4.4, L15336).
 *
 * Existe porque el color solo, sin la categoria, se leia como juicio sobre el ALIMENTO: "Carnes rojas:
 * Nunca" en verde se entiende como "la carne roja es protectora". Las carnes rojas llevan "Limitar", que
 * no es ninguna de las tres categorias del modelo: es su etiqueta para el grupo 15.
 */
export function categoriaDeGrupoD1(g: PatronGrupoView): { texto: string; color: string } {
  if (g.cat === "riesgo") return { texto: "Riesgo", color: "#dc2626" };
  if (g.n === 15) return { texto: "Limitar", color: "#b45309" };
  if (g.cat === "neutro") return { texto: "Moderar", color: "#1d4ed8" };
  return { texto: "Protector", color: "#059669" };
}

/**
 * Color de la pildora de frecuencia de un grupo (su v16 L15333-15337).
 *
 * Los grupos de riesgo y el 15 pasan a leerse por `d1EstadoGrupo`; los demas conservan la lectura que ya
 * tenian. Por eso "embutidos: 1 a 2 dias" deja de pintarse verde: su estado es "moderar".
 */
export function colorDeGrupoD1(g: PatronGrupoView): string {
  const v = g.ordinal;
  if (v === null) return "#94a3b8";
  const esRiesgo = g.cat === "riesgo";
  const esMod = g.cat === "neutro";
  const estado = esRiesgo || g.n === 15 ? d1EstadoGrupo({ n: g.n, cat: g.cat }, v) : null;
  const ok = estado ? estado === "ok" : esMod ? v <= 2 : v >= 3;
  const alerta = estado ? estado === "exceso" : esMod ? v >= 4 : v <= 1;
  return ok ? "#059669" : alerta ? "#dc2626" : "#d97706";
}

/** La nota al pie de la vista D1, verbatim de su v16 (L15346-15347). USER-FACING. */
export const NOTA_AL_PIE_D1 =
  "El color indica si la frecuencia es adecuada para el grupo del alimento, no si el alimento es " +
  "protector. Las carnes rojas y las carnes procesadas nunca se clasifican como protectoras.";
