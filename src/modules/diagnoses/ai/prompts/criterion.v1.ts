import type { AiMessage } from "@/lib/ai/provider";

import { CRITERION_SYSTEM_PROMPT } from "./criterion.system";

// Prompt VERSIONADO del borrador de criterio (regla dura 9). El texto de sistema canonico vive en
// criterion.system.ts (fuente unica). Desde /admin/ia el admin lo edita en BD; generate-criterion pasa
// esa version por systemText.
//
// LOS BIOMARCADORES NO VIAJAN AL MODELO (punto 9 de su cotejo, 2026-09-07). El campo `bio` de su tabla
// de estados EFR ("PCR↑, HOMA-IR↑, ferritina↑...") es una HIPOTESIS: que laboratorios pedir para ese
// fenotipo. Se lo mandabamos al modelo como `Biomarcadores asociados: ...`, sin ningun marco, y el
// modelo hizo lo previsible: escribio "hay evidencia de PCR elevada" sobre un paciente al que nadie le
// habia sacado sangre.
//
// EL CONTENIDO ES SUYO, el defecto era nuestro. Su propio archivo trae la frase literal
// (`bioP.push("PCR elevada, signos de sobrehidratacion")`) y la imprime en su resumen como
// "Biomarcadores clave A TENER EN CUENTA", que es el marco que la mantiene como hipotesis. Pero SU IA
// nunca recibe ese campo: su prompt manda el bloque DFI (los cinco dominios con severidad y evidencia)
// y los datos crudos. Textual suyo: el diagnostico por IA "estaba dirigido SOLO a la evidencia de los 5
// dominios del Diagnostico funcional".
//
// LA PANTALLA NO SE TOCA: la tarjeta "Biomarcadores clave" es porte fiel de su rotulo renderizado
// ("3. 🧪 Biomarcadores clave"). El profesional la lee sabiendo lo que es; el modelo no.
//
// AL PORTAR SU PROMPT DE CINCO DOMINIOS (punto 8), esta prohibicion tiene que ir DENTRO del texto de
// sistema: ese prompt manda datos crudos, y sin la regla escrita el modelo puede volver a nombrar un
// laboratorio. El candado de abajo (ai-criterion-prompt.test.ts) es lo que lo va a poner rojo.
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
  // NO HAY `biomarcadores`, y su ausencia es el arreglo del punto 9 de su cotejo (2026-09-07). Ver la
  // nota de arriba: el campo existe en el snapshot y se muestra en pantalla, pero NO viaja al modelo.
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
