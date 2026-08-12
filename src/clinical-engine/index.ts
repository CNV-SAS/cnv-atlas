// API publica del motor clinico (TS puro). El resto de la app consume runEngine y los
// tipos del contrato desde aqui; nunca toca los internos (adaptador, borde, ciencia
// congelada). B11: runEngine es el motor REAL portado de Gildardo (ver engine.ts); el
// stub quedo retirado.
export * from "./types";
export { ENGINE_VERSION, PROTOCOL_ENGINE_VERSION } from "./version";
export { runEngine } from "./engine";
// Suspension de rutas por encuesta incompleta (Q28): la glue la aplica al sellar; el render la reaplica
// (idempotente) sobre snapshots viejos ya sellados incompletos.
export { suspendSurveyRoutes, isBisDerivedRoute, isBisDerivedDomain } from "./dfi-routes";
// Orquestador del protocolo (T2 A3): encadena los tres motores y arma el protocol_suggested; y el
// computo del set EFECTIVO al aprobar (aplica los adj_* sobre los inputs sellados del sugerido).
export {
  computeProtocolo,
  computeProtocoloEfectivo,
  type ProtocoloAjustes,
  type ProtocoloEfectivo,
  type ProtocoloSnapshot,
} from "./protocolo";
// Contrato de columnas del Biody (headers exactos) para que el pipeline reconstruya la
// fila cruda desde el almacenamiento normalizado de B8 (build-engine-input).
export { BIODY_COLUMNS, ENGINE_REQUIRED } from "./analysis";
// Peso meta y su default (Lorentz), hecho VISIBLE (nota 3 de Gildardo): un peso meta no fijado cambia
// la prescripcion en silencio. Ver peso-meta.ts.
export { pesoIdealLorentz, pesoMetaDefault, type PesoMetaDefault } from "./peso-meta";
// Severidad de riesgo por indicador (recomputada del snapshot) para la capa de color de BRAND.
export { indicatorSeverities } from "./severity";
// Abordaje por profesion (6ª card del estado EFR): ORIENTACION que se COMPUTA en tiempo de vista
// (clave EFR sellada + profesion del que mira), no se sella. Ver el criterio en abordaje.ts.
export { abordajeProfesional } from "./abordaje";
// Patron alimentario (C9): reader que resuelve las respuestas de encuesta al enc de calcPatron y
// devuelve un estado (no_capturado/sin_respuestas/ilegible/ok). DISPLAY compute-at-view-time, no se
// sella; no alimenta el diagnostico mientras C1 siga apagado. Ver patron.ts.
export { resolvePatron, PATRON_FIELD_KEYS, type PatronResolution, type PatronAnswer, type PatronGrupoView } from "./patron";
export type { PatronResult, PatronCat, PatronGroup } from "./frozen/engine.patron.js";
export { FREQ_GROUPS, catLabel, catColor } from "./frozen/engine.patron.js";
// Normalizador canonico de sexo (M/F, fail-loud): el MISMO borde que usa el motor. La UI lo reusa
// para no comparar sexo crudo (Biody exporta "Male", el motor clasifica con "M/Masculino").
export { normalizeSexo } from "./edge/normalize";
