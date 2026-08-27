// Referencia poblacional de CAPACITANCIA por sexo y decada de edad.
//
// PORTE FIEL de la entrega del 2026-08-26 (Parte 2, punto 9.1). Percentiles del articulo de valores de
// referencia del equipo: 5.181 adultos latinoamericanos y europeos. Antes de esto la tarjeta de
// Seguimiento dibujaba la capacitancia con `ref: null`: no tenia ninguna referencia.
//
// POR QUE LA ESTRATIFICACION NO ERA OPCIONAL, con su propio ejemplo: la mediana de un hombre de 18-29
// es 2,40 nF y la de una mujer de la misma edad 1,37. Casi la mitad. Un mismo 2,40 es NORMAL en el y
// esta POR ENCIMA DEL P95 en ella. Sin estratificar, el mismo numero significa cosas opuestas.
//
// TRES DECISIONES SUYAS, textuales, que este modulo respeta:
//   1. Sin sexo o sin edad NO SE CLASIFICA. A diferencia de calcPABU, que cae a una k historica, aqui no
//      hay respaldo razonable: cualquier eleccion se equivoca en cerca de un nanofaradio. Y no queda
//      mudo: devuelve la razon ("falta sexo o edad") para que la pantalla la diga.
//   2. Por encima de P75 se rotula "Alta", NO "Optimo". El articulo sostiene el extremo bajo como
//      hallazgo (AUC 0,890 para masa muscular reducida); el alto no lo presenta como bueno y ademas
//      sube con el IMC.
//   3. NO SE USA AZUL, a proposito. En su archivo el azul ya significa dos cosas distintas ("Optimo" en
//      cSMM, deficit en cFMI), que es justo lo que nos provoco el fallo del desnutrido en verde. Un
//      tercer significado lo habria empeorado.
//
// La tabla se transcribe VERBATIM y tiene candado (capacitancia.test.ts): las doce filas se cotejan
// contra su archivo, y ademas se comprueba la coherencia INTERNA (percentiles crecientes, n positivo,
// decadas contiguas), porque un candado que solo compara dos copias no prueba correccion: si el error
// viene de la fuente, las dos coinciden y pasa verde.

export type CapRefRow = {
  d: [number, number]; // decada [min, max] en anos
  n: number; // tamano del grupo en el articulo
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
};

// VERBATIM de su archivo (L4008-4026). No tocar sin actualizar el candado.
export const CAP_REF: { M: CapRefRow[]; F: CapRefRow[] } = {
  M: [
    { d: [18, 29], n: 503, p5: 1.56, p10: 1.71, p25: 2.06, p50: 2.4, p75: 2.82, p90: 3.22, p95: 3.53 },
    { d: [30, 39], n: 530, p5: 1.57, p10: 1.75, p25: 2.0, p50: 2.36, p75: 2.7, p90: 3.03, p95: 3.32 },
    { d: [40, 49], n: 560, p5: 1.53, p10: 1.73, p25: 2.01, p50: 2.26, p75: 2.58, p90: 3.02, p95: 3.24 },
    { d: [50, 59], n: 342, p5: 1.55, p10: 1.68, p25: 1.93, p50: 2.2, p75: 2.53, p90: 3.04, p95: 3.4 },
    { d: [60, 69], n: 155, p5: 1.35, p10: 1.53, p25: 1.72, p50: 1.94, p75: 2.34, p90: 2.57, p95: 3.06 },
    { d: [70, 200], n: 87, p5: 0.74, p10: 0.88, p25: 1.16, p50: 1.5, p75: 1.81, p90: 2.09, p95: 2.53 },
  ],
  F: [
    { d: [18, 29], n: 783, p5: 0.91, p10: 0.99, p25: 1.16, p50: 1.37, p75: 1.6, p90: 1.87, p95: 2.03 },
    { d: [30, 39], n: 876, p5: 1.0, p10: 1.09, p25: 1.22, p50: 1.42, p75: 1.65, p90: 1.9, p95: 2.12 },
    { d: [40, 49], n: 702, p5: 0.96, p10: 1.04, p25: 1.21, p50: 1.41, p75: 1.63, p90: 1.87, p95: 2.07 },
    { d: [50, 59], n: 426, p5: 0.95, p10: 1.0, p25: 1.15, p50: 1.35, p75: 1.58, p90: 1.82, p95: 2.04 },
    { d: [60, 69], n: 144, p5: 0.87, p10: 0.97, p25: 1.11, p50: 1.27, p75: 1.51, p90: 1.69, p95: 1.98 },
    { d: [70, 200], n: 73, p5: 0.71, p10: 0.78, p25: 0.88, p50: 1.06, p75: 1.3, p90: 1.47, p95: 1.8 },
  ],
};

