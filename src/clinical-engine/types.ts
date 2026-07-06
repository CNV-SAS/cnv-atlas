// Contrato del motor clinico de Atlas (ANI-BIS-E). TS PURO: este modulo no importa
// nada de la app (Next, React, Supabase) (regla 12). Reconciliado en B11 con la
// TAXONOMIA REAL del prototipo de Gildardo (autoridad sobre los docs viejos, que
// hablaban de F1-F12/PBI/EIEC de una version anterior del modelo):
//   - 12 indicadores (IFC, IRC, PABU, ICA-BIS, ISCM, IEHH, IAE, EB, FMI, FFMI, AF, IR)
//   - Fenotipo EFR: 81 estados, clave IFC_IRC_FFMI_FMI (mapa DX congelado)
//   - Fenotipo estructural: 9 (STRUCT_LABELS, FFMI x FMI)
//   - Sector funcional FyR: 9 (FYR_LABELS, IFC x IRC)
//   - DFI (Diagnostico Funcional Integral): 5 dominios + riesgo integrado + rutas
//     AUTORITATIVAS. Puede correr DEGRADADO (sin datos de encuesta): se marca explicito.

export type Sex = "M" | "F";

// Identificadores (en texto) de la version del modelo. El motor es puro: no conoce el
// UUID del model_version en BD; lo maneja el pipeline al persistir (regla 7).
export type EngineModelContext = {
  version: string; // model_versions.version_name
  rulesVersion: string; // model_versions.rules_version
};

export type EngineInput = {
  sexo: Sex;
  edad: number;
  // Fila CRUDA del Biody con los headers EXACTOS del contrato de 94 columnas. El motor
  // corre su puerta dura (parseBiodyRow/assertEngineInputs): un import defectuoso LANZA.
  bisRow: Record<string, unknown>;
  // Respuestas de encuesta con los IDs del prototipo (d1_9, d2_21, ...). Vacio hasta
  // que se porte el contenido real de la encuesta (item posterior a B11): el DFI corre
  // degradado y se marca como tal.
  survey: Record<string, unknown>;
  model: EngineModelContext;
};

// Los 12 indicadores. ISCM/IEHH pueden ser null si faltan insumos secundarios del BIS;
// EB/IAE son null sin ICEC (encuesta). No se inventan valores (comportamiento deliberado).
export type EngineIndicators = {
  ifc: number;
  irc: number;
  pabu: number;
  icaBis: number;
  iscm: number | null;
  iehh: number | null;
  iae: number | null;
  eb: number | null;
  FMI: number;
  FFMI: number;
  AF: number;
  IR: number;
};

// Clasificacion de un indicador: etiqueta y banda (k = 1/2/3) del clasificador congelado.
// null cuando el indicador no se pudo calcular.
export type IndicatorClass = {
  label: string;
  k?: number;
} | null;

// Fenotipo EFR (Diana de 81 estados). Clave IFC_IRC_FFMI_FMI (letras A/N/B). Lenguaje
// funcional; contenido del mapa DX congelado.
export type EfrPhenotype = {
  key: string; // "N_N_N_A"
  stateNumber: number; // 1..81 (derivado determinista de las 4 bandas)
  bands: { ifc: number; irc: number; ffmi: number; fmi: number }; // k de cada uno (1/2/3)
  diagnostico: string;
  nutraceuticos: string;
};

// Fenotipo estructural (STRUCT_LABELS, FFMI x FMI): 9 combinaciones.
export type StructuralPhenotype = { key: string; nombre: string };

// Sector funcional FyR (FYR_LABELS, IFC x IRC): 9 combinaciones.
export type FrSector = { key: string; nombre: string };

// DFI: dominio del arbol de 5 dominios.
export type DfiDomain = {
  id: string; // d1..d5
  nombre: string;
  sev: number; // 0..3
  clasif: string;
  lectura: string;
  items: string[];
  veto?: boolean;
};

export type DfiRisk = { nivel: string; score: number; descripcion: string };

// DFI integrado. `complete=false` => corrio DEGRADADO (sin datos de encuesta): los
// dominios de encuesta y EB/IAE/LE8 no son fiables. Marca explicita (no null silencioso)
// para que el reporte avise al profesional (condicion de Santiago, B11).
export type EngineDfi = {
  complete: boolean;
  degradedReason: string | null;
  domains: DfiDomain[];
  riesgo: DfiRisk;
  veto: boolean;
  rutas: string[]; // AUTORITATIVAS (del DFI, no de los predicados sueltos R1-R6)
  le8Total: number | null;
};

export type EngineVersions = {
  engine: string; // ENGINE_VERSION
  model: string; // eco del input
  rules: string; // eco del input
};

export type EngineOutput = {
  sexo: Sex;
  indicators: EngineIndicators;
  classifications: Record<string, IndicatorClass>;
  efrPhenotype: EfrPhenotype;
  structural: StructuralPhenotype;
  frSector: FrSector;
  dfi: EngineDfi;
  // Recomendacion de nutraceuticos (del fenotipo EFR) y resumen clinico preliminar para
  // el tratamiento. El tratamiento real y el menu por IA son bloques posteriores.
  nutraceuticos: string;
  resumenClinico: string;
  versions: EngineVersions;
};

// Codigos canonicos de los 12 indicadores (estables; el pipeline los mapea a su
// indicator_definition en el registry). Orden por capas del v7.
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

// Mapa de la clave de indicador (en EngineIndicators) a su codigo canonico del registry.
export const INDICATOR_KEY_TO_CODE: Record<keyof EngineIndicators, IndicatorCode> = {
  ifc: "IFC",
  irc: "IRC",
  pabu: "PABU",
  icaBis: "ICA-BIS",
  iscm: "ISCM",
  iehh: "IEHH",
  iae: "IAE",
  eb: "EB",
  FMI: "FMI",
  FFMI: "FFMI",
  AF: "AF",
  IR: "IR",
};

// Banda (k del clasificador) -> letra de la clave EFR. 3=A(alto) 2=N(normal) 1=B(bajo).
export function bandToLetter(k: number): "A" | "N" | "B" {
  return k === 3 ? "A" : k === 1 ? "B" : "N";
}

// Numero de estado EFR (1..81) determinista desde las 4 bandas (cada una 1/2/3).
export function efrStateNumber(bands: {
  ifc: number;
  irc: number;
  ffmi: number;
  fmi: number;
}): number {
  const n = (b: number) => Math.min(3, Math.max(1, b)) - 1; // 0..2
  return n(bands.ifc) * 27 + n(bands.irc) * 9 + n(bands.ffmi) * 3 + n(bands.fmi) + 1;
}
