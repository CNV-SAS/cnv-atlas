import type { AiMessage } from "@/lib/ai/provider";

import { MENU_SYSTEM_PROMPT } from "./menu.system";

// Prompt VERSIONADO de generacion de menu, v2 (regla dura 9). La v1 queda en menu.v1.ts, sin
// tocar: las sugerencias ya generadas dicen "menu.generate@...+u1" y su prompt exacto tiene que
// seguir siendo legible. Aqui NO se retira nada de la v1: se AGREGA el bloque que faltaba.
//
// QUE CAMBIA Y POR QUE (hueco clinico EN2, 2026-08-23). La v1 solo pasaba las restricciones del
// PROFESIONAL (el text[] que el escribe). Las del MODELO -proteina/fosforo/potasio por IRC, sodio
// por HTA, CHO simples por DM, AGS y ultraprocesados por fenotipo, cada una con su referencia- las
// calcula el motor y NO llegaban al generador. Efecto real: un paciente renal podia recibir un
// menu generado sin restriccion de fosforo ni de potasio, es decir un plan que contradice su propio
// diagnostico. El v8 hace lo contrario: su adaptacion de menu se guia EXCLUSIVAMENTE por las del
// modelo (ATLAS_v8.html:16633-16640).
//
// LOS DOS BLOQUES VAN SEPARADOS Y ROTULADOS, no fundidos en una lista: fundirlos perderia la
// referencia clinica y el caracter de NO NEGOCIABLE de las del modelo, que es justamente lo que las
// distingue de una preferencia del profesional.
//
// BARRERA PII (regla dura 15 / DATA_GOVERNANCE): el contrato de entrada sigue admitiendo SOLO
// variables clinicas y objetivos. Las restricciones del modelo son categorias clinicas con su
// referencia ({nombre, valor, ref}); no traen ni pueden traer identificadores. Solo el bloque de
// sistema es editable por el admin; el mensaje de usuario se arma SIEMPRE aqui, en codigo.

export const MENU_PROMPT_KEY = "menu.generate";
// Version del CONTRATO en codigo (el mensaje de usuario). Distinta de la version del texto de
// SISTEMA, que el admin edita en BD; la procedencia guardada registra las dos (generate-menu.ts).
export const MENU_PROMPT_VERSION = 2;
export { MENU_SYSTEM_PROMPT };

export type RestriccionModelo = { nombre: string; valor: string; ref: string };

export type MenuPromptInput = {
  kcalObjetivo: number;
  proteinaGramos: number;
  restriccionesModelo: RestriccionModelo[]; // del MOTOR, con referencia; no negociables
  restriccionesProfesional: string[]; // ej. "sin gluten", "vegetariano"
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

  const rutas = input.rutasAtencion.length ? input.rutasAtencion.join("; ") : "ninguna";
  const modelo = input.restriccionesModelo.length
    ? input.restriccionesModelo.map((r) => `- ${r.nombre}: ${r.valor} (${r.ref})`).join("\n")
    : "- ninguna";
  const profesional = input.restriccionesProfesional.length
    ? input.restriccionesProfesional.map((r) => `- ${r}`).join("\n")
    : "- ninguna";

  const user = [
    `Objetivo calorico: ${input.kcalObjetivo} kcal por dia.`,
    `Proteina objetivo: ${input.proteinaGramos} g por dia.`,
    `Fenotipo estructural: ${input.fenotipoEstructural}.`,
    `Sector funcional: ${input.sectorFuncional}.`,
    `Rutas de atencion priorizadas: ${rutas}.`,
    "",
    "RESTRICCIONES MEDICAS DEL MODELO (NO NEGOCIABLES). Salen del diagnostico por comorbilidad y " +
      "fenotipo, y cada una trae su referencia clinica. El menu DEBE cumplirlas: si un alimento " +
      "habitual las incumple, sustituyelo por otro equivalente que si las cumpla.",
    modelo,
    "",
    "RESTRICCIONES DEL PROFESIONAL (exclusiones y preferencias que agrego el nutricionista). " +
      "Respetalas tambien; si alguna choca con una restriccion medica, manda la medica.",
    profesional,
    "",
    "Genera un menu de un día (desayuno, media mañana, almuerzo, media tarde y cena) que " +
      "cumpla el objetivo calorico y de proteina, respete AMBOS bloques de restricciones y sea " +
      "coherente con el fenotipo. Indica porciones caseras aproximadas. Responde solo con el menu.",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
