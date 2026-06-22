// API publica del motor clinico (TS puro). El resto de la app consume runEngine y los
// tipos del contrato desde aqui; nunca toca los internos. Hoy runEngine es el stub
// (ver stub.ts); en B11 se cambia por el motor real portado, sin tocar a los
// consumidores (misma firma).
export * from "./types";
export { ENGINE_VERSION } from "./version";
export { runEngine } from "./stub";
