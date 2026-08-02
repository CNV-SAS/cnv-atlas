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
export const EMISSION_VERSION_KEYS = ["classification", "calibration", "structural_mccb"] as const;
export type EmissionVersionKey = (typeof EMISSION_VERSION_KEYS)[number];
export type EmissionVersions = Record<EmissionVersionKey, string>;

// Versión vigente de cada dimensión. Se versiona A MANO cuando cambie la ciencia. Las etiquetas de
// abajo son NUESTRAS (nomenclatura interna de Atlas), NO versiones que Gildardo definió: solo nombran
// con qué juego/calibración se emitió, para poder distinguir emisiones.
//  - classification: qué juego de clasificadores usó el motor (Q20, cXXX vs dXXX). Hoy `cXXX` (core).
//    Si Q20 resuelve a favor de los `dXXX`, esta clave pasa a `dXXX-1.0` y los diagnósticos nuevos se
//    sellan con ella (los viejos quedan con `cXXX-1.0`): es exactamente para lo que sirve el campo.
//  - calibration: calibración de la EB-BIS (requisito C2b de Gildardo, confirmado en P0). Provisional
//    hasta que exista población para recalibrar; al recalibrar se sube la versión y se REEMITE.
//    VÍNCULO (escrito a propósito): esa REEMISIÓN es el mecanismo de SUCESIÓN DE VERSIONES que HOY NO
//    EXISTE, el mismo del flujo de corrección post-diagnóstico (ver BACKLOG). La calibración
//    poblacional es el primer caso concreto y PREVISTO de reemisión, y hoy no hay cómo hacerla:
//    emission_versions marca CON QUÉ se emitió, pero reemitir un diagnóstico sellado necesita ese
//    mecanismo. Las dos cosas son la misma; no se construye aquí.
//  - structural_mccb: con qué versión del clasificador de fenotipo MCCB (F1-F12) se selló ese
//    diagnóstico. Es la SEGUNDA clasificación estructural (Q19: se sellan las dos, ninguna deriva de
//    la otra). Su PRESENCIA distingue un diagnóstico que trae el MCCB de uno que solo tiene la de
//    nueve estados: los diagnósticos emitidos ANTES de esta fecha no tienen la clave (su
//    emission_versions es null o no la incluye), y NO se rellenan hacia atrás (Gildardo: "de aquí en
//    adelante"; si hiciera falta el MCCB en un paciente anterior, se emite una versión nueva). El
//    fenotipo mismo se sella en el snapshot (id+nombre); esta clave marca CON QUÉ versión.
const CURRENT: EmissionVersions = {
  classification: "cXXX-1.0", // etiqueta interna de Atlas, no de Gildardo (ver comentario arriba)
  calibration: "ebbis-v5-provisional",
  structural_mccb: "mccb-1.0", // etiqueta interna; la tabla FENOTIPOS_MCCB es verbatim de Gildardo
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

// ¿La EB-BIS de ESTE diagnóstico se calculó con una calibración PROVISIONAL? Se lee del campo
// SELLADO (emission_versions.calibration), no de una constante: la marca "calibración provisional"
// en la vista del profesional (P0) sale del dato que el diagnóstico lleva sellado. Primer uso real
// de emission_versions (2026-08-01).
//   - null (diagnósticos previos a la columna, demo) => provisional: todos se emitieron con la
//     calibración v5 provisional, así que la marca aplica.
//   - un valor que termina en "-provisional" => provisional.
// Cuando exista la calibración poblacional y CURRENT.calibration deje de terminar en "-provisional",
// los diagnósticos NUEVOS sellan ese valor y la marca desaparece SOLA para ellos; los viejos la
// conservan. No hay que tocar nada el día que llegue la calibración: es el punto de esa automática.
export function isProvisionalCalibration(ev: Record<string, unknown> | null | undefined): boolean {
  const cal = ev?.calibration;
  if (ev == null || cal == null) return true;
  return typeof cal === "string" && cal.endsWith("-provisional");
}
