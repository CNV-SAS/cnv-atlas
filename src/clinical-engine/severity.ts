// Severidad de riesgo por indicador, para la capa clinica de color de BRAND. El clasificador
// congelado ya emite su veredicto de riesgo codificado en un color hex (`c`); aqui se re-corre
// sobre los valores YA congelados en el snapshot (funciones puras, deterministas: mismo valor +
// sexo -> mismo veredicto que la etiqueta guardada) y se BUCKETIZA ese color a una escala 0-3.
//
// No se muestra el hex del prototipo (BRAND es sobrio): solo se usa su SEMANTICA de riesgo para
// elegir el token clinico. Por eso se lee el tono, no el valor exacto: verde -> optimo (0),
// ambar/naranja -> alerta (2), rojo -> critico (3), gris/desaturado -> sin color (null).

// Derivado: engine.core.js + 6 exports aditivos (efrProf, clasificadores). Mecanismo de archivo
// derivado, no edita el frozen (ver engine.core.derived.js y DIFF C).
import * as core from "./frozen/engine.core.derived.js";
import type { EngineIndicators, EngineOutput } from "./types";

export function colorSev(c: unknown): number | null {
  if (typeof c !== "string" || !/^#[0-9a-fA-F]{6}$/.test(c)) return null;
  const r = parseInt(c.slice(1, 3), 16);
  const g = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0 || (max - min) / max < 0.28) return null; // gris/desaturado -> neutral
  if (g > r) return 0; // verde -> optimo
  if (g >= 80) return 2; // ambar/naranja -> alerta
  return 3; // rojo -> critico
}

// AZUL: la unica tonalidad AMBIGUA del frozen, y por eso no se puede leer por el color.
//
// Barrido de los quince clasificadores (2026-08-24): el azul aparece en CUATRO, con dos significados
// OPUESTOS. `cFMI` y `cEISG` lo usan para "Bajo" (deficit); `cFFMI` para "Alto - sospecha anabolizantes"
// (alteracion por exceso); y `cSMM` para **"Optimo"**, que es el mejor nivel posible.
//
// Antes de esto, `colorSev` decidia por el tono con `g > r`, y en todo azul el verde supera al rojo, asi
// que los CUATRO caian en 0 (optimo). Dos defectos reales que se veian en la tabla de Wang del
// Diagnostico: un FMI bajo (deficit de masa grasa) y un FFMI alto con SOSPECHA DE ANABOLIZANTES se
// pintaban con el color de "optimo". El de cSMM acertaba por casualidad.
//
// El desempate lo da la ETIQUETA, que es lo que el frozen si dice sin ambiguedad, y el default es el lado
// SEGURO: un azul cuya etiqueta no diga "optimo" se trata como alteracion. Errar hacia "hay algo que
// mirar" es recuperable; errar hacia "esta optimo" es lo que acaba de pasar.
//
// NO se introduce un color nuevo. El azul sigue siendo EXCLUSIVO del radar (decision 2026-08-15: en un
// badge que dice si algo esta bien o mal, verde-ambar-naranja-rojo se lee sin pensar, el azul obliga a
// recordar que significa). Aqui, ademas, significaria lo contrario que alli, que es justo la lectura
// cruzada que hay que evitar.
const AZUL = /^#(3b82f6|60a5fa|2563eb|1d4ed8|93c5fd|bfdbfe|0ea5e9|38bdf8)$/i;

function esOptimo(label: unknown): boolean {
  return typeof label === "string" && /óptim|optim/i.test(label);
}

/** Severidad de un veredicto del clasificador congelado, desambiguando el azul por su etiqueta. */
export function veredictoSev(v: { l?: unknown; c?: unknown } | null | undefined): number | null {
  if (!v) return null;
  if (typeof v.c === "string" && AZUL.test(v.c)) return esOptimo(v.l) ? 0 : 2;
  return colorSev(v.c);
}

// Mapa codigo de indicador -> severidad (0-3) o null (sin color). Solo los indicadores con
// clasificador congelado; el resto queda neutral. Los clasificadores nullable (ISCM/IEHH/IAE)
// solo se corren si el valor existe.
export function indicatorSeverities(output: EngineOutput): Record<string, number | null> {
  const i: EngineIndicators = output.indicators;
  const sexo = output.sexo;
  const sev: Record<string, number | null> = {};
  sev.IFC = veredictoSev(core.cIFC(i.ifc, sexo));
  sev.IRC = veredictoSev(core.cIRC(i.irc, sexo));
  sev.PABU = veredictoSev(core.cPABU(i.pabu)); // cPABU direccional (swap del 18): sin IFC
  sev.FMI = veredictoSev(core.cFMI(i.FMI, sexo));
  sev.FFMI = veredictoSev(core.cFFMI(i.FFMI, sexo));
  if (i.iscm != null) sev.ISCM = veredictoSev(core.cISCM(i.iscm));
  if (i.iehh != null) sev.IEHH = veredictoSev(core.cIEHH(i.iehh));
  if (i.iae != null) sev.IAE = veredictoSev(core.cIAE(i.iae));
  // AF/IR: sus clasificadores tambien existen (cAF/cIR); antes faltaban aqui como faltaban en
  // engine.ts. Se computa al mostrar (desde el valor sellado), asi que el color aparece en TODOS los
  // diagnosticos, viejos y nuevos (a diferencia de la etiqueta de clasificacion, que se sella).
  if (i.AF > 0) sev.AF = veredictoSev(core.cAF(i.AF, sexo));
  if (i.IR > 0) sev.IR = veredictoSev(core.cIR(i.IR, sexo));
  return sev;
}
