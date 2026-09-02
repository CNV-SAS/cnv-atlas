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

  it("TRES de los cuatro dejaron de estar pendientes al conectar el motor (2026-08-31)", () => {
    // Este test decia "los cuatro bloqueados aparecen con su titulo y marcados como pendientes", y se
    // INVIERTE porque el motor que produce sus cifras se conecto: DASH, nefroproteccion y masa muscular
    // solo necesitaban `sodioMax` y `protKg/protG`. Se conserva la asercion de fondo (la seccion no puede
    // parecer completa cuando falta algo), aplicada a lo que de verdad falta.
    const r = recomendacionesDe({
      ...base,
      tieneHTA: true,
      tieneIRC: true,
      sarcopenia: true,
      sodioMax: 1500,
      protKg: 0.7,
      protG: 49,
    });
    expect(r.filter((b) => b.pendiente)).toEqual([]);
    const dash = r.find((b) => b.titulo === "Dieta DASH y control de sodio");
    expect(dash?.items[0]).toBe("Limitar sodio a <1.500 mg/día");
    const nefro = r.find((b) => b.titulo === "Nefroprotección (KDIGO 2024)");
    expect(nefro?.items[0]).toBe("Proteína 0,7 g/kg/día (49 g) en ERC sin diálisis");
  });

  it("y SIN las cifras vuelven a marcarse pendientes, en vez de imprimir un valor inventado", () => {
    // Es la mitad que protege el documento clinico: si el motor no pudo correr (evaluacion sin encuesta
    // legible), un default pondria una cifra que nadie prescribio en la historia del paciente.
    const r = recomendacionesDe({ ...base, tieneIRC: true, sarcopenia: true });
    const pend = r.filter((b) => b.pendiente).map((b) => b.titulo);
    expect(pend).toEqual(["Nefroprotección (KDIGO 2024)", "Preservación de masa muscular"]);
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

// ── LA HIDRATACIÓN, TRADUCIDA A LO QUE LA PERSONA USA ───────────────────────────────────────────────
//
// DECISIÓN DECLARADA EN LA RONDA DEL 2026-09-01 y que llevaba un día sin aplicar: multiplicar su cifra por
// el peso y dividirla por un vaso es **aritmética sobre su cifra, no una cifra nueva**, que es la línea
// que separa lo que podemos hacer de lo que no. Lo que NO se puede es cambiar el número: si dice 30-35
// mL/kg, no se redondea a "2 litros".
describe("hidratación: los mL se quedan, y al lado va lo que la persona usa", () => {
  const general = (pesoKg: number | null) =>
    recomendacionesDe({
      diagnosticos: [],
      tieneHTA: false,
      tieneIRC: false,
      sarcopenia: false,
      exceso: false,
      pesoKg,
    }).find((b) => b.titulo === "Alimentación saludable general");

  it("SU CIFRA SE CONSERVA ENTERA Y PRIMERO", () => {
    // Lo que no se puede tocar. Si algún día la traducción reemplazara la cifra por kilo, este caso truena.
    const hidr = general(80)?.items[0] ?? "";
    expect(hidr.startsWith("Hidratación de 30 a 35 mL/kg/día")).toBe(true);
  });

  it("y al lado van los litros y los vasos de ESE paciente", () => {
    // 80 kg → 2.400 a 2.800 mL → 12 a 14 vasos de 200 mL (la unidad que él fijó para el agua).
    const hidr = general(80)?.items[0] ?? "";
    expect(hidr).toContain("2,4 a 2,8 litros");
    expect(hidr).toContain("12 a 14 vasos");
  });

  it("SIN PESO no se traduce: la cifra por kilo se queda sola", () => {
    // Inventar un peso para poder mostrar un número redondo sería prescribir sobre un dato que no existe.
    expect(general(null)?.items[0]).toBe("Hidratación de 30 a 35 mL/kg/día");
    expect(general(0)?.items[0]).toBe("Hidratación de 30 a 35 mL/kg/día");
  });

  it("y el resto del bloque general no se toca", () => {
    // CONTROL: sin esto, un cambio que se llevara por delante los otros cinco ítems pasaría verde.
    const items = general(80)?.items ?? [];
    expect(items).toHaveLength(6);
    expect(items[1]).toBe("Frutas y verduras de varios colores en cada comida");
  });
});
