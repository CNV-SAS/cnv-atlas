import type { NutrienteValidado } from "@/clinical-engine/validacion";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS CORTES DE LA VALIDACION DEL PLAN, EN UN SOLO SITIO  ·  MODULO NEUTRO
//
// ═══ POR QUE SE EXTRAJO (Gildardo, 2026-10-25) ═══
//
// *"El ICN va a la historia clinica. Construyelo."*
//
// Hasta hoy los cortes de color y el resumen vivian DENTRO del panel de tratamiento, en medio de 3.500
// lineas. Construir la segunda superficie copiandolos habria dejado dos juegos de umbrales clinicos: la
// pantalla del profesional diria ambar y el documento probatorio diria verde sobre la misma cifra, y nadie
// sabria cual de los dos esta mal. Es el mismo defecto que ya nos costo las comorbilidades del motor de
// nutricion: la segunda copia hereda los huecos que la primera tapo, o se aparta.
//
// NEUTRO (sin `server-only` ni `"use client"`): lo importan el panel (cliente) y la composicion de la
// historia clinica (servidor). Es la salida que ARCHITECTURE pide para un valor que comparten los dos
// lados de la frontera RSC.
//
// ═══ LOS UMBRALES NO SON NUESTROS, Y POR ESO LLEVAN SU FUENTE AL LADO ═══
//
// Son el porte verbatim de `interCobColor` e `interIcnColor` del ATLAS v8 de Gildardo. La regla de Santiago
// (2026-10-02) aplica aqui con todas las letras: un color que califica una prescripcion DECIDE sobre un
// dato clinico, aunque solo pinte un numero, asi que ninguno de estos cortes se puede mover sin su archivo.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Como se califica una cifra de la validacion. `neutro` = no se califica (la energia no tiene ICN). */
export type NivelDeValidacion = "optimo" | "alerta" | "critico" | "neutro";

/**
 * Cortes del % DE CUBRIMIENTO. Fuente: `interCobColor`, ATLAS v8 de Gildardo.
 *
 * El sodio (y lo demas "a limitar") se mide al reves: menos es mejor, asi que un 100 % es el techo y no
 * el objetivo.
 */
export const CORTES_DE_CUBRIMIENTO = {
  /** Lo que se CUBRE: [90, 110] optimo, [70, 130) alerta, resto critico. */
  cubrir: { optimo: [90, 110], alerta: [70, 130] },
  /** Lo que se LIMITA: <= 100 optimo, <= 115 alerta, resto critico. */
  limitar: { optimo: 100, alerta: 115 },
} as const;

/** Cortes del ICN. Fuente: `interIcnColor`, ATLAS v8. [0,9 - 1,15] optimo, [0,7 - 1,3) alerta. */
export const CORTES_DEL_ICN = { optimo: [0.9, 1.15], alerta: [0.7, 1.3] } as const;

/** El ICN desde el que un nutriente cuenta como cubierto en el resumen. Fuente: `_icnPctOk`, v8. */
export const ICN_MINIMO_ACEPTABLE = 0.9;

export function nivelDeCubrimiento(n: Pick<NutrienteValidado, "cob" | "lim">): NivelDeValidacion {
  if (n.lim) {
    if (n.cob <= CORTES_DE_CUBRIMIENTO.limitar.optimo) return "optimo";
    return n.cob <= CORTES_DE_CUBRIMIENTO.limitar.alerta ? "alerta" : "critico";
  }
  const [cMin, cMax] = CORTES_DE_CUBRIMIENTO.cubrir.optimo;
  if (n.cob >= cMin && n.cob <= cMax) return "optimo";
  const [aMin, aMax] = CORTES_DE_CUBRIMIENTO.cubrir.alerta;
  return n.cob >= aMin && n.cob < aMax ? "alerta" : "critico";
}

export function nivelDelIcn(v: number | null): NivelDeValidacion {
  if (v == null) return "neutro";
  const [oMin, oMax] = CORTES_DEL_ICN.optimo;
  if (v >= oMin && v <= oMax) return "optimo";
  const [aMin, aMax] = CORTES_DEL_ICN.alerta;
  return v >= aMin && v < aMax ? "alerta" : "critico";
}

/**
 * EL MISMO VEREDICTO EN PALABRAS, para el papel.
 *
 * El PDF de la historia clinica se imprime y se fotocopia, y un juicio que vive solo en el color
 * DESAPARECE en blanco y negro. Asi que el documento dice la palabra y la pantalla pinta el color, los dos
 * desde la misma funcion: si estuvieran en dos sitios, una superficie podria decir "alerta" donde la otra
 * pinta verde sobre la misma cifra.
 */
export const ROTULO_DEL_NIVEL: Record<NivelDeValidacion, string> = {
  optimo: "óptimo",
  alerta: "alerta",
  critico: "crítico",
  neutro: "sin calificar",
};

/** La clase de color de Atlas para un nivel. Los tokens clinicos, no los de interfaz. */
export const CLASE_DEL_NIVEL: Record<NivelDeValidacion, string> = {
  optimo: "text-clinical-optimal",
  alerta: "text-clinical-warning",
  critico: "text-clinical-critical",
  neutro: "text-muted-foreground",
};

/**
 * % de nutrientes con ICN aceptable. Porte de `_icnPctOk` (v8).
 *
 * EXCLUYE la energia (no tiene ICN) y los "a limitar": en el sodio un ICN alto significa que sobra, asi
 * que contarlo como cubierto invertiria su sentido.
 */
export function porcentajeConIcnOk(nutrientes: readonly NutrienteValidado[]): number {
  const vals = nutrientes
    .filter((n) => n.k !== "kcal" && !n.lim && n.icn != null)
    .map((n) => n.icn as number);
  if (vals.length === 0) return 0;
  return Math.round((vals.filter((v) => v >= ICN_MINIMO_ACEPTABLE).length / vals.length) * 100);
}

/**
 * LA DEFINICION DEL ICN, en una frase.
 *
 * Vive aqui porque la dicen las DOS superficies, y una definicion que se escribe dos veces se aparta a la
 * tercera edicion. Sin ella la columna es una lista de numeros sin significado, que es lo que Gildardo
 * encontro en su propio HTML cuando el ICN estaba pero no se veia.
 */
export const DEFINICION_DEL_ICN =
  "ICN = (nutriente aportado / requerido) ÷ (energía aportada / requerida). ≈1 balanceado, >1 denso, <1 deficitario.";

/**
 * POR QUE DOS COLUMNAS DE LA MISMA FILA PUEDEN DISCREPAR, y no es un error.
 *
 * Tambien va en las dos: es la frase que evita que alguien "corrija" una fila coherente (fibra al 136 % en
 * rojo con su ICN en ambar es correcto, porque una mide cantidad y la otra densidad).
 */
export const POR_QUE_DISCREPAN =
  "El % de cubrimiento mide cuánto se cubre respecto a la necesidad; el ICN, si el nutriente viene en proporción a las calorías del plan. Un nutriente puede sobrar en cantidad y estar bien proporcionado, así que las dos columnas pueden tener colores distintos en la misma fila.";
