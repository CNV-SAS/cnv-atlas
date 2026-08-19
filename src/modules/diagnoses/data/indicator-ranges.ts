import type { EngineIndicators } from "@/clinical-engine";

// Rangos de referencia y DELTA de la tabla de indicadores. Los RANGOS de referencia se transcriben
// VERBATIM del HTML de Gildardo (docs/entregas/gildardo-2026-07-30/ATLAS_v7.html, filas R(...) de los
// Niveles II/IV/V y del bloque "ÍNDICES BIOELÉCTRICOS INTEGRADOS", ~12828-12878). NO se inventa ningun
// valor ni el extremo faltante de un rango de un solo limite.
//
// El DELTA sigue la regla que Gildardo FIJO el 2026-08-17 (§2), que REVIERTE CA-2 opcion B (punto medio):
//   Δ = valor obtenido − EL BORDE QUE DECIDE la clasificacion (no el punto medio ni el borde mas cercano).
//   - Rango de dos bordes: la referencia es el LIMITE QUE GOBIERNA el riesgo (FFMI inferior 17/15; FMI
//     superior 6/9; AF inferior 6.5/6.0).
//   - Corte unico (un solo limite): la referencia es EL CORTE (IFC, IRC, ISCM, IEHH, IR: sin cambio).
// "El punto medio es defendible en estadistica y engañoso en clinica" (Gildardo): FFMI 19.90 normal daba
// −1.10 contra el medio 21, que en una columna Δ roja se lee como deficit inexistente; contra el borde 17
// da +2.90, cuanto falta para cruzar el limite. El delta se COMPUTA al mostrar, NO se sella: cambia en
// diagnosticos viejos y nuevos por igual. Prueba de regresion en indicator-ranges.test.ts. Historia de
// CA-2 (opcion B, punto medio, ya revertida): docs/entregas/CAMBIOS_AUTORIZADOS.md.
//
// EXCEPCION pendiente: IAE sigue en punto medio (0) hasta que Gildardo confirme su borde (a la ronda).
//
// Efecto por indicador (Gildardo §2, borde): FFMI (borde inferior 17/15), AF (borde inferior 6.5/6.0), FMI
// (borde superior 6/9) miden contra el limite que decide. ISCM/IEHH/IR/IFC/IRC son corte unico (sin cambio);
// PABU/ICA-BIS son punto (φ / 0); EB usa la edad cronologica. IFC/IRC/FMI salen del CLASIFICADOR DEL MOTOR
// sexo-especifico (Q20/C11, 2026-08-02), con test-candado que lo verifica (no la tabla de display).
//
// Rangos de UN SOLO LIMITE: ISCM (≤−1), IEHH (≤0), IR (<0.78/<0.82). PABU e ICA-BIS son referencia de
// PUNTO (φ = 1.618 / coherencia 0). EB usa la edad cronologica como referencia.

export type IndicatorRange = { reference: string; delta: string | null };

// Formato como el HTML (fN / toFixed): N decimales, conservando ceros a la derecha y el signo.
const f = (n: number, d: number) => n.toFixed(d);

// Clasificacion de la DESVIACION del ICA-BIS (PABU − φ), PORTADA VERBATIM de la rama de desviacion del
// clasificador del PABU en el frozen (engine.core.derived.js:73-77, `d = Math.abs(raw)`): la misma que su
// tabla llama "Desviación leve", no una escala nuestra. El motor sella la clasificacion del PABU con la
// rama "Reserva superior" cuando IFC>6, asi que ICA-BIS quedaba sin clasificacion (N/D); esta reusa la rama
// de desviacion para la fila ICA-BIS. sev via el color del frozen (verde 0 / ambar 2 / rojo 3), como colorSev.
export function clasificarIcaBis(icaBis: number | null): { label: string; sev: number } | null {
  if (icaBis == null) return null;
  const d = Math.abs(icaBis);
  if (d <= 0.15) return { label: "Zona φ — Homeostasis óptima", sev: 0 };
  if (d <= 0.5) return { label: "Desviación leve", sev: 0 };
  if (d <= 1.5) return { label: "Desviación moderada", sev: 2 };
  if (d <= 3.0) return { label: "Desviación severa", sev: 3 };
  return { label: "Zona crítica", sev: 3 };
}

