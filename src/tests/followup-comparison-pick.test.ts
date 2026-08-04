import { describe, expect, it } from "vitest";

import { pickPreviousEvaluation } from "@/modules/followups/data/comparison-chronology";

// C2-a: la eleccion de la evaluacion PREVIA para la comparacion longitudinal debe ordenar por
// measurement_date (cronologia clinica), NO por created_at (que se mueve con una correccion).
// La logica vive en una funcion PURA para poder probar la cronologia sin RLS ni BD.

describe("pickPreviousEvaluation (cronologia clinica por measurement_date)", () => {
  it("inicial corregido: created_at posterior a un seguimiento, pero se ordena por medicion", () => {
    // V2 seguimiento (medido en abril). Candidata: el inicial CORREGIDO, medido en enero pero con
    // created_at de junio (la correccion se hizo despues). Por created_at quedaria "despues" de V2 y
    // se perderia; por measurement_date es correctamente la previa.
    const current = { id: "v2", measurementDate: "2026-04-01T10:00:00Z", createdAt: "2026-04-01T10:00:00Z" };
    const candidates = [
      { id: "v1-corregido", measurementDate: "2026-01-01T09:00:00Z", createdAt: "2026-06-01T15:00:00Z" },
    ];
    expect(pickPreviousEvaluation(current, candidates)).toBe("v1-corregido");
  });

  it("empate de measurement_date: desempata por created_at (determinista)", () => {
    // Dos vigentes medidas el mismo dia; el pick debe ser estable, no depender del orden de la BD.
    const current = { id: "cur", measurementDate: "2026-05-01T10:00:00Z", createdAt: "2026-05-01T10:00:00Z" };
    const candidates = [
      { id: "a", measurementDate: "2026-03-01T08:00:00Z", createdAt: "2026-03-01T08:00:00Z" },
      { id: "b", measurementDate: "2026-03-01T08:00:00Z", createdAt: "2026-03-15T08:00:00Z" }, // created despues
    ];
    // Misma fecha de medicion -> gana el created_at mas reciente (b). Estable en ambos ordenes.
    expect(pickPreviousEvaluation(current, candidates)).toBe("b");
    expect(pickPreviousEvaluation(current, [...candidates].reverse())).toBe("b");
  });

  it("dos correcciones encadenadas (V1->V1b->V1c) con un seguimiento en medio", () => {
    // La cadena crece, pero el filtro de superseded (en la CONSULTA, aguas arriba) deja UNA sola
    // vigente del inicial: V1c. Asi que la funcion pura solo ve V1c (medido en enero, con created_at
    // de la ultima correccion, junio) y el seguimiento V2 (abril). Verifica los dos angulos:
    const v1c = { id: "v1c", measurementDate: "2026-01-01T09:00:00Z", createdAt: "2026-06-20T15:00:00Z" };
    const v2 = { id: "v2", measurementDate: "2026-04-01T10:00:00Z", createdAt: "2026-04-01T10:00:00Z" };
    // (i) Viendo el seguimiento V2, su previa es el inicial corregido V1c (enero < abril), aunque V1c
    // tenga created_at posterior a V2 por las correcciones.
    expect(pickPreviousEvaluation(v2, [v1c])).toBe("v1c");
    // (ii) Viendo el inicial corregido V1c, no hay previa: el seguimiento V2 es POSTERIOR, no cuenta.
    expect(pickPreviousEvaluation(v1c, [v2])).toBeNull();
  });

  it("evaluacion sin medicion en el medio: no se cuela como previa", () => {
    // Un draft sin medir, con created_at mas reciente que la real: NO es comparable, se excluye.
    const current = { id: "cur", measurementDate: "2026-06-01T10:00:00Z", createdAt: "2026-06-01T10:00:00Z" };
    const candidates = [
      { id: "real", measurementDate: "2026-01-01T09:00:00Z", createdAt: "2026-01-01T09:00:00Z" },
      { id: "draft-sin-medicion", measurementDate: null, createdAt: "2026-05-01T09:00:00Z" },
    ];
    expect(pickPreviousEvaluation(current, candidates)).toBe("real");
  });

  it("caso normal sin correcciones: la previa es la ultima anterior (no se movio)", () => {
    const current = { id: "c", measurementDate: "2026-06-01T10:00:00Z", createdAt: "2026-06-01T10:00:00Z" };
    const candidates = [
      { id: "p1", measurementDate: "2026-01-01T10:00:00Z", createdAt: "2026-01-01T10:00:00Z" },
      { id: "p2", measurementDate: "2026-04-01T10:00:00Z", createdAt: "2026-04-01T10:00:00Z" },
    ];
    expect(pickPreviousEvaluation(current, candidates)).toBe("p2");
  });

  it("sin candidatas anteriores: null (primera evaluacion comparable)", () => {
    const current = { id: "c", measurementDate: "2026-01-01T10:00:00Z", createdAt: "2026-01-01T10:00:00Z" };
    expect(pickPreviousEvaluation(current, [])).toBeNull();
    // Una candidata POSTERIOR no es previa.
    const posterior = [{ id: "x", measurementDate: "2026-05-01T10:00:00Z", createdAt: "2026-05-01T10:00:00Z" }];
    expect(pickPreviousEvaluation(current, posterior)).toBeNull();
  });

  it("la actual sin medicion no ancla: null", () => {
    const current = { id: "c", measurementDate: null, createdAt: "2026-06-01T10:00:00Z" };
    const candidates = [{ id: "p", measurementDate: "2026-01-01T10:00:00Z", createdAt: "2026-01-01T10:00:00Z" }];
    expect(pickPreviousEvaluation(current, candidates)).toBeNull();
  });
});
