import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { accionDeEvaluacion, pendienteDelPaciente } from "@/modules/patients/pendientes";

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

// ═══ Y NO LA TAPA "RENOVAR AUTORIZACION" (smoke de Santiago, 2026-09-22) ═══
// El paciente importado nunca firmo la de Atlas: la firma en su proxima consulta, y su chip ya lo dice. Lo
// accionable hoy son las condiciones.
describe("el paciente importado y su autorización", () => {
  const importada = {
    evaluationId: "e1",
    status: "in_progress",
    tieneBis: true,
    tieneDiagnostico: false,
    reporte: null,
    importada: true,
    tieneCondicionesBis: false,
  };

  it("sin autorización vigente, el pendiente sigue siendo el de las condiciones", () => {
    const r = pendienteDelPaciente([importada], true);
    expect(r.principal?.texto).toBe("Importada del HTML: registrar condiciones");
    expect(r.evaluationId).toBe("e1");
  });

  it("pero si además tiene una evaluación propia pendiente, manda la autorización", () => {
    const propia = { ...importada, evaluationId: "e2", importada: false, tieneCondicionesBis: true };
    expect(pendienteDelPaciente([importada, propia], true).principal?.texto).toBe("Renovar autorización");
  });

  it("y un paciente de Atlas sin autorización sigue igual que siempre", () => {
    const propia = { ...importada, importada: false, tieneCondicionesBis: true };
    expect(pendienteDelPaciente([propia], true).principal?.texto).toBe("Renovar autorización");
  });
});
