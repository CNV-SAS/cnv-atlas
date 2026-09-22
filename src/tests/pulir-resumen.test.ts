import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { buildCriterionPrompt, CRITERION_SYSTEM_PROMPT } from "@/modules/diagnoses/ai/prompts/criterion.v2";
import { formasProhibidas, pulirResumen } from "@/modules/diagnoses/services/pulir-resumen";

import { sinComentarios } from "./helpers/sin-comentarios";

vi.mock("server-only", () => ({}));

// ═══ EL PASO DETERMINISTA DEL RESUMEN (2026-09-22) ═══
// Frases reales de la prueba de Santiago con Gemini (v13), que rompian reglas que el prompt ya tenia.

describe("pulir: lo que se arregla sin cambiar el sentido", () => {
  it("quita las comillas de las respuestas", () => {
    expect(pulirResumen('se siente "muy insatisfecho/a" con su peso y refiere perder el control al comer "Siempre"')).toBe(
      "se siente muy insatisfecho/a con su peso y refiere perder el control al comer Siempre",
    );
    expect(pulirResumen("preparada en “Restaurante o fonda”, come fuera «Todos los días»")).toBe(
      "preparada en Restaurante o fonda, come fuera Todos los días",
    );
  });

  it("quita la cadena interna de la PABU", () => {
    expect(pulirResumen("La PABU de 1,2 k=0,78 (H) muestra una desviación por exceso")).toBe(
      "La PABU de 1,2 muestra una desviación por exceso",
    );
    expect(pulirResumen("PABU 1,05 (k = 0.72 (M)) por debajo de φ")).toBe("PABU 1,05 por debajo de φ");
  });

  it("y no toca ninguna palabra", () => {
    const limpio = "El IFC es 6,98 (Alto) y el IRC 1,62 (Bajo).";
    expect(pulirResumen(limpio)).toBe(limpio);
  });
});

describe("detectar: lo que no se borra, se avisa", () => {
  it("encuentra las formas de hipótesis y de recomendación, por palabra completa", () => {
    expect(
      formasProhibidas(
        "lo que sugiere una posible disociación entre los indicadores; requiere atención a largo plazo",
      ),
    ).toEqual(["sugiere", "posible", "a largo plazo", "requiere atención"]);
    // "imposible" no es "posible".
    expect(formasProhibidas("Es imposible afirmarlo con estos datos.")).toEqual([]);
  });

  it("el servicio regenera una vez si el primero trae alguna, y guarda la medida", () => {
    const S = sinComentarios(readFileSync("src/modules/diagnoses/services/generate-criterion.ts", "utf8"));
    expect(S).toContain("if (formasDelPrimero.length > 0) {");
    expect(S.match(/await generateText\(messages, config\)/g)).toHaveLength(2);
    expect(S).toContain("pulirResumen(limpiarMarcadores(completion.text))");
    expect(S).toContain("formas_prohibidas_final: formasFinales");
  });

  it("y la pantalla avisa al profesional si quedaron", () => {
    const pantalla = readFileSync("src/modules/diagnoses/components/resumen-diagnostico.tsx", "utf8");
    expect(pantalla).toContain("formasProhibidas(visible).length > 0");
    expect(pantalla).toContain("Léelo con cuidado o vuelve a generarlo");
  });
});

// ═══ LA REGLA DEL IFC SOBRE EL AF, SOLO CUANDO DISCREPAN (v14) ═══
describe("la regla del IFC sobre el AF", () => {
  it("ya no va en el texto fijo del sistema", () => {
    expect(CRITERION_SYSTEM_PROMPT).not.toContain("Si el IFC y el ángulo de fase discrepan");
  });

  it("discrepan con los colores de sus clasificadores, y el ámbar no discrepa", async () => {
    const { ifcYAfDiscrepan } = await import("@/modules/diagnoses/data/criterion-input-reader");
    expect(ifcYAfDiscrepan("Función óptima", "Normal")).toBe(false); // el caso de la prueba: AF 6,7 Normal
    expect(ifcYAfDiscrepan("Función óptima", "Bajo")).toBe(true);
    expect(ifcYAfDiscrepan("Disfunción celular", "Alto")).toBe(true);
    expect(ifcYAfDiscrepan("Alerta funcional", "Bajo")).toBe(false);
    expect(ifcYAfDiscrepan("Función óptima", null)).toBe(false);
  });

  it("llega en los datos solo cuando discrepan", () => {
    const base = {
      sexo: "Masculino",
      alertas: [],
      respuestasEnRojo: [],
      direccionPabu: null,
      edad: 30,
      ocupacion: null,
      estadoCivil: null,
      estrato: null,
      peso: null,
      talla: null,
      cintura: null,
      cadera: null,
      riesgoIntegrado: "Bajo",
      riesgoScore: 10,
      riesgoDescripcion: null,
      dominios: [],
      veto: false,
      rutas: [],
      encuesta: [],
      composicion: [],
      estadoEfr: "",
      fenotipoEstructural: "",
      fenotipoMccb: null,
      sectorFuncional: "",
      mecanismo: null,
      riesgos: null,
      indicadores: [],
      cortes: [],
    } as Parameters<typeof buildCriterionPrompt>[0];
    const usuario = (i: Parameters<typeof buildCriterionPrompt>[0]) => buildCriterionPrompt(i)[1].content;
    expect(usuario({ ...base, ifcYAfDiscrepan: false })).not.toContain("prevalece el IFC");
    expect(usuario({ ...base, ifcYAfDiscrepan: true })).toContain(
      "EL IFC Y EL ÁNGULO DE FASE DISCREPAN EN ESTE PACIENTE. Si el IFC y el ángulo de fase discrepan, prevalece el IFC",
    );
  });
});
