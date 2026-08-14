import type { AiMessage } from "@/lib/ai/provider";

import { CRITERION_SYSTEM_PROMPT } from "./criterion.system";

// Prompt VERSIONADO del borrador de criterio (regla dura 9). El texto de sistema canonico vive en
// criterion.system.ts (fuente unica). Desde /admin/ia el admin lo edita en BD; generate-criterion pasa
// esa version por systemText.
//
// BARRERA PII (regla dura 15 / DATA_GOVERNANCE): el contrato CriterionPromptInput solo admite variables
// clinicas del snapshot (estado EFR, fenotipos, indicadores, dominios). NO tiene campos de nombre,
// documento, fecha ni contacto: es imposible por construccion filtrar PII al LLM. Solo el bloque de
// sistema es editable; el mensaje de usuario se arma SIEMPRE aqui en codigo, asi la edicion del prompt
// nunca puede inyectar PII.

export const CRITERION_PROMPT_KEY = "criterio.generate";
export const CRITERION_PROMPT_VERSION = 1;
export { CRITERION_SYSTEM_PROMPT };

export type CriterionPromptInput = {
  estadoEfr: string;
  mecanismo: string | null;
  biomarcadores: string | null;
  riesgos: string | null;
  fenotipoEstructural: string;
  sectorFuncional: string;
  indicadoresAlterados: { nombre: string; nivel: string }[];
  dominios: { nombre: string; nivel: string }[];
  riesgoIntegrado: string;
  rutas: string[];
};

// systemText inyecta la version activa del prompt en BD; por defecto el texto canonico. El mensaje de
// usuario NO es parametrizable: se arma aqui siempre (barrera PII).
export function buildCriterionPrompt(
  input: CriterionPromptInput,
  systemText: string = CRITERION_SYSTEM_PROMPT,
): AiMessage[] {
  const inds = input.indicadoresAlterados.length
    ? input.indicadoresAlterados.map((i) => `${i.nombre} (${i.nivel})`).join(", ")
    : "ninguno alterado";
  const doms = input.dominios.length
    ? input.dominios.map((d) => `${d.nombre} (${d.nivel})`).join(", ")
    : "sin dominios destacados";
  const rutas = input.rutas.length ? input.rutas.join("; ") : "ninguna priorizada";

  const user = [
    `Estado EFR: ${input.estadoEfr}.`,
    `Fenotipo estructural: ${input.fenotipoEstructural}. Sector funcional: ${input.sectorFuncional}.`,
    `Mecanismo del estado: ${input.mecanismo ?? "no disponible"}`,
    `Biomarcadores asociados: ${input.biomarcadores ?? "no disponible"}`,
    `Riesgos del estado: ${input.riesgos ?? "no disponible"}`,
    `Indicadores alterados: ${inds}.`,
    `Dominios de riesgo (encuesta): ${doms}.`,
    `Riesgo integrado: ${input.riesgoIntegrado}.`,
    `Rutas de atención priorizadas: ${rutas}.`,
    "",
    "Redacta el borrador del criterio clínico según las reglas.",
  ].join("\n");

  return [
    { role: "system", content: systemText },
    { role: "user", content: user },
  ];
}
