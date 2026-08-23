import { describe, expect, it } from "vitest";

import {
  buildMenuPrompt,
  MENU_PROMPT_KEY,
  MENU_PROMPT_VERSION,
  type MenuPromptInput,
} from "@/modules/treatment/ai/prompts/menu.v2";

// CANDADO DE LA v2 DEL PROMPT DE MENU (hueco clinico EN2, 2026-08-23). Lo que se blinda no es la
// redaccion, es la SEPARACION: las restricciones del MODELO (salida del motor, con referencia
// clinica, no negociables) y las del PROFESIONAL (aditivas) llegan al LLM en DOS bloques rotulados.
// Si alguien las funde en una lista "para simplificar", el menu pierde la referencia y el caracter
// no negociable de las medicas, que es justo lo que las distingue de una preferencia. Antes de la
// v2 las del modelo NO llegaban: un paciente renal podia recibir un menu sin restriccion de fosforo
// ni de potasio (un plan que contradice su propio diagnostico).

const input: MenuPromptInput = {
  kcalObjetivo: 1800,
  proteinaGramos: 120,
  restriccionesModelo: [
    { nombre: "Proteína", valor: "0.6–0.8 g/kg", ref: "KDIGO 2024" },
    { nombre: "Fósforo", valor: "< 800 mg/día", ref: "KDIGO 2024" },
    { nombre: "Potasio", valor: "< 2000 mg/día", ref: "KDIGO 2024" },
  ],
  restriccionesProfesional: ["sin gluten", "vegetariano"],
  fenotipoEstructural: "Composicion equilibrada",
  sectorFuncional: "Funcion conservada",
  rutasAtencion: ["R2 - Reduccion Cardiometabolica"],
};

function rendered(i: MenuPromptInput = input): string {
  return buildMenuPrompt(i)
    .map((m) => m.content)
    .join("\n");
}

describe("buildMenuPrompt v2", () => {
  it("incluye los objetivos y variables clinicas", () => {
    const text = rendered();
    expect(text).toContain("1800");
    expect(text).toContain("120");
    expect(text).toContain("Funcion conservada");
    expect(text).toContain("Composicion equilibrada");
  });

  it("lleva las restricciones del MODELO con su valor y su referencia", () => {
    const text = rendered();
    expect(text).toContain("Fósforo: < 800 mg/día (KDIGO 2024)");
    expect(text).toContain("Potasio: < 2000 mg/día (KDIGO 2024)");
    expect(text).toContain("Proteína: 0.6–0.8 g/kg (KDIGO 2024)");
  });

  it("mantiene los DOS bloques separados y rotulados, y las del modelo como no negociables", () => {
    const text = rendered();
    const iModelo = text.indexOf("RESTRICCIONES MEDICAS DEL MODELO");
    const iProf = text.indexOf("RESTRICCIONES DEL PROFESIONAL");
    expect(iModelo).toBeGreaterThan(-1);
    expect(iProf).toBeGreaterThan(iModelo); // el modelo va PRIMERO: es lo no negociable
    expect(text).toContain("NO NEGOCIABLES");
    // Las del profesional no se cuelan dentro del bloque del modelo.
    expect(text.slice(iModelo, iProf)).not.toContain("sin gluten");
    // Y ante choque, manda la medica: dicho explicito, no implicito.
    expect(text.toLowerCase()).toContain("manda la medica");
  });

  it("conserva los dos rotulos aunque una lista venga vacia (la distincion no depende del contenido)", () => {
    const text = rendered({ ...input, restriccionesModelo: [], restriccionesProfesional: [] });
    expect(text).toContain("RESTRICCIONES MEDICAS DEL MODELO");
    expect(text).toContain("RESTRICCIONES DEL PROFESIONAL");
    expect(text).toContain("- ninguna");
  });

  it("no contiene NINGUNA PII (nombre, documento, correo, telefono)", () => {
    // La barrera sigue siendo ESTRUCTURAL: MenuPromptInput no tiene campos de identidad. Las
    // restricciones del modelo son categorias clinicas con referencia; no pueden traer identificadores.
    const text = rendered().toLowerCase();
    for (const pii of ["juan", "perez", "cedula", "documento", "correo", "telefono", "celular", "@", "cc "]) {
      expect(text, `el prompt no debe contener "${pii}"`).not.toContain(pii);
    }
  });

  it("expone clave y version del contrato (versionado, regla 9)", () => {
    expect(MENU_PROMPT_KEY).toBe("menu.generate");
    expect(MENU_PROMPT_VERSION).toBe(2);
  });
});
