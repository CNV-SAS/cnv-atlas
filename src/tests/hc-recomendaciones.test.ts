import { describe, expect, it } from "vitest";

import { recomendacionesDe } from "@/modules/reports/data/hc-recomendaciones";

// CANDADO DE LAS RECOMENDACIONES (bloque 11, 2026-08-24). La seccion es CONDICIONAL por diagnostico, no
// una lista fija: eso se descubrio leyendo el codigo detras de la captura, que solo mostraba el bloque
// generico porque el paciente demo no tenia comorbilidades.

const base = { diagnosticos: [] as string[], tieneHTA: false, tieneIRC: false, sarcopenia: false, exceso: false };
const titulos = (o: Partial<typeof base>) => recomendacionesDe({ ...base, ...o }).map((b) => b.titulo);

describe("recomendaciones de la historia clinica", () => {
  it("el bloque general va SIEMPRE, y al final, como en su archivo", () => {
    expect(titulos({})).toEqual(["Alimentación saludable general"]);
    expect(titulos({ tieneHTA: true }).at(-1)).toBe("Alimentación saludable general");
  });

  it("los tres portables salen con su contenido", () => {
    const r = recomendacionesDe({ ...base, diagnosticos: ["Diabetes tipo 2", "Dislipidemia (colesterol alto)"] });
    for (const b of r) {
      expect(b.pendiente ?? false, b.titulo).toBe(false);
      expect(b.items.length, b.titulo).toBeGreaterThan(0);
    }
    expect(r.map((b) => b.titulo)).toEqual([
      "Control glucémico",
      "Control de lípidos",
      "Alimentación saludable general",
    ]);
  });

  it("los cuatro bloqueados aparecen CON SU TITULO y marcados como pendientes", () => {
    // Sin esto la seccion pareceria completa cuando le falta algo que su archivo si tiene.
    const r = recomendacionesDe({ ...base, tieneHTA: true, tieneIRC: true, sarcopenia: true });
    const pend = r.filter((b) => b.pendiente).map((b) => b.titulo);
    expect(pend).toEqual([
      "Dieta DASH y control de sodio",
      "Nefroprotección (KDIGO 2024)",
      "Preservación de masa muscular",
    ]);
    for (const b of r.filter((x) => x.pendiente)) expect(b.items).toEqual([]);
  });

  it("el bloque de exceso de grasa NO sale si hay sarcopenia (su condicion es excluyente)", () => {
    expect(titulos({ exceso: true, sarcopenia: true })).not.toContain("Manejo del exceso de grasa corporal");
    expect(titulos({ exceso: true })).toContain("Manejo del exceso de grasa corporal");
  });

  it("un diagnostico que no activa nada deja solo el general", () => {
    expect(titulos({ diagnosticos: ["Otra: Rinitis crónica"] })).toEqual(["Alimentación saludable general"]);
  });

  it("los textos portables son los de su archivo, verbatim", () => {
    const gen = recomendacionesDe(base)[0];
    expect(gen.items).toEqual([
      "Hidratación de 30 a 35 mL/kg/día",
      "Frutas y verduras de varios colores en cada comida",
      "Preparaciones al vapor, al horno o a la plancha",
      "Planificar las compras según el plan",
      "Leer etiquetas (grasa saturada, azúcar, sodio)",
      "Distribuir las comidas cada 3 a 4 horas",
    ]);
  });
});
