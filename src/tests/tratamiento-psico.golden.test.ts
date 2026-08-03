import { describe, expect, it } from "vitest";

import { motorTratPsico } from "@/clinical-engine/frozen/atlas-tratamiento.js";

// Golden del motor psicologico (D-008). Prueba COMPORTAMIENTO (no fidelidad: eso lo prueba el DIFF):
// pin de las tres ramas clinicas del motor con casos del donante. Toda la salida es profesional-facing.

describe("golden motorTratPsico", () => {
  it("SCOFF positivo por conducta de riesgo -> tcaFlag, remision y salvaguarda activas", () => {
    const r = motorTratPsico({ d2_21: ["Vómito"], d3_29: 9 }, {});
    expect(r.tcaFlag).toBe(true);
    expect(r.tamizaje[0].res).toMatch(/POSITIVO/);
    expect(r.remision).toContain("Remitir a psicología clínica o psiquiatría (sospecha de TCA)");
    // estres 9 (>=8) agrega la segunda remision
    expect(r.remision).toContain("Valorar apoyo por estrés elevado");
    expect(r.salvaguarda).toMatch(/Salvaguarda activa/);
    expect(r.estres).toBe(9);
  });

  it("sin conducta de riesgo pero control + insatisfaccion -> tcaFlag por la via ampliada", () => {
    const r = motorTratPsico({ d2_22: "Frecuentemente", d2_20: "Muy insatisfecho/a" }, {});
    expect(r.tcaFlag).toBe(true); // scoff=false, pero control && insat
    expect(r.tamizaje[0].res).toMatch(/Sin banderas/);
    expect(r.salvaguarda).toMatch(/Salvaguarda activa/);
  });

  it("sin banderas -> tcaFlag falso, sin remision ni salvaguarda", () => {
    const r = motorTratPsico({}, {});
    expect(r.tcaFlag).toBe(false);
    expect(r.remision).toEqual([]);
    expect(r.salvaguarda).toBeNull();
    expect(r.estres).toBe(0);
    // PHQ-9 y GAD-7 quedan para aplicar en consulta (el sistema no los computa)
    expect(r.tamizaje.map((t: { inst: string }) => t.inst).join(" ")).toMatch(/PHQ-9.*GAD-7/);
  });
});