// Rango de referencia del FMI, del CLASIFICADOR DEL MOTOR (cFMI, banda media sana): H 3-6, M 5-9. Se
// exporta para que la tabla de Wang (composition-section) muestre el MISMO rango sin duplicar el corte.
// NO es el "6-9/9-13" de la tabla de display del HTML (stale; manda el motor, instruccion Gildardo 2-ago).
export function fmiReferenceLabel(sexM: boolean): string {
  const [lo, hi] = sexM ? [3, 6] : [5, 9];
  return `${lo}–${hi}`;
}

// Bandas de corte COMPLETAS por indicador (para el hibrido inline de las tarjetas del DFI, aprobado
// Santiago: que el profesional vea contra que se compara sin ir a la tabla). Re-encodean los cortes de los
// clasificadores del MOTOR (engine.core.js cIFC/cIRC/cIEHH/cISCM/cIAE; engine.core.derived cFMI/cFFMI;
// engine.dfi el ICEC 50/80). NO es una segunda fuente suelta: el candado indicator-ranges.test.ts prueba
// cada frontera contra el clasificador frozen y truena si divergen. Formato compacto (una linea pequeña).
// Devuelve null si el indicador no tiene bandas de display (p. ej. PABU/ICA-BIS/EB, que son punto o sin banda).
export function indicatorBands(code: string, sexM: boolean): string | null {
  switch (code) {
    case "IFC": // cIFC: >hi optima · lo–hi alerta · <lo disfuncion (mas alto es mejor)
      return sexM
        ? "óptima >6.68 · alerta 4.12–6.68 · disfunción <4.12"
        : "óptima >3.28 · alerta 2.08–3.28 · disfunción <2.08";
    case "IRC": // cIRC: <lo bajo · lo–hi moderado · >hi alto (mas bajo es mejor)
      return sexM
        ? "bajo <1.68 · moderado 1.68–2.11 · alto >2.11"
        : "bajo <2.27 · moderado 2.27–2.85 · alto >2.85";
    case "IEHH": // cIEHH (sin sexo): ≤0 óptimo · ≤1 leve · ≤2 moderado · >2 severo
      return "óptimo ≤0 · leve ≤1 · moderado ≤2 · severo >2";
    case "ISCM": // cISCM (sin sexo): ISCM-1 ≤−1 · ISCM-2 ≤1 · ISCM-3 ≤2.5 · ISCM-4 >2.5
      return "ISCM-1 ≤−1 · ISCM-2 ≤1 · ISCM-3 ≤2.5 · ISCM-4 >2.5";
    case "IAE": // cIAE (sin sexo, años): <−5 desacelerado · −5..5 concordante · >5 acelerado
      return "desacelerado <−5 · concordante −5 a 5 · acelerado >5";
    case "FMI": // cFMI: banda media Normal (H 3–6, F 5–9)
      return sexM ? "bajo <3 · normal 3–6 · alto >6" : "bajo <5 · normal 5–9 · alto >9";
    case "FFMI": // cFFMI: banda media Normal (H 17–25, F 15–23)
      return sexM ? "bajo <17 · normal 17–25 · alto >25" : "bajo <15 · normal 15–23 · alto >23";
    case "ICEC": // icec.cl (engine.dfi): <50 bajo · 50–80 intermedio · ≥80 ideal (LE8, 0-100)
      return "bajo <50 · intermedio 50–80 · ideal ≥80";
    default:
      return null;
  }
}

