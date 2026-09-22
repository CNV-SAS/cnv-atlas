import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { accionDeEvaluacion } from "@/modules/patients/pendientes";

// ═══ LA CONSULTA IMPORTADA DEL HTML (2026-09-22) ═══
// Llega con su medicion y sin condiciones. "Montar BIS" seria mentir y "Generar diagnostico" manda a un boton
// que va a rebotar: lo que falta son las condiciones de la toma.
describe("la consulta importada del HTML", () => {
  const base = { evaluationId: "e1", status: "in_progress", tieneBis: true, tieneDiagnostico: false, reporte: null };

  it("dice que falta registrar las condiciones, y que vino del HTML", () => {
    expect(accionDeEvaluacion({ ...base, importada: true, tieneCondicionesBis: false })?.texto).toBe(
      "Importada del HTML: registrar condiciones",
    );
  });

  it("con las condiciones ya registradas, lo que falta es el diagnóstico", () => {
    expect(accionDeEvaluacion({ ...base, importada: true, tieneCondicionesBis: true })?.texto).toBe(
      "Generar diagnóstico",
    );
  });

  it("y una evaluación de Atlas sin condiciones lo dice sin nombrar el HTML", () => {
    expect(accionDeEvaluacion({ ...base, tieneCondicionesBis: false })?.texto).toBe(
      "Registrar condiciones de la toma",
    );
  });

  it("las dos pantallas que la pintan leen esos dos datos", () => {
    for (const f of [
      "src/modules/patients/data/patients-list-reader.ts",
      "src/modules/dashboard/data/tablero-reader.ts",
    ]) {
      const s = readFileSync(f, "utf8");
      expect(s, f).toContain("importada: e.import_batch_id != null");
      expect(s, f).toContain("tieneCondicionesBis: (e.evaluation_bis_intake ?? []).length > 0");
    }
  });
});
