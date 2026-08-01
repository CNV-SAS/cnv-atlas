import type { EngineIndicators } from "@/clinical-engine";

// Rangos de referencia y DELTA de la tabla de indicadores. Los RANGOS de referencia se transcriben
// VERBATIM del HTML de Gildardo (docs/entregas/gildardo-2026-07-30/ATLAS_v7.html, filas R(...) de los
// Niveles II/IV/V y del bloque "ÍNDICES BIOELÉCTRICOS INTEGRADOS", ~12828-12878). NO se inventa ningun
// valor ni el extremo faltante de un rango de un solo limite.
//
// El DELTA sigue la definicion UNIFICADA de Gildardo (CA-2, opcion B; docs/entregas/CAMBIOS_AUTORIZADOS.md):
//   Δ = valor obtenido − referencia de normalidad.
//   - Rango de dos bordes: la referencia es el PROMEDIO del rango.
//   - Corte unico (un solo limite): la referencia es EL CORTE.
// Esta regla SUSTITUYE el comportamiento del HTML (que elegia un borde clinicamente relevante por
// indicador). Es una divergencia DELIBERADA y documentada, no un error a corregir hacia el archivo
// (CA-2, verbatim: "esta regla sustituye el comportamiento del archivo HTML"). El delta se COMPUTA al
// mostrar, NO se sella: cambia la Δ mostrada en diagnosticos viejos y nuevos por igual (un paciente
// dentro de rango pero por debajo del promedio pasa a mostrar Δ negativo donde antes mostraba cero).
// Prueba de regresion sobre el donante golden en indicator-ranges.test.ts (Gildardo la pide antes de
// publicar). Aprobacion de Gildardo: PENDIENTE (regla de reversion de opcion B).
//
// Efecto por indicador respecto al HTML: ISCM (referencia = corte −1, antes crudo), FFMI y AF
// (promedio del rango, antes el borde inferior) CAMBIAN; PABU, ICA-BIS, IEHH, IAE, EB, IR quedan
// igual (su referencia de normalidad ya coincidia con el promedio/corte). IFC/IRC/FMI siguen en "-".
//
// Rangos de UN SOLO LIMITE: ISCM (≤−1), IEHH (≤0), IR (<0.78/<0.82). PABU e ICA-BIS son referencia de
// PUNTO (φ = 1.618 / coherencia 0). EB usa la edad cronologica como referencia.

export type IndicatorRange = { reference: string; delta: string | null };

// Formato como el HTML (fN / toFixed): N decimales, conservando ceros a la derecha y el signo.
const f = (n: number, d: number) => n.toFixed(d);

// Referencia + delta para un indicador (por codigo de la tabla), verbatim del HTML. sexM: masculino.
// Devuelve null si el indicador no tiene valor (queda "-").
export function indicatorRange(
  code: string,
  ind: EngineIndicators,
  sexM: boolean,
): IndicatorRange | null {
  switch (code) {
    // IFC, IRC y FMI: la referencia de la tabla del HTML sale de los clasificadores de DISPLAY
    // (dIFC/dIRC/dFMI), que NO coinciden con los clasificadores de CIENCIA (cIFC/cIRC/cFMI) que usa
    // nuestro motor: cIFC es sexo-especifico (M 4.12-6.68) vs dIFC generico (3.5-6.0); cIRC opera en
    // escala cruda (M 1.68-2.11) vs dIRC en v×10 (2.0-2.8); cFMI normal 3-6 vs dFMI 6-9. Mostrar esa
    // referencia junto a nuestro valor+clasificacion (que son cXXX) da una lectura contradictoria
    // (el color y la etiqueta dicen una cosa, la referencia otra). Se deja "-" hasta que Gildardo
    // confirme cual clasificador manda en la tabla de diagnostico (GILDARDO_QUERIES Q20; toca tambien
    // la CLASIFICACION, que se sella). AF/IR SI se muestran porque cAF==dAF y cIR==dIR (verificado).
    case "IFC":
    case "IRC":
    case "FMI":
      return null;
    case "PABU":
      // CA-2: referencia de punto φ = 1.618. Δ = valor − 1.618 (sin cambio respecto al HTML).
      return ind.pabu != null ? { reference: "φ = 1.618", delta: f(ind.pabu - 1.618, 4) } : null;
    case "ICA-BIS":
      // ICA-BIS = PABU − φ: su referencia de normalidad es 0 (coherencia perfecta), NO φ. Δ = valor − 0
      // = el valor mismo. La etiqueta de referencia decia "φ = 1.618" (copiada de PABU): era inconsistente
      // con el delta (contra 0) y, como icaBis = pabu − φ por definicion, su Δ coincide con la de PABU,
      // lo que en pantalla se leia como que ICA-BIS copiaba el delta de PABU. Referencia correcta: 0.
      return ind.icaBis != null ? { reference: "0 (coherencia)", delta: f(ind.icaBis - 0, 4) } : null;
    case "ISCM":
      // CA-2: corte unico −1 (de "≤−1"); la referencia ES el corte. Δ = valor − (−1). ANTES el HTML
      // mostraba el valor crudo (referencia implicita 0); ahora es contra el corte.
      return ind.iscm != null ? { reference: "≤−1", delta: f(ind.iscm - -1, 2) } : null;
    case "IEHH":
      // CA-2: corte unico 0 (de "≤0"). Δ = valor − 0 = valor (sin cambio).
      return ind.iehh != null ? { reference: "≤0", delta: f(ind.iehh - 0, 3) } : null;
    case "IAE":
      // CA-2: rango −5 a +5 → promedio 0. Δ = valor − 0 = valor (sin cambio).
      return ind.iae != null ? { reference: "−5 a +5 años", delta: f(ind.iae - 0, 1) } : null;
    case "EB":
      // La referencia de EB es la edad cronologica, que NO se sella en el EngineOutput (vive en
      // EngineInput). Sin edad sellada la referencia queda "—", y el delta TAMBIEN se oculta: una
      // diferencia sin decir contra que es ININTERPRETABLE, peor que no mostrarla (ademas ese delta es
      // el IAE, que ya tiene su propia fila; se mostraba dos veces, una sin explicacion). Para
      // mostrarlos haria falta sellar la edad en el snapshot (solo diagnosticos nuevos); registrado en
      // BACKLOG como mejora hacia adelante.
      return ind.eb != null ? { reference: "—", delta: null } : null;
    case "FFMI": {
      if (ind.FFMI == null) return null;
      // CA-2: promedio del rango (M 17–25 → 21; F 15–23 → 19). ANTES el HTML restaba el borde inferior.
      const ref = sexM ? (17 + 25) / 2 : (15 + 23) / 2;
      return { reference: sexM ? "17–25" : "15–23", delta: f(ind.FFMI - ref, 2) };
    }
    case "AF": {
      if (!(ind.AF > 0)) return null;
      // CA-2: promedio del rango (M 6.5–7.0 → 6.75; F 6.0–6.5 → 6.25). ANTES el HTML restaba el borde inferior.
      const ref = sexM ? (6.5 + 7.0) / 2 : (6.0 + 6.5) / 2;
      return { reference: sexM ? "6.5–7.0°" : "6.0–6.5°", delta: f(ind.AF - ref, 2) };
    }
    case "IR": {
      if (!(ind.IR > 0)) return null;
      // CA-2: corte unico (M 0.78; F 0.82); la referencia ES el corte. Δ = valor − corte (sin cambio).
      const ref = sexM ? 0.78 : 0.82;
      return { reference: sexM ? "<0.78" : "<0.82", delta: f(ind.IR - ref, 3) };
    }
    default:
      return null;
  }
}
