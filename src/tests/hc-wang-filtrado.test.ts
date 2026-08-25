import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

// CANDADO DEL BLOQUE 4 DE LA HISTORIA CLINICA (2026-08-24).
//
// El hallazgo que lo motiva: la tabla de Wang de su HC NO es una tabla mas corta, es LA MISMA filtrada a
// los indices alterados (su comentario: "mostrar items alterados; ocultar solo los normales y sin
// clasificacion"). Se porta como PROP del componente existente y no como componente aparte, para que no
// puedan divergir: si manana se agrega una fila al Diagnostico, la historia clinica la hereda.

const SRC = readFileSync("src/modules/diagnoses/components/composition-section.tsx", "utf8");
const PAGE = readFileSync("src/app/(app)/evaluaciones/[id]/page.tsx", "utf8");

describe("tabla de Wang de la historia clinica", () => {
  it("es el MISMO componente con una prop, no una tabla aparte", () => {
    expect(SRC).toContain("soloAlterados");
    expect(PAGE).toContain("soloAlterados");
  });

  it("el umbral es sev >= 1: 0 es el unico nivel optimo de esta escala", () => {
    expect(SRC).toMatch(/dxDeFila\(r\)\?\.sev \?\? 0\) >= 1/);
  });

  it("un nivel que se queda sin filas no se pinta vacio", () => {
    expect(SRC).toMatch(/\.filter\(\(l\) => l\.rows\.length > 0\)/);
  });

  it("si NADA esta alterado se dice, en vez de dejar la tabla vacia", () => {
    // Una tabla vacia se lee como dato faltante, no como "todo en rango".
    expect(SRC).toContain("Sin índices alterados");
  });

  it("el Diagnostico NO se filtra: alli se muestra todo", () => {
    // La prop es opt-in y su default es false; si se invirtiera, el Diagnostico perderia filas.
    expect(SRC).toContain("soloAlterados = false");
  });

  it("la HC dice que los rangos son los VIGENTES, no los del dia de la consulta", () => {
    // Decision C: marcar en vez de sellar, porque marcar cubre tambien los reportes ya emitidos.
    expect(PAGE).toContain("Los valores son los de esta evaluación");
    expect(PAGE).toContain("del modelo\n                    vigente hoy");
  });
});