export type CapRefResolved = CapRefRow & { sexo: "M" | "F"; fueraDeRango: boolean };

/**
 * La fila de referencia del paciente. Null si falta sexo o edad (decision 1).
 *
 * `fueraDeRango` marca al que cae fuera de las decadas del articulo: se le aplica la banda del extremo
 * mas cercano y SE DICE, en vez de callarlo. Porte fiel de su `capRef`.
 *
 * OJO con el extremo alto: su ultima banda es [70, 200], asi que **absorbe a todos los mayores sin
 * marcarlos**. En la practica `fueraDeRango` solo se activa por debajo de los 18. Un paciente de 95
 * anos se compara contra el grupo de 70+ como si fuera del articulo, y el articulo tiene n=87 ahi.
 */
export function capRef(sexo: unknown, edad: unknown): CapRefResolved | null {
  const s = sexo === "M" || sexo === "Masculino" ? "M" : sexo === "F" || sexo === "Femenino" ? "F" : null;
  if (!s) return null;
  const a = Number(edad);
  if (!Number.isFinite(a) || a <= 0) return null;
  const tabla = CAP_REF[s];
  for (const fila of tabla) {
    if (a >= fila.d[0] && a <= fila.d[1]) return { ...fila, sexo: s, fueraDeRango: false };
  }
  return { ...(a < 18 ? tabla[0] : tabla[tabla.length - 1]), sexo: s, fueraDeRango: true };
}

export type CapClass = {
  l: string; // etiqueta
  c: string; // color
  banda: string | null; // donde cae, para que la pantalla diga mas que la etiqueta
  ref: CapRefResolved | null;
};

// Los colores son los SUYOS, verbatim, y ninguno es azul (decision 3). El gris de "sin dato" es el mismo
// que ya usa el resto del sistema para "no se puede afirmar nada", asi que no choca con la escala.
const GRIS = "#94a3b8";
const ROJO = "#dc2626";
const AMBAR = "#f59e0b";
const VERDE = "#16a34a";

/**
 * Clasificador de capacitancia. Devuelve etiqueta, color, banda de percentil y la fila de referencia.
 *
 * Porte fiel de su `cC`. Los dos casos sin clasificacion se distinguen a proposito y NO quedan mudos:
 * "Sin dato" (no hay medicion) y "Sin referencia (falta sexo o edad)" (hay medicion pero no se puede
 * comparar). Son cosas distintas aguas abajo, como ausencia contra fila vacia.
 */
export function clasificarCapacitancia(valor: unknown, sexo: unknown, edad: unknown): CapClass {
  const val = Number(valor);
  if (!(val > 0)) return { l: "Sin dato", c: GRIS, banda: null, ref: null };
  const r = capRef(sexo, edad);
  if (!r) return { l: "Sin referencia (falta sexo o edad)", c: GRIS, banda: null, ref: null };
  if (val < r.p5) return { l: "Muy baja", c: ROJO, banda: "< P5", ref: r };
  if (val < r.p25) return { l: "Baja", c: AMBAR, banda: "P5-P25", ref: r };
  if (val <= r.p75) return { l: "Normal", c: VERDE, banda: "P25-P75", ref: r };
  if (val <= r.p95) return { l: "Alta", c: VERDE, banda: "P75-P95", ref: r };
  return { l: "Alta", c: VERDE, banda: "> P95", ref: r };
}

/** La mediana del grupo del paciente: la linea de referencia que dibuja la tarjeta de Seguimiento. */
export function medianaCapacitancia(sexo: unknown, edad: unknown): number | null {
  return capRef(sexo, edad)?.p50 ?? null;
}
