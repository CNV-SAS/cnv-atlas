import { decimalesDe } from "@/modules/diagnoses/data/indicator-ranges";

// Indices ANI-BIS-E para la tabla de la historia clinica (porte 2026-08-24). Modulo NEUTRO y PURO.
//
// Su HC los muestra como un nivel mas de la tabla de Wang, con REFERENCIA textual fija por fila (verbatim
// de su archivo). Se portan las OCHO filas de su bloque y se filtran igual que el resto de la tabla: solo
// lo alterado, y nada sin valor.
//
// La severidad sale de `indicatorSeverities` (que ya desambigua el azul por etiqueta), no de un color.

// NOMBRE COMPLETO junto a la sigla. La historia clinica la puede leer OTRO profesional, y un medico no
// tiene por que saber que es un IAE. Los nombres NO se inventan: son los que usa el propio archivo de
// Gildardo con su formato "SIGLA · Nombre" (IFC · Funcion Celular, IRC · Riesgo Celular, ISCM · Sindrome
// Celular, IEHH · Hidro-Homeostasis, IAE · Aceleracion del Envejecimiento, ICA-BIS · Desv. φ). El glosario
// interno marca varios de estos como "confirmar Gildardo", asi que escribir ahi un nombre nuestro seria
// afirmar en un documento clinico algo que el no ha confirmado.
//
// DOS EXCEPCIONES deliberadas:
//   - PABU: su archivo NO le da nombre en ninguna parte (solo lo describe como marcador direccional de
//     desviacion de φ). Va la sigla sola antes que un nombre inventado.
//   - EB-BIS: el suyo lo rotula "Edad Biologica" y NOSOTROS NO podemos (divergencia deliberada ya
//     registrada: la EB-BIS es un indice funcional bioelectrico, no la edad del cuerpo, y no se rotula
//     como edad; ver BACKLOG y D-010/D-011). Va la sigla sola.
export type IndiceAniFila = {
  codigo: string;
  /** Nombre completo del propio archivo de Gildardo. null cuando el no le da uno (ver nota arriba). */
  nombre: string | null;
  referencia: (sexoM: boolean) => string;
  /**
   * Formato del valor. EL SUFIJO es suyo (" a" para los años, el signo del IAE); LOS DECIMALES salen de
   * `decimalesDe`, la misma tabla que usa la pantalla y que calcula las Δ (2026-09-06).
   *
   * ANTES ERAN LOS SUYOS VERBATIM, y eran justo el desorden que Santiago devolvio: 2 en cuatro filas,
   * 1 en dos, 3 en el PABU y 4 en el ICA-BIS, sin regla detras. Con la tabla, la HC y la pantalla no
   * pueden mostrar la misma cifra con distinta precision.
   */
  formato: (v: number) => string;
};

/** El valor con los decimales de su indicador, en español. Misma tabla que la pantalla y las Δ. */
const dec = (v: number, codigo: string) => v.toFixed(decimalesDe(codigo)).replace(".", ",");

// Orden y referencias EXACTOS de su tabla (v8 L15087-15095).
export const INDICES_ANI: IndiceAniFila[] = [
  { codigo: "IFC", nombre: "Función Celular", referencia: (m) => (m ? "≥6,68 óptimo" : "≥3,28 óptimo"), formato: (v) => dec(v, "IFC") },
  {
    codigo: "IRC", nombre: "Riesgo Celular",
    referencia: (m) => (m ? "<1,68 bajo riesgo" : "<2,27 bajo riesgo"),
    formato: (v) => dec(v, "IRC"),
  },
  { codigo: "ISCM", nombre: "Síndrome Celular", referencia: () => "ISCM-1 ≤ −1", formato: (v) => dec(v, "ISCM") },
  { codigo: "IEHH", nombre: "Hidro-Homeostasis", referencia: () => "≤0.0 óptimo", formato: (v) => dec(v, "IEHH") },
  { codigo: "EB", nombre: null, referencia: () => "= Edad cronológica", formato: (v) => `${dec(v, "EB")} a` },
  {
    codigo: "IAE", nombre: "Aceleración del Envejecimiento",
    referencia: () => "−5 a +5 años",
    formato: (v) => `${v > 0 ? "+" : ""}${dec(v, "IAE")} a`,
  },
  {
    codigo: "PABU", nombre: null,
    referencia: (m) => (m ? "φ = 1,618 (k=0,78)" : "φ = 1,618 (k=0,46)"),
    formato: (v) => dec(v, "PABU"),
  },
  { codigo: "ICA-BIS", nombre: "Desviación de φ", referencia: () => "0.00–0.15 Zona φ", formato: (v) => dec(v, "ICA-BIS") },
];

export type IndiceAniResuelto = {
  codigo: string;
  nombre: string | null;
  referencia: string;
  valor: string;
  clasificacion: string;
  sev: number;
};

/**
 * Filas ALTERADAS del bloque ANI-BIS-E. Mismos dos filtros que el resto de la tabla de la HC:
 * sev >= 1 (0 es el unico nivel optimo) y nada sin valor. El codigo EB no tiene clasificador en su tabla
 * (su referencia es "= Edad cronologica" y no lleva clasificacion), asi que solo entra si algo le da una.
 */
export function indicesAniAlterados(
  valores: Record<string, number | null | undefined>,
  clasificaciones: Record<string, { label?: string | null } | null | undefined>,
  severidades: Record<string, number | null | undefined>,
  sexoM: boolean,
): IndiceAniResuelto[] {
  const out: IndiceAniResuelto[] = [];
  for (const fila of INDICES_ANI) {
    const v = valores[fila.codigo];
    if (v == null || !Number.isFinite(v)) continue;
    const sev = severidades[fila.codigo];
    if (sev == null || sev < 1) continue;
    const label = clasificaciones[fila.codigo]?.label;
    if (!label) continue; // sin clasificacion no se puede decir que esta alterado
    out.push({
      codigo: fila.codigo,
      nombre: fila.nombre,
      referencia: fila.referencia(sexoM),
      valor: fila.formato(v),
      clasificacion: label,
      sev,
    });
  }
  return out;
}
