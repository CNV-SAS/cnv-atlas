import { describe, expect, it } from "vitest";

import { type EngineInput, indicatorSeverities, runEngine } from "@/clinical-engine";
import { colorSev } from "@/clinical-engine/severity";

import biody from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";

// La severidad por indicador para el punto de color de BRAND se recomputa del snapshot con los
// clasificadores congelados y se bucketiza su color. Este test ancla el heuristico de color
// contra la PALETA REAL del frozen: si una entrega futura cambia un hex a un tono que caiga en
// otro bucket, aqui se detecta (no en la vista, en silencio).

describe("colorSev (bucket del color del clasificador congelado)", () => {
  it("verdes -> optimo (0)", () => {
    for (const c of ["#1a7a4a", "#16a34a", "#10b981", "#4caf50", "#0d5c36"]) {
      expect(colorSev(c)).toBe(0);
    }
  });
  it("ambar/naranja -> alerta (2)", () => {
    for (const c of ["#e6a817", "#f59e0b", "#ea580c"]) expect(colorSev(c)).toBe(2);
  });
  it("rojos -> critico (3)", () => {
    for (const c of ["#c0392b", "#dc2626", "#ef4444", "#e74c3c", "#7b0000"]) {
      expect(colorSev(c)).toBe(3);
    }
  });
  it("gris/desaturado e invalidos -> sin color (null)", () => {
    expect(colorSev("#94a3b8")).toBeNull();
    expect(colorSev("")).toBeNull();
    expect(colorSev(undefined)).toBeNull();
  });
});

describe("indicatorSeverities (del snapshot real)", () => {
  it("devuelve buckets validos y colorea segun el veredicto del clasificador", () => {
    const input: EngineInput = {
      sexo: "M",
      edad: 54,
      bisRow: biody as Record<string, unknown>,
      survey: {},
      model: { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" },
    };
    const out = runEngine(input);
    const sev = indicatorSeverities(out);
    // Todo valor es un bucket clinico valido o null.
    for (const v of Object.values(sev)) expect([0, 2, 3, null]).toContain(v);
    // IFC y IRC del gold clasifican en alerta (ambar) -> bucket 2, coherente con sus etiquetas.
    expect(out.classifications.IFC?.label).toBe("Alerta funcional");
    expect(sev.IFC).toBe(2);
    expect(out.classifications.IRC?.label).toBe("Riesgo moderado");
    expect(sev.IRC).toBe(2);
  });
});
