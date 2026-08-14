import { describe, expect, it } from "vitest";

import {
  buildCriterionPrompt,
  CRITERION_PROMPT_KEY,
  CRITERION_PROMPT_VERSION,
  type CriterionPromptInput,
} from "@/modules/diagnoses/ai/prompts/criterion.v1";

// Smoke de la barrera PII de la IA (regla dura 15 / DATA_GOVERNANCE): el prompt del borrador de criterio
// solo puede contener variables clinicas del snapshot, jamas PII. Como CriterionPromptInput no tiene
// campos de nombre/documento/contacto, la barrera es estructural; este test la fija.

const input: CriterionPromptInput = {
  estadoEfr: "Adiposopatia funcional con reserva muscular conservada",
  mecanismo: "Exceso de masa grasa con distribucion central que compromete la sensibilidad a la insulina.",
  biomarcadores: "Angulo de fase conservado, agua intracelular en rango.",
  riesgos: "Progresion a resistencia insulinica si persiste el balance calorico positivo.",
  fenotipoEstructural: "Sobrepeso con masa muscular adecuada",
  sectorFuncional: "Riesgo cardiometabolico moderado",
  indicadoresAlterados: [
    { nombre: "Indice de fluidos corporales", nivel: "elevado" },
    { nombre: "Fat Mass Index", nivel: "elevado" },
  ],
  dominios: [
    { nombre: "Patron alimentario", nivel: "alerta" },
    { nombre: "Actividad fisica", nivel: "critico" },
  ],
  riesgoIntegrado: "Moderado (score 42)",
  rutas: ["Ruta metabolica"],
};

function rendered(): string {
  return buildCriterionPrompt(input)
    .map((m) => m.content)
    .join("\n");
}

describe("buildCriterionPrompt", () => {
  it("incluye las variables clinicas del snapshot", () => {
    const text = rendered();
    expect(text).toContain("Adiposopatia funcional con reserva muscular conservada");
    expect(text).toContain("Sobrepeso con masa muscular adecuada");
    expect(text).toContain("Indice de fluidos corporales (elevado)");
    expect(text).toContain("Patron alimentario (alerta)");
    expect(text).toContain("Ruta metabolica");
  });

  it("no contiene NINGUNA PII (nombre, documento, correo, telefono)", () => {
    const text = rendered().toLowerCase();
    // Substring simple para tokens sin colision. "@" cubre correos.
    for (const pii of ["juan", "perez", "cedula", "correo", "telefono", "@"]) {
      expect(text, `el prompt no debe contener "${pii}"`).not.toContain(pii);
    }
    // "celular" va con limite de palabra: como substring colisiona con terminos clinicos legitimos
    // ("agua intracelular/extracelular"), que SI aparecen en biomarcadores. La PII de contacto se
    // descarta por construccion (el contrato no tiene campo de telefono), esto es solo el smoke.
    expect(text, "el prompt no debe contener 'celular' como palabra").not.toMatch(/\bcelular\b/);
  });

  it("maneja campos ausentes sin romper (efrContent nulo en snapshots viejos)", () => {
    const text = buildCriterionPrompt({ ...input, mecanismo: null, biomarcadores: null, riesgos: null })
      .map((m) => m.content)
      .join("\n");
    expect(text).toContain("no disponible");
  });

  it("expone clave y version del prompt (versionado, regla 9)", () => {
    expect(CRITERION_PROMPT_KEY).toBe("criterio.generate");
    expect(CRITERION_PROMPT_VERSION).toBe(1);
  });
});
