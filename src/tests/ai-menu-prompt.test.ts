import { describe, expect, it } from "vitest";

import {
  buildMenuPrompt,
  MENU_PROMPT_KEY,
  MENU_PROMPT_VERSION,
  type MenuPromptInput,
} from "@/modules/treatment/ai/prompts/menu.v1";

// Smoke de la barrera PII de la IA (regla dura 15 / DATA_GOVERNANCE): el prompt del menu
// solo puede contener variables clinicas y objetivos, jamas PII. Como MenuPromptInput no
// tiene campos de nombre/documento/contacto, la barrera es estructural; este test la fija.

const input: MenuPromptInput = {
  kcalObjetivo: 1800,
  proteinaGramos: 120,
  restricciones: ["sin gluten", "vegetariano"],
  fenotipoEstructural: "Composicion equilibrada",
  sectorFuncional: "Funcion conservada",
  rutasAtencion: ["R2 - Reduccion Cardiometabolica"],
};

function rendered(): string {
  return buildMenuPrompt(input)
    .map((m) => m.content)
    .join("\n");
}

describe("buildMenuPrompt", () => {
  it("incluye los objetivos y variables clinicas", () => {
    const text = rendered();
    expect(text).toContain("1800");
    expect(text).toContain("120");
    expect(text).toContain("sin gluten");
    expect(text).toContain("Funcion conservada");
    expect(text).toContain("Composicion equilibrada");
  });

  it("no contiene NINGUNA PII (nombre, documento, correo, telefono)", () => {
    const text = rendered().toLowerCase();
    // Tokens tipicos de PII que NUNCA deben aparecer en un prompt del LLM.
    for (const pii of ["juan", "perez", "cedula", "documento", "correo", "telefono", "celular", "@", "cc "]) {
      expect(text, `el prompt no debe contener "${pii}"`).not.toContain(pii);
    }
  });

  it("expone clave y version del prompt (versionado, regla 9)", () => {
    expect(MENU_PROMPT_KEY).toBe("menu.generate");
    expect(MENU_PROMPT_VERSION).toBe(1);
  });
});
