// Severidad de riesgo por indicador, para la capa clinica de color de BRAND. El clasificador
// congelado ya emite su veredicto de riesgo codificado en un color hex (`c`); aqui se re-corre
// sobre los valores YA congelados en el snapshot (funciones puras, deterministas: mismo valor +
// sexo -> mismo veredicto que la etiqueta guardada) y se BUCKETIZA ese color a una escala 0-3.
//
// No se muestra el hex del prototipo (BRAND es sobrio): solo se usa su SEMANTICA de riesgo para
// elegir el token clinico. Por eso se lee el tono, no el valor exacto: verde -> optimo (0),
// ambar/naranja -> alerta (2), rojo -> critico (3), gris/desaturado -> sin color (null).

import * as core from "./frozen/engine.core.js";
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

// Mapa codigo de indicador -> severidad (0-3) o null (sin color). Solo los indicadores con
// clasificador congelado; el resto queda neutral. Los clasificadores nullable (ISCM/IEHH/IAE)
// solo se corren si el valor existe.
export function indicatorSeverities(output: EngineOutput): Record<string, number | null> {
  const i: EngineIndicators = output.indicators;
  const sexo = output.sexo;
  const sev: Record<string, number | null> = {};
  sev.IFC = colorSev(core.cIFC(i.ifc, sexo).c);
  sev.IRC = colorSev(core.cIRC(i.irc, sexo).c);
  sev.PABU = colorSev(core.cPABU(i.pabu, i.ifc).c);
  sev.FMI = colorSev(core.cFMI(i.FMI, sexo).c);
  sev.FFMI = colorSev(core.cFFMI(i.FFMI, sexo).c);
  if (i.iscm != null) sev.ISCM = colorSev(core.cISCM(i.iscm).c);
  if (i.iehh != null) sev.IEHH = colorSev(core.cIEHH(i.iehh).c);
  if (i.iae != null) sev.IAE = colorSev(core.cIAE(i.iae).c);
  return sev;
}
