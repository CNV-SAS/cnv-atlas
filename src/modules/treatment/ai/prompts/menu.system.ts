import promptV1 from "./menu.system.v1.json";

// Texto CANONICO de las instrucciones de sistema del prompt de menu (menu.generate v1). La
// fuente unica es el JSON committeado: lo importa el builder del prompt (via este modulo) y
// el seed lo lee por fs (el seed no puede importar TS con alias @/, ni con extension .ts sin
// romper tsc). El admin lo edita creando versiones nuevas en BD (B14); desde la v1 sembrada,
// la BD manda.
//
// BARRERA PII (regla dura 15): esto es SOLO el bloque de instrucciones. El mensaje de usuario
// con los objetivos del paciente se arma en codigo (menu.v1.ts) y NO es editable, para que
// sea imposible por construccion inyectar PII al LLM desde la edicion del prompt.
export const MENU_SYSTEM_PROMPT: string = promptV1.system;
