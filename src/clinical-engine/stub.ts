import type {
  EngineIndicators,
  EngineInput,
  EngineOutput,
  IndicatorClassification,
} from "./types";
import { INDICATOR_CODES } from "./types";
import { ENGINE_VERSION } from "./version";

// STUB del motor clinico. Devuelve un EngineOutput con la FORMA correcta y valores
// DUMMY deterministas. NO implementa la matematica real (congelada hasta Gildardo); se
// portara en B11 con golden tests que prueben paridad con el HTML de referencia
// (regla 6, innegociable). Su unico proposito es cablear y probar la propagacion
// encuesta -> BIS -> indicadores -> diagnostico -> tratamiento -> reporte AHORA.
//
// Los valores se derivan del input (edad) con una base distinta por indicador: asi dos
// evaluaciones distintas producen salidas distintas y los tests de propagacion
// detectan perdidas o mezclas de datos. Nada de esto es clinico.

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dummyIndicators(edad: number): EngineIndicators {
  return {
    ifc: r2(1 + edad * 0.1),
    irc: r2(2 + edad * 0.1),
    pabu: r2(3 + edad * 0.1),
    icaBis: r2(4 + edad * 0.1),
    iscm: r2(5 + edad * 0.1),
    iehh: r2(6 + edad * 0.1),
    iae: r2(7 + edad * 0.1),
    eb: r2(8 + edad * 0.1),
    FMI: r2(9 + edad * 0.1),
    FFMI: r2(10 + edad * 0.1),
    AF: r2(11 + edad * 0.1),
    IR: r2(12 + edad * 0.1),
  };
}

function dummyClassifications(): Record<string, IndicatorClassification> {
  const out: Record<string, IndicatorClassification> = {};
  for (const code of INDICATOR_CODES) {
    out[code] = { label: "stub", color: "#999999", risk: "indeterminado", k: 2 };
  }
  return out;
}

export function runEngine(input: EngineInput): EngineOutput {
  const edad = input.edad;
  return {
    indicators: dummyIndicators(edad),
    classifications: dummyClassifications(),
    fenotipo: { id: "F0", nombre: "Fenotipo (stub)", riesgo: "indeterminado" },
    sectorFR: { id: "S0", nombre: "Sector FR (stub)" },
    estadoPBI: { id: "PBI0", nombre: "Estado PBI (stub)", riesgo: "indeterminado" },
    estadoEIEC: { nombre: "EIEC (stub)", riesgo: "indeterminado" },
    efrState: {
      number: (Math.round(edad) % 81) + 1, // 1..81 determinista
      diagnostico: "Diagnostico funcional (stub)",
      mecanismo: "(stub)",
      biomarcadores: "(stub)",
      riesgos: "(stub)",
      nutraceuticos: "(stub)",
    },
    alerts: [],
    protocol: {
      estrategia: "(stub)",
      protMin: 0,
      protMax: 0,
      restricciones: [],
      examenes: [],
      suplementacion: [],
      resumenClinico: "Protocolo generado con motor stub (sin valor clinico).",
      alertaSindRealim: false,
    },
    versions: {
      engine: ENGINE_VERSION,
      model: input.model.version,
      rules: input.model.rulesVersion,
    },
  };
}
