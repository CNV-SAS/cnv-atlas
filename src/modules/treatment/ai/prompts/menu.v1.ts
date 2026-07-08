import type { AiMessage } from "@/lib/ai/provider";

// Prompt VERSIONADO de generacion de menu (regla dura 9: prompts nunca inline; versionados
// en modules/*/ai/prompts). Es la plantilla canonica en codigo; el override editable por
// admin (tabla ai_prompts, versionado con auditoria) llega en B14.
//
// BARRERA PII (regla dura 15 / DATA_GOVERNANCE): el contrato de entrada MenuPromptInput
// solo admite variables clinicas seudonimizadas y objetivos del protocolo. NO tiene campos
// de nombre, documento ni contacto: es imposible, por construccion, filtrar PII al LLM.
// Los objetivos (kcal, proteina, restricciones) los produce el generador de protocolo (B13);
// aqui vive solo la plantilla y su contrato. La generacion real se cablea en B13.

export const MENU_PROMPT_KEY = "menu.generate";
export const MENU_PROMPT_VERSION = 1;

export type MenuPromptInput = {
  kcalObjetivo: number;
  proteinaGramos: number;
  restricciones: string[]; // ej. "sin gluten", "vegetariano"
  fenotipoEstructural: string;
  sectorFuncional: string;
  rutasAtencion: string[];
};

export function buildMenuPrompt(input: MenuPromptInput): AiMessage[] {
  const system =
    "Eres un asistente de nutricion clinica. Generas una propuesta de menu diario a partir " +
    "de objetivos nutricionales dados. No diagnosticas ni interpretas: el diagnostico ya " +
    "esta hecho. Respetas estrictamente las restricciones alimentarias. Trabajas solo con " +
    "los datos entregados; nunca inventas informacion del paciente ni pides datos personales. " +
    "La sugerencia es un borrador para que un profesional la revise y decida.";

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
