import promptV1 from "./criterion.system.v1.json";

// Texto CANONICO de las instrucciones de sistema del borrador de criterio (criterio.generate v1). La
// fuente unica es el JSON committeado: lo importa el builder (via este modulo) y el seed lo lee por fs
// (el seed no puede importar TS con alias @/). El admin lo edita creando versiones nuevas en BD desde
// /admin/ia; desde la v1 sembrada, la BD manda.
//
// Diseño (aprobado 2026-08-14): el texto NO diagnostica (el motor ya lo hizo, es inmutable); INTERPRETA
// la evidencia en prosa para que el profesional PARTA de ahi y escriba SU criterio. Abre en "los
// indicadores son compatibles con...", NO en "el paciente presenta...", que se leeria como re-diagnostico.
//
// BARRERA PII (regla dura 15): esto es SOLO el bloque de instrucciones. El mensaje de usuario con las
// variables clinicas se arma en codigo (criterion.v1.ts) y NO es editable, para que sea imposible por
// construccion inyectar PII al LLM desde la edicion del prompt.
export const CRITERION_SYSTEM_PROMPT: string = promptV1.system;
