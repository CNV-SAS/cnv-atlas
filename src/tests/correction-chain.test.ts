import { describe, expect, it } from "vitest";

import { type CorrectionEdge, chainContaining } from "@/modules/corrections/correction-chain";

// Logica pura del armado de la cadena de correcciones (CP2). Sin BD ni sesion: el reader hace el fetch
// RLS y llama a chainContaining. Se prueba que desde CUALQUIER version se reconstruya la cadena entera,
// en orden, con el motivo, y que aristas de otras cadenas queden fuera.

function edge(old: string, nw: string, extra?: Partial<CorrectionEdge>): CorrectionEdge {
  return {
    oldEvaluationId: old,
    newEvaluationId: nw,
    reason: `de ${old} a ${nw}`,
    correctedByName: "Dra. Ruiz",
    triggerType: "correccion_profesional",
    createdAt: "2026-08-11T10:00:00Z",
    ...extra,
  };
}

describe("chainContaining", () => {
  it("sin correcciones: cadena vacia, la vigente es la misma", () => {
    const r = chainContaining("v1", []);
    expect(r.entries).toHaveLength(0);
    expect(r.currentVigenteId).toBe("v1");
    expect(r.currentEvaluationId).toBe("v1");
  });

  it("una correccion v1->v2: se ve igual desde v1 y desde v2", () => {
    const edges = [edge("v1", "v2")];
    const fromOld = chainContaining("v1", edges);
    const fromNew = chainContaining("v2", edges);
    for (const r of [fromOld, fromNew]) {
      expect(r.entries.map((e) => [e.oldEvaluationId, e.newEvaluationId])).toEqual([["v1", "v2"]]);
      expect(r.currentVigenteId).toBe("v2");
    }
    expect(fromOld.currentEvaluationId).toBe("v1");
    expect(fromNew.currentEvaluationId).toBe("v2");
  });

  it("cadena v1->v2->v3: orden y vigente correctos desde el medio", () => {
    const edges = [edge("v2", "v3"), edge("v1", "v2")]; // desordenadas a proposito
    const r = chainContaining("v2", edges);
    expect(r.entries.map((e) => `${e.oldEvaluationId}->${e.newEvaluationId}`)).toEqual(["v1->v2", "v2->v3"]);
    expect(r.currentVigenteId).toBe("v3");
    expect(r.currentEvaluationId).toBe("v2");
  });

  it("preserva el motivo de cada salto", () => {
    const edges = [
      edge("v1", "v2", { reason: "dato de sueno mal digitado" }),
      edge("v2", "v3", { reason: "se completo la encuesta en consulta", triggerType: "completar_profesional" }),
    ];
    const r = chainContaining("v3", edges);
    expect(r.entries[0].reason).toBe("dato de sueno mal digitado");
    expect(r.entries[1].reason).toBe("se completo la encuesta en consulta");
    expect(r.entries[1].triggerType).toBe("completar_profesional");
  });

  it("ignora aristas de OTRA cadena (otro paciente)", () => {
    const edges = [edge("v1", "v2"), edge("otraA", "otraB"), edge("otraB", "otraC")];
    const r = chainContaining("v1", edges);
    expect(r.entries.map((e) => `${e.oldEvaluationId}->${e.newEvaluationId}`)).toEqual(["v1->v2"]);
    expect(r.currentVigenteId).toBe("v2");
  });

  it("no entra en bucle si los datos tuvieran un ciclo (defensivo)", () => {
    const edges = [edge("a", "b"), edge("b", "a")];
    const r = chainContaining("a", edges);
    // No debe colgarse; devuelve una cadena finita.
    expect(r.entries.length).toBeGreaterThan(0);
    expect(r.entries.length).toBeLessThanOrEqual(2);
  });
});
