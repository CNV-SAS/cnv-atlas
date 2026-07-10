import type { AiMessage } from "@/lib/ai/provider";

import { MENU_SYSTEM_PROMPT } from "./menu.system";

// Prompt VERSIONADO de generacion de menu (regla dura 9: prompts nunca inline; versionados
// en modules/*/ai/prompts). El texto de sistema canonico vive en menu.system.ts (fuente
// unica, sembrada como ai_prompts v1). Desde B14 el admin lo edita creando versiones nuevas
// en BD; generate-menu prefiere la version activa de BD y pasa ese texto por systemText.
//
// BARRERA PII (regla dura 15 / DATA_GOVERNANCE): el contrato de entrada MenuPromptInput
// solo admite variables clinicas seudonimizadas y objetivos del protocolo. NO tiene campos
// de nombre, documento ni contacto: es imposible, por construccion, filtrar PII al LLM. Solo
// el bloque de sistema es editable; el mensaje de usuario (los objetivos) se arma SIEMPRE
// aqui en codigo, asi la edicion del prompt nunca puede inyectar PII.

export const MENU_PROMPT_KEY = "menu.generate";
export const MENU_PROMPT_VERSION = 1;
export { MENU_SYSTEM_PROMPT };

export type MenuPromptInput = {
  kcalObjetivo: number;
  proteinaGramos: number;
  restricciones: string[]; // ej. "sin gluten", "vegetariano"
  fenotipoEstructural: string;
  sectorFuncional: string;
  rutasAtencion: string[];
};

// systemText permite inyectar la version activa del prompt en BD (B14); por defecto usa el
// texto canonico en codigo. El mensaje de usuario NO es parametrizable: se arma aqui siempre.
export function buildMenuPrompt(
  input: MenuPromptInput,
  systemText: string = MENU_SYSTEM_PROMPT,
): AiMessage[] {
  const system = systemText;

  const restr = input.restricciones.length ? input.restricciones.join(", ") : "ninguna";
  const rutas = input.rutasAtencion.length ? input.rutasAtencion.join("; ") : "ninguna";

  const user = [
    `Objetivo calorico: ${input.kcalObjetivo} kcal por dia.`,
    `Proteina objetivo: ${input.proteinaGramos} g por dia.`,
    `Restricciones alimentarias: ${restr}.`,
    `Fenotipo estructural: ${input.fenotipoEstructural}.`,
    `Sector funcional: ${input.sectorFuncional}.`,
    `Rutas de atencion priorizadas: ${rutas}.`,
    "",
    "Genera un menu de un dia (desayuno, media manana, almuerzo, media tarde y cena) que " +
      "cumpla el objetivo calorico y de proteina, respete las restricciones y sea coherente " +
      "con el fenotipo. Indica porciones caseras aproximadas. Responde solo con el menu.",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
