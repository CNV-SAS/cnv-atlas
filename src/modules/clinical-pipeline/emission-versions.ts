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
  // BUMP 2026-08-29: se portaron los CORTES DEL IRC POR SEXO (respuesta de Gildardo del 28, punto 6).
  // `cIRC` pasa de un corte unico 1,68/2,11 (H) y 2,27/2,85 (M) a los publicados 1,7/2,1 y 2,3/2,8, y ESO
  // MUEVE DE BANDA: un hombre con IRC 1,69 estaba en "Bajo" y ahora esta en "Normal". Es exactamente el
  // caso para el que existe esta clave.
  //
  // NO SE HABIA BUMPEADO, y hay que decirlo porque el hueco duro varios dias: el porte cambio la ciencia y
  // esta etiqueta se quedo igual, asi que los diagnosticos de antes y de despues se veian "al dia" con la
  // misma version y la comparacion de bandas de su §12b no podia dispararse NUNCA para este cambio. El
  // mecanismo estaba y nadie lo llamo, que es la forma que este proyecto repite.
  //
  // (El cambio de `cAF` del mismo dia NO justifica por si solo el bump: solo cambio el COLOR del label
  // "Normal", y el color no se sella. La etiqueta sellada no se movio.)
  classification: "cXXX-2026-08-29", // etiqueta interna de Atlas, no de Gildardo (ver comentario arriba)
  calibration: "ebbis-v5-provisional",
  // BUMP 2026-08-02 (mccb-1.0 -> mccb-2026-07-30, fechada al vigente): el re-sync unificó la frontera
  // de desnutrición del clasificador MCCB con el vigente (FMI H 3.5->3.0, FFMI H 17.92->17, M 15.64->15).
  // Un paciente en esas franjas cambia de banda -> su fenotipo MCCB sellado se movería; por eso sube.
  // NO sube `classification`: esos cortes viven en `computeNivelFMI/FFMI` (el MCCB), NO en los cXXX
  // (cIFC/cIRC/cFMI/cFFMI), que ya usaban los cortes del vigente; la clasificación de nueve estados y
  // los indicadores no se mueven. Con demo da igual; con reales, distingue emisiones antes/después.
  structural_mccb: "mccb-2026-07-30",
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
