// runEngine REAL (B11): reemplaza el stub. Orquesta el adaptador (que envuelve la
// ciencia congelada) y mapea su salida al contrato EngineOutput de la app. TS puro.
//
// Dos rutas (opcion 1 de B11): la BIS (analizarDesdeBiody) siempre corre y da los 12
// indicadores + fenotipo EFR + estructural + FyR; el DFI (analizarDFI) corre completo
// cuando hay encuesta y DEGRADADO cuando no (marcado explicito en dfi.complete, no null
// silencioso). Cuando se porte la encuesta real, el DFI se enciende sin tocar el motor.

import { analizarDesdeBiody, analizarDFI, calcLE8 } from "./analysis";
import * as core from "./frozen/engine.core.js";
import {
  bandToLetter,
  efrStateNumber,
  type EngineDfi,
  type EngineIndicators,
  type EngineInput,
  type EngineOutput,
  type IndicatorClass,
} from "./types";
import { ENGINE_VERSION } from "./version";

function r4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// La encuesta es util si trae algun campo con el patron de ID del prototipo (dN_M).
function hasSurveyData(survey: Record<string, unknown>): boolean {
  return Object.keys(survey).some(
    (k) => /^d\d+_\d+$/.test(k) && survey[k] != null && survey[k] !== "",
  );
}

const DEGRADED_REASON =
  "Sin datos de encuesta: el diagnostico funcional integral (dominios de encuesta, EB/IAE y LE8) esta incompleto hasta integrar la encuesta real.";

export function runEngine(input: EngineInput): EngineOutput {
  const { sexo, edad, bisRow, survey, model } = input;
  const surveyPresent = hasSurveyData(survey);

  // LE8/ICEC desde la encuesta (solo si hay): habilita EB/IAE.
  const le8 = surveyPresent ? calcLE8(survey) : null;
  const icec = le8 != null ? le8.total : null;

  // Ruta BIS (siempre): indices, clases, fenotipo EFR/estructural/FyR, nutraceuticos.
  const a = analizarDesdeBiody(bisRow, sexo, { icec, edad });

  const bands = {
    ifc: a.clases.IFC.k,
    irc: a.clases.IRC.k,
    ffmi: a.clases.FFMI.k,
    fmi: a.clases.FMI.k,
  };

  const efrKey = a.fenotipoEFR.key;
  const stateNumber = efrStateNumber(bands);

  // Fenotipo estructural (STRUCT_LABELS: FFMI_FMI) y sector FyR (FYR_LABELS: ifcK_ircK).
  const structKey = `${bandToLetter(bands.ffmi)}_${bandToLetter(bands.fmi)}`;
  const structural = { key: structKey, nombre: core.STRUCT_LABELS[structKey] ?? structKey };
  const fyrKey = `${bands.ifc}_${bands.irc}`;
  const fyr = core.FYR_LABELS[fyrKey];
  const frSector = { key: fyrKey, nombre: fyr?.l ?? fyrKey };

  // Indicadores (12). AF/IR de las columnas del Biody; ICA-BIS = |PABU - phi| (ATLAS_v7
  // L5721). ISCM/IEHH/IAE/EB pueden ser null (no se inventan).
  const rawAF = a.fuente.raw.AF;
  const rawIR = a.fuente.raw.IR;
  const indicators: EngineIndicators = {
    ifc: a.indices.IFC,
    irc: a.indices.IRC,
    pabu: a.indices.PABU,
    icaBis: r4(Math.abs(a.indices.PABU - 1.618)),
    iscm: a.indices.ISCM,
    iehh: a.indices.IEHH,
    iae: a.indices.IAE,
    eb: a.indices.EB_BIS,
    FMI: a.indices.FMI,
    FFMI: a.indices.FFMI,
    AF: typeof rawAF === "number" ? rawAF : 0,
    IR: typeof rawIR === "number" ? rawIR : 0,
  };

  // Clasificaciones por codigo (las que el clasificador congelado produce). ICA-BIS, EB,
  // AF, IR no tienen clasificador aqui: quedan null.
  const classifications: Record<string, IndicatorClass> = {
    IFC: { label: a.clases.IFC.l, k: a.clases.IFC.k },
    IRC: { label: a.clases.IRC.l, k: a.clases.IRC.k },
    PABU: { label: a.clases.PABU.l },
    FMI: { label: a.clases.FMI.l, k: a.clases.FMI.k },
    FFMI: { label: a.clases.FFMI.l, k: a.clases.FFMI.k },
    ISCM: a.clases.ISCM ? { label: a.clases.ISCM.l } : null,
    IEHH: a.clases.IEHH ? { label: a.clases.IEHH.l } : null,
    IAE: a.clases.IAE ? { label: a.clases.IAE.l } : null,
    "ICA-BIS": null,
    EB: null,
    AF: null,
    IR: null,
  };

  // DFI (autoritativo). Completo con encuesta; degradado sin ella (marcado explicito).
  const dfiRaw = analizarDFI(bisRow, { ...survey, sexo, edad });
  const dfi: EngineDfi = {
    complete: surveyPresent,
    degradedReason: surveyPresent ? null : DEGRADED_REASON,
    domains: dfiRaw.domains.map((d) => ({
      id: d.id,
      nombre: d.nombre,
      sev: d.sev,
      clasif: d.clasif,
      lectura: d.lectura,
      items: d.items,
      veto: d.veto,
    })),
    riesgo: {
      nivel: dfiRaw.riesgo.l,
      score: dfiRaw.riesgo.score,
      descripcion: dfiRaw.riesgo.d,
    },
    veto: dfiRaw.veto,
    rutas: dfiRaw.rutas,
    le8Total: surveyPresent ? dfiRaw.le8.total : null,
  };

  const rutasTxt = dfi.rutas.length ? dfi.rutas.join("; ") : "sin rutas activas";
  const resumenClinico =
    `Fenotipo EFR ${efrKey}: ${a.fenotipoEFR.dx ?? "sin diagnostico"}. ` +
    `Nutraceuticos sugeridos: ${a.fenotipoEFR.nutraceuticos}. ` +
    `Rutas de atencion (DFI${surveyPresent ? "" : ", incompleto sin encuesta"}): ${rutasTxt}.`;

  return {
    sexo: a.sexo,
    indicators,
    classifications,
    efrPhenotype: {
      key: efrKey,
      stateNumber,
      bands,
      diagnostico: a.fenotipoEFR.dx ?? "",
      nutraceuticos: a.fenotipoEFR.nutraceuticos,
    },
    structural,
    frSector,
    dfi,
    nutraceuticos: a.fenotipoEFR.nutraceuticos,
    resumenClinico,
    versions: {
      engine: ENGINE_VERSION,
      model: model.version,
      rules: model.rulesVersion,
    },
  };
}
