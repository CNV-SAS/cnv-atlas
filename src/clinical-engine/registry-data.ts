// Datos del model-registry DERIVADOS de la ciencia congelada (B11, ST5). Genera los
// catalogos del modelo (indicadores, fenotipos estructurales, sectores FyR y los 81
// estados EFR) a partir del motor de Gildardo, para poblarlos en BD sin transcribir a
// mano. La taxonomia real manda sobre los docs viejos (F1-F12/PBI/EIEC no aplican).
//
// TS puro; consume la ciencia congelada (frozen/) via el adaptador de tipos.

import * as core from "./frozen/engine.core.js";
import { bandToLetter, efrStateNumber, INDICATOR_CODES } from "./types";

export type IndicatorDef = { code: string; name: string; unit: string | null };
export type PhenotypeDef = { code: string; name: string }; // estructural (STRUCT, 9)
export type FrSectorDef = { code: string; name: string }; // sector FyR (FYR, 9)
export type EfrStateDef = {
  stateNumber: number; // 1..81
  ifcBand: number;
  ircBand: number;
  ffmiBand: number;
  fmiBand: number;
  key: string; // IFC_IRC_FFMI_FMI (letras A/N/B)
  diagnosisName: string;
  mechanism: string;
  biomarkers: string;
  risks: string;
  suggestedNutraceuticals: string;
};

// Nombres de los 12 indicadores (documentales; los codigos y la ciencia son la fuente de
// verdad). Orden = INDICATOR_CODES del contrato.
const INDICATOR_NAMES: Record<string, { name: string; unit: string | null }> = {
  IFC: { name: "Indice de Funcionalidad Celular", unit: null },
  IRC: { name: "Indice de Riesgo Celular", unit: null },
  PABU: { name: "Proporcion Aurea Bioelectrica Universal", unit: null },
  "ICA-BIS": { name: "Indice de Coherencia Aurea (BIS)", unit: null },
  ISCM: { name: "Indice de Susceptibilidad Cardiometabolica (BIS)", unit: null },
  IEHH: { name: "Indice del Espectro de Hidratacion Humana", unit: null },
  IAE: { name: "Indice de Aceleracion del Envejecimiento", unit: "anos" },
  EB: { name: "Edad Biologica Celular (EB-BIS)", unit: "anos" },
  FMI: { name: "Indice de Masa Grasa", unit: "kg/m2" },
  FFMI: { name: "Indice de Masa Libre de Grasa", unit: "kg/m2" },
  AF: { name: "Angulo de Fase a 50 kHz", unit: "grados" },
  IR: { name: "Impedance Ratio", unit: null },
};

export function buildIndicatorDefs(): IndicatorDef[] {
  return INDICATOR_CODES.map((code) => ({
    code,
    name: INDICATOR_NAMES[code].name,
    unit: INDICATOR_NAMES[code].unit,
  }));
}

// Fenotipos estructurales (STRUCT_LABELS: FFMI x FMI, 9). code = clave "A_B", etc.
export function buildPhenotypeDefs(): PhenotypeDef[] {
  return Object.entries(core.STRUCT_LABELS).map(([code, name]) => ({ code, name }));
}

// Sectores funcionales FyR (FYR_LABELS: IFC x IRC, 9). code = clave "3_1", etc.
export function buildFrSectorDefs(): FrSectorDef[] {
  return Object.entries(core.FYR_LABELS).map(([code, v]) => ({ code, name: v.l }));
}

// Los 81 estados EFR: se corre el motor congelado (getDX) para cada combinacion de las 4
// bandas (cada una 1/2/3). El contenido (diagnostico/mecanismo/biomarcadores/riesgos/
// nutraceuticos) es verbatim del mapa DX + efrCompose de Gildardo.
export function buildEfrStates(): EfrStateDef[] {
  const out: EfrStateDef[] = [];
  for (let ifc = 1; ifc <= 3; ifc++) {
    for (let irc = 1; irc <= 3; irc++) {
      for (let ffmi = 1; ffmi <= 3; ffmi++) {
        for (let fmi = 1; fmi <= 3; fmi++) {
          const dx = core.getDX(ifc, irc, ffmi, fmi);
          const key = `${bandToLetter(ifc)}_${bandToLetter(irc)}_${bandToLetter(ffmi)}_${bandToLetter(fmi)}`;
          out.push({
            stateNumber: efrStateNumber({ ifc, irc, ffmi, fmi }),
            ifcBand: ifc,
            ircBand: irc,
            ffmiBand: ffmi,
            fmiBand: fmi,
            key,
            diagnosisName: String(dx.dx ?? dx.name ?? key),
            mechanism: String(dx.mec ?? ""),
            biomarkers: String(dx.bio ?? ""),
            risks: String(dx.rsk ?? ""),
            suggestedNutraceuticals: String(dx.n ?? ""),
          });
        }
      }
    }
  }
  return out;
}

export function buildRegistryData() {
  return {
    indicators: buildIndicatorDefs(),
    phenotypes: buildPhenotypeDefs(),
    frSectors: buildFrSectorDefs(),
    efrStates: buildEfrStates(),
  };
}