// Referencia + delta para un indicador (por codigo de la tabla), verbatim del HTML. sexM: masculino.
// Devuelve null si el indicador no tiene valor (queda "-").
export function indicatorRange(
  code: string,
  ind: EngineIndicators,
  sexM: boolean,
): IndicatorRange | null {
  switch (code) {
    // IFC, IRC y FMI: la referencia sale del CLASIFICADOR DEL MOTOR (cIFC/cIRC/cFMI), sexo-especifico,
    // NO de la tabla de display del HTML (que era generica y divergia). Gildardo (Q20/C11, cuarta
    // ronda 2026-08-02): "corrijan la tabla contra el motor para IFC, IRC y FMI, no al reves". Antes
    // quedaban en "-" por esa divergencia; ahora se muestran con los cortes del motor. Los umbrales
    // aqui deben COINCIDIR con los literales de los clasificadores en engine.core.js; el test-candado
    // (indicator-ranges.test.ts) prueba cada clasificador en sus fronteras y truena si divergen, para
    // que si Gildardo mueve un umbral no queden dos fuentes fuera de sincronia.
    //
    // Se muestra el UMBRAL que separa sano de alerta, no la banda (decision de Santiago 2026-08-02):
    // es lo que el profesional necesita (que tan cerca del borde que importa), hace la Δ autoevidente
    // (Δ = valor − ese umbral, CA-2 corte unico), y es honesto con la DIRECCION del riesgo (en IFC
    // mas alto es mejor; en IRC mas bajo). FMI resulta banda MEDIA (sano = Normal, entre dos cortes),
    // asi que va como RANGO igual que FFMI (Δ contra el promedio).
    case "IFC": {
      // cIFC: sano = optima (> hi). Umbral = hi (M 6.68, F 3.28). Δ = valor − hi (corte unico).
      if (ind.ifc == null) return null;
      const hi = sexM ? 6.68 : 3.28;
      return { reference: `> ${hi}`, delta: f(ind.ifc - hi, 2) };
    }
    case "IRC": {
      // cIRC: sano = bajo riesgo (< lo). Umbral = lo (M 1.68, F 2.27). Δ = valor − lo (corte unico).
      if (ind.irc == null) return null;
      const lo = sexM ? 1.68 : 2.27;
      return { reference: `< ${lo}`, delta: f(ind.irc - lo, 2) };
    }
    case "FMI": {
      // cFMI: sano = Normal (M 3-6, F 5-9). Gildardo §2 (2026-08-17): Δ contra el BORDE SUPERIOR (M 6 / F 9),
      // el limite que decide (exceder grasa es el riesgo), no el punto medio.
      if (ind.FMI == null) return null;
      const ref = sexM ? 6 : 9;
      return { reference: fmiReferenceLabel(sexM), delta: f(ind.FMI - ref, 2) };
    }
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
      // IAE: unico clasificador de DOS COLAS del sistema (<−5 desacelerado · −5..+5 concordante · >+5
      // acelerado; Gildardo §2, 2026-08-18). El Delta se deja en "—" (delta: null) por decision de Santiago
      // (2026-08-19): Gildardo lo prefiere ("el dato que manda es el valor, no el Δ"). El IAE ya es una
      // diferencia (EB-BIS − edad), asi que su Δ seria la distancia de una distancia; en esta fila el valor
      // con su signo ya lo dice todo. Se conserva la referencia "−5 a +5 años".
      // REGLA GENERAL DE DOS COLAS (registrada aunque el IAE no muestre su Δ): cuando aparezca otro
      // clasificador de dos colas, el Δ va contra el borde DEL LADO DEL SIGNO (>=0 contra +borde; <0 contra
      // −borde), asi el numero responde "cuanto falta para cruzar". Sin volver a preguntar (Gildardo §2).
      return ind.iae != null ? { reference: "−5 a +5 años", delta: null } : null;
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
      // Gildardo §2 (2026-08-17): Δ contra el BORDE inferior (M 17 / F 15), no el punto medio del rango.
      const ref = sexM ? 17 : 15;
      return { reference: sexM ? "17–25" : "15–23", delta: f(ind.FFMI - ref, 2) };
    }
    case "AF": {
      if (!(ind.AF > 0)) return null;
      // Gildardo §2 (2026-08-17): Δ contra el BORDE inferior (M 6.5 / F 6.0), no el punto medio del rango.
      const ref = sexM ? 6.5 : 6.0;
      // D-016: el AF (y su delta) siempre con 1 decimal.
      return { reference: sexM ? "6.5–7.0°" : "6.0–6.5°", delta: f(ind.AF - ref, 1) };
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
