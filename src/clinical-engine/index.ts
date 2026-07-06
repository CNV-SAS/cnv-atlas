// API publica del motor clinico (TS puro). El resto de la app consume runEngine y los
// tipos del contrato desde aqui; nunca toca los internos (adaptador, borde, ciencia
// congelada). B11: runEngine es el motor REAL portado de Gildardo (ver engine.ts); el
// stub quedo retirado.
export * from "./types";
export { ENGINE_VERSION } from "./version";
export { runEngine } from "./engine";
// Contrato de columnas del Biody (headers exactos) para que el pipeline reconstruya la
// fila cruda desde el almacenamiento normalizado de B8 (build-engine-input).
export { BIODY_COLUMNS, ENGINE_REQUIRED } from "./analysis";
