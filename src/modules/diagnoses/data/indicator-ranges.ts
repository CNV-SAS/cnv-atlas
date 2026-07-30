import type { EngineIndicators } from "@/clinical-engine";

// Rangos de referencia y DELTA de la tabla de indicadores, TRANSCRITOS VERBATIM de la tabla de
// Niveles del HTML de Gildardo. Fuente: docs/entregas/gildardo-2026-07-30/ATLAS_v7.html, filas
// R(...) de los Niveles II/IV/V y del bloque "ÍNDICES BIOELÉCTRICOS INTEGRADOS" (lineas
// ~12828-12878). Entrega 2026-07-30, identidad verificada (ver INVENTARIO tabla de resolucion).
//
// NO se inventa ningun valor ni el extremo faltante de un rango de un solo limite (Gildardo, ronda 1
// punto 9: "transcribir sin cambiar un solo valor; es transcripcion, no reinterpretacion").
//
// El DELTA se toma VERBATIM por indicador: el codigo de Gildardo elige un borde CLINICAMENTE
// RELEVANTE por fila (IMC contra el superior, FFMI contra el inferior, IR contra su umbral...), NO
// "la distancia al borde mas cercano" (su descripcion en prosa es una simplificacion; ver ARCHITECTURE
// "su prosa orienta, su codigo especifica"). Su formula del delta va a la 4a ronda como confirmacion,
// no como bloqueo.
//
// Rangos de UN SOLO LIMITE (no se inventa el otro extremo): ISCM (≤−1), IEHH (≤0), IR (<0.78/<0.82).
// PABU e ICA-BIS son referencia de PUNTO (φ = 1.618). EB usa la edad cronologica como referencia.

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
    case "IFC":
      return ind.ifc != null ? { reference: "3.5–6.0", delta: f(ind.ifc - 3.5, 2) } : null;
    case "IRC":
      // El HTML muestra IRC ×10 (rango y delta en esa escala). Nuestra columna de VALOR muestra el
      // IRC crudo -> inconsistencia de escala, reportada (no se resuelve inventando otro rango).
      return ind.irc != null ? { reference: "2.0–2.8 (×10)", delta: f(ind.irc * 10 - 2.0, 3) } : null;
    case "PABU":
      return ind.pabu != null ? { reference: "φ = 1.618", delta: f(ind.pabu - 1.618, 4) } : null;
    case "ICA-BIS":
      // ICA-BIS = PABU − φ: su propio valor ES la distancia; el delta del HTML es el valor mismo.
      return ind.icaBis != null ? { reference: "φ = 1.618", delta: f(ind.icaBis, 4) } : null;
    case "ISCM":
      return ind.iscm != null ? { reference: "≤−1", delta: f(ind.iscm, 2) } : null;
    case "IEHH":
      return ind.iehh != null ? { reference: "≤0", delta: f(ind.iehh, 3) } : null;
    case "IAE":
      return ind.iae != null ? { reference: "−5 a +5 años", delta: f(ind.iae, 1) } : null;
    case "EB":
      // El HTML usa la edad cronologica como referencia, pero la edad NO se sella en el EngineOutput
      // (vive en EngineInput). Sin edad sellada, la referencia queda "-"; el delta SI se muestra (es
      // el IAE, edad biologica − cronologica, que si esta en indicators). Para mostrar la edad haria
      // falta sellar edad en el snapshot (solo diagnosticos nuevos) o pasar la fecha de nacimiento;
      // ver BACKLOG.
      return ind.eb != null ? { reference: "—", delta: ind.iae != null ? f(ind.iae, 1) : null } : null;
    case "FMI":
      return ind.FMI != null
        ? { reference: sexM ? "6–9" : "9–13", delta: f(ind.FMI - (sexM ? 9 : 13), 2) }
        : null;
    case "FFMI":
      return ind.FFMI != null
        ? { reference: sexM ? "17–25" : "15–23", delta: f(ind.FFMI - (sexM ? 17 : 15), 2) }
        : null;
    case "AF":
      return ind.AF > 0
        ? { reference: sexM ? "6.5–7.0°" : "6.0–6.5°", delta: f(ind.AF - (sexM ? 6.5 : 6.0), 2) }
        : null;
    case "IR":
      return ind.IR > 0
        ? { reference: sexM ? "<0.78" : "<0.82", delta: f(ind.IR - (sexM ? 0.78 : 0.82), 3) }
        : null;
    default:
      return null;
  }
}
