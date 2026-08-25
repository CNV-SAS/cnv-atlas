// Indices ANI BIS-E para la tabla de la historia clinica (porte 2026-08-24). Modulo NEUTRO y PURO.
//
// Su HC los muestra como un nivel mas de la tabla de Wang, con REFERENCIA textual fija por fila (verbatim
// de su archivo). Se portan las OCHO filas de su bloque y se filtran igual que el resto de la tabla: solo
// lo alterado, y nada sin valor.
//
// La severidad sale de `indicatorSeverities` (que ya desambigua el azul por etiqueta), no de un color.

export type IndiceAniFila = {
  codigo: string;
  referencia: (sexoM: boolean) => string;
  /** Formato del valor, verbatim del suyo (decimales y sufijo). */
  formato: (v: number) => string;
};

// Orden y referencias EXACTOS de su tabla (v8 L15087-15095).
export const INDICES_ANI: IndiceAniFila[] = [
  { codigo: "IFC", referencia: (m) => (m ? "≥6,68 óptimo" : "≥3,28 óptimo"), formato: (v) => v.toFixed(2) },
  {
    codigo: "IRC",
    referencia: (m) => (m ? "<1,68 bajo riesgo" : "<2,27 bajo riesgo"),
    formato: (v) => v.toFixed(2),
  },
  { codigo: "ISCM", referencia: () => "ISCM-1 ≤ −1", formato: (v) => v.toFixed(2) },
  { codigo: "IEHH", referencia: () => "≤0.0 óptimo", formato: (v) => v.toFixed(2) },
  { codigo: "EB", referencia: () => "= Edad cronológica", formato: (v) => `${v.toFixed(1)} a` },
  {
    codigo: "IAE",
    referencia: () => "−5 a +5 años",
    formato: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} a`,
  },
  {
    codigo: "PABU",
    referencia: (m) => (m ? "φ = 1,618 (k=0,78)" : "φ = 1,618 (k=0,46)"),
    formato: (v) => v.toFixed(3),
  },
  { codigo: "ICA-BIS", referencia: () => "0.00–0.15 Zona φ", formato: (v) => v.toFixed(4) },
];

export type IndiceAniResuelto = {
  codigo: string;
  referencia: string;
  valor: string;
  clasificacion: string;
  sev: number;
};

/**
 * Filas ALTERADAS del bloque ANI BIS-E. Mismos dos filtros que el resto de la tabla de la HC:
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
      referencia: fila.referencia(sexoM),
      valor: fila.formato(v),
      clasificacion: label,
      sev,
    });
  }
  return out;
}
