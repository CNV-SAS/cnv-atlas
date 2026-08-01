// Versiones de emisión selladas en cada diagnóstico (columna jsonb `emission_versions`). Registran
// CON QUÉ versión de cada dimensión emergente se emitió el diagnóstico, para reemitir/comparar sin
// reescribir lo sellado (regla de Gildardo: si cambia lo que manda, se deja constancia de la versión,
// no se reescribe lo emitido). Complementa la constelación tipada de la regla 7
// (engine_version / model_version_id / rules_version, que se quedan como columnas dedicadas).
//
// Granularidad = diagnóstico (no por-indicador): la emisión es atómica; todos los indicadores de un
// diagnóstico comparten la misma versión (se computan juntos), así que por-indicador no agregaría
// información. Ver la discusión en GILDARDO_QUERIES / BACKLOG.

// CLAVES DE CONSTANTES, nunca strings libres (mismo riesgo que el `event` del audit log: un typo
// queda invisible para siempre, y aquí es un registro clínico SELLADO). El writer solo puede usar
// estas. Se agregan nuevas dimensiones aquí (una línea), sin migración de esquema (el jsonb absorbe).
export const EMISSION_VERSION_KEYS = ["classification", "calibration"] as const;
export type EmissionVersionKey = (typeof EMISSION_VERSION_KEYS)[number];
export type EmissionVersions = Record<EmissionVersionKey, string>;

// Versión vigente de cada dimensión. Se versiona A MANO cuando cambie la ciencia. Las etiquetas de
// abajo son NUESTRAS (nomenclatura interna de Atlas), NO versiones que Gildardo definió: solo nombran
// con qué juego/calibración se emitió, para poder distinguir emisiones.
//  - classification: qué juego de clasificadores usó el motor (Q20, cXXX vs dXXX). Hoy `cXXX` (core).
//    Si Q20 resuelve a favor de los `dXXX`, esta clave pasa a `dXXX-1.0` y los diagnósticos nuevos se
//    sellan con ella (los viejos quedan con `cXXX-1.0`): es exactamente para lo que sirve el campo.
//  - calibration: calibración de la EB-BIS (requisito C2b de Gildardo, confirmado en P0). Provisional
//    hasta que exista población para recalibrar; al recalibrar se sube la versión y se reemite.
const CURRENT: EmissionVersions = {
  classification: "cXXX-1.0", // etiqueta interna de Atlas, no de Gildardo (ver comentario arriba)
  calibration: "ebbis-v5-provisional",
};

// Set COMPLETO de versiones vigentes. El writer lo sella ENTERO (regla de completitud): un jsonb
// parcial sería indistinguible de uno incompleto. `emissionVersionsComplete` + su test lo verifican.
export function buildEmissionVersions(): EmissionVersions {
  return { ...CURRENT };
}

// True si el objeto trae TODAS las claves aplicables (ninguna olvidada). Distingue "no aplicaba" de
// "se nos olvidó": aplicable siempre significa presente.
export function emissionVersionsComplete(v: Record<string, unknown>): boolean {
  return EMISSION_VERSION_KEYS.every((k) => typeof v[k] === "string" && v[k] !== "");
}
