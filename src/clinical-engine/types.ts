// Contrato del motor clinico de Atlas (ANI-BIS-E). TS PURO: este modulo no importa
// nada de la app (Next, React, Supabase). Entran objetos tipados, salen objetos
// tipados (ARCHITECTURE regla 12). Las firmas se basan en CLINICAL_ENGINE.md; la
// matematica real esta CONGELADA hasta la entrega final de Gildardo (se porta en B11
// con golden tests, regla 6). Hoy solo existe el stub.

export type Sex = "M" | "F";

// Identificadores (en texto) de la version del modelo contra la que corre el motor.
// El motor es puro: NO conoce el UUID del model_version en BD; recibe los nombres y
// los devuelve en versions. El id de BD (model_version_id) lo maneja el pipeline al
// persistir la constelacion (regla 7).
export type EngineModelContext = {
  version: string; // model_versions.version_name
  rulesVersion: string; // model_versions.rules_version
};

export type EngineBisInput = {
  // Cole-Cole (resistencias/reactancia/capacitancia)
  Re: number;
  Ri: number;
  Rinf: number;
  C: number;
  // Composicion corporal (la entrega Biody Manager)
  FMI: number;
  FFMI: number;
  MCA: number;
  MCA_ref: number;
  smmW: number;
  ASMI: number;
  AF: number;
  IR: number;
  ECW: number;
  ICW: number;
  FFM: number;
  peso: number;
  talla: number;
  imc: number;
  // Indicadores de fuente (a confirmar con Gildardo donde se calculan; opcionales).
  iscm?: number;
  iehh?: number;
  iae?: number;
  eb?: number;
};

export type EngineInput = {
  sexo: Sex;
  edad: number;
  bis: EngineBisInput;
  // Respuestas de encuesta codificadas (d1..d5), comorbilidades, LE8, habitos.
  survey: Record<string, unknown>;
  model: EngineModelContext;
};

// Clasificacion de un indicador: etiqueta, color de UI, nivel de riesgo y banda
// (k = 1/2/3). Los cortes que la producen son datos versionados del model-registry.
export type IndicatorClassification = {
  label: string;
  color: string;
  risk: string;
  k: number;
};

export type EngineIndicators = {
  ifc: number;
  irc: number;
  pabu: number;
  icaBis: number;
  iscm: number;
  iehh: number;
  iae: number;
  eb: number;
  FMI: number;
  FFMI: number;
  AF: number;
  IR: number;
};

// Estado funcional EFR (Diana de 81 estados). Lenguaje FUNCIONAL, no de enfermedad.
export type EfrState = {
  number: number; // 1..81
  diagnostico: string;
  mecanismo: string;
  biomarcadores: string;
  riesgos: string;
  nutraceuticos: string;
};

// Protocolo determinista (estrategia calorica, proteina, restricciones, examenes,
// suplementacion). El menu de comida lo genera la IA aparte (no aqui).
export type EngineProtocol = {
  estrategia: string;
  protMin: number;
  protMax: number;
  restricciones: string[];
  examenes: string[];
  suplementacion: string[];
  resumenClinico: string;
  alertaSindRealim: boolean;
};

export type EngineVersions = {
  engine: string; // version interna del motor (ENGINE_VERSION)
  model: string; // model_versions.version_name (eco del input)
  rules: string; // model_versions.rules_version (eco del input)
};

export type EngineOutput = {
  indicators: EngineIndicators;
  classifications: Record<string, IndicatorClassification>;
  fenotipo: { id: string; nombre: string; riesgo: string }; // MCCB F1-F12
  sectorFR: { id: string; nombre: string }; // S1-S9
  estadoPBI: { id: string; nombre: string; riesgo: string };
  estadoEIEC: { nombre: string; riesgo: string };
  efrState: EfrState;
  alerts: string[];
  protocol: EngineProtocol;
  versions: EngineVersions;
};

// Codigos canonicos de los indicadores (estables; los usa el pipeline para mapear cada
// valor a su indicator_definition en el registry). El orden refleja las capas del v7.
export const INDICATOR_CODES = [
  "IFC",
  "IRC",
  "PABU",
  "ICA-BIS",
  "ISCM",
  "IEHH",
  "IAE",
  "EB",
  "FMI",
  "FFMI",
  "AF",
  "IR",
] as const;

export type IndicatorCode = (typeof INDICATOR_CODES)[number];
