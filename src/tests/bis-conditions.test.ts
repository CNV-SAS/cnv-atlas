import { describe, expect, it } from "vitest";

import {
  activeWarnings,
  computeContraindicated,
} from "@/modules/bis-intake/services/contraindication";
import { evaluateBisImportGate } from "@/modules/bis-intake/services/import-gate";
import type { BisCondition, BisConditionCatalog, BisIntakeRecord } from "@/modules/bis-intake/types";
import {
  type SaveBisConditionsInput,
  validateBisConditionsCapture,
} from "@/modules/bis-intake/validations";

// Catalogo de prueba fiel a la v1 (subconjunto suficiente): 3 generales + 3 femeninas.
const CONDS: BisCondition[] = [
  { key: "placas_metalicas", label: "Placas", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null, orderIndex: 1 },
  { key: "marcapasos", label: "Marcapasos", scope: "general", kind: "contraindicacion", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null, orderIndex: 2 },
  { key: "diuretico", label: "Diuretico", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: true, detailLabel: "¿Cual?", detailType: "text", orderIndex: 3 },
  { key: "embarazo", label: "Embarazo", scope: "mujeres", kind: "advertencia", inputType: "boolean", requiresDetail: true, detailLabel: "Mes de gestacion", detailType: "number", orderIndex: 4 },
  { key: "menstruacion", label: "Menstruacion", scope: "mujeres", kind: "calidad", inputType: "boolean", requiresDetail: true, detailLabel: "Dia del periodo", detailType: "number", orderIndex: 5 },
  { key: "semana_ciclo", label: "Semana del ciclo", scope: "mujeres", kind: "calidad", inputType: "number", requiresDetail: false, detailLabel: null, detailType: null, orderIndex: 6 },
];
const CATALOG: BisConditionCatalog = { versionId: "v1", versionNumber: 1, conditions: CONDS };
const NOW = "2026-07-24T12:00:00.000Z";

// Respuestas validas del bloque general (base para variar el caso bajo prueba).
function generalAnswers(marcapasos: boolean): SaveBisConditionsInput["answers"] {
  return {
    placas_metalicas: { value: false },
    marcapasos: { value: marcapasos },
    diuretico: { value: false },
  };
}

describe("computeContraindicated (compuerta de seguridad)", () => {
  it("marca contraindicacion solo con booleano estricto true en una condicion contraindicacion", () => {
    expect(computeContraindicated(CONDS, { marcapasos: { value: true } })).toBe(true);
    expect(computeContraindicated(CONDS, { marcapasos: { value: false } })).toBe(false);
    expect(computeContraindicated(CONDS, {})).toBe(false);
  });

  it("un numero o texto NO dispara la compuerta (=== true, no truthy)", () => {
    // Aunque una condicion contraindicacion recibiera un numero/texto (truthy), no bloquea.
    expect(computeContraindicated(CONDS, { marcapasos: { value: 3 } })).toBe(false);
    expect(computeContraindicated(CONDS, { semana_ciclo: { value: 3 } })).toBe(false);
  });

  it("activeWarnings devuelve las advertencias respondidas true", () => {
    const w = activeWarnings(CONDS, { embarazo: { value: true } });
    expect(w.map((c) => c.key)).toEqual(["embarazo"]);
    expect(activeWarnings(CONDS, { embarazo: { value: false } })).toEqual([]);
  });
});

describe("validateBisConditionsCapture", () => {
  it("acepta el bloque general completo y computa contraindicated", () => {
    const okRes = validateBisConditionsCapture(CATALOG, { evaluationId: "e", answers: generalAnswers(true) }, NOW);
    expect(okRes.ok).toBe(true);
    if (okRes.ok) expect(okRes.value.contraindicated).toBe(true);

    const noRes = validateBisConditionsCapture(CATALOG, { evaluationId: "e", answers: generalAnswers(false) }, NOW);
    expect(noRes.ok && noRes.value.contraindicated).toBe(false);
  });

  it("exige que el bloque general este completo (el femenino es opcional)", () => {
    const res = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { placas_metalicas: { value: false }, marcapasos: { value: false } } },
      NOW,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.fields?.diuretico).toBeDefined();
  });

  it("valida el rango 1-6 de semana_ciclo y no lo trata como booleano", () => {
    const good = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { ...generalAnswers(false), semana_ciclo: { value: 3 } } },
      NOW,
    );
    expect(good.ok).toBe(true);
    const bad = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { ...generalAnswers(false), semana_ciclo: { value: 9 } } },
      NOW,
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.fields?.semana_ciclo).toBeDefined();
  });

  it("advertencia (embarazo) en true exige reconocimiento explicito y lo sella con timestamp", () => {
    const sinAck = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { ...generalAnswers(false), embarazo: { value: true, detail: 5 } } },
      NOW,
    );
    expect(sinAck.ok).toBe(false);
    if (!sinAck.ok) expect(sinAck.error.fields?.embarazo).toBeDefined();

    const conAck = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { ...generalAnswers(false), embarazo: { value: true, detail: 5, acknowledged: true } } },
      NOW,
    );
    expect(conAck.ok).toBe(true);
    if (conAck.ok) {
      expect(conAck.value.answers.embarazo?.acknowledgedAt).toBe(NOW);
      expect(conAck.value.answers.embarazo?.detail).toBe(5);
      expect(conAck.value.warnings).toContain("embarazo");
    }
  });

  it("exige el detalle del diuretico cuando es true y lo sella como texto", () => {
    const sinDetalle = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { ...generalAnswers(false), diuretico: { value: true } } },
      NOW,
    );
    expect(sinDetalle.ok).toBe(false);

    const conDetalle = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { ...generalAnswers(false), diuretico: { value: true, detail: "Furosemida" } } },
      NOW,
    );
    expect(conDetalle.ok).toBe(true);
    if (conDetalle.ok) expect(conDetalle.value.answers.diuretico?.detail).toBe("Furosemida");
  });

  it("rechaza respuestas a condiciones que no existen en el catalogo", () => {
    const res = validateBisConditionsCapture(
      CATALOG,
      { evaluationId: "e", answers: { ...generalAnswers(false), inventada: { value: true } } },
      NOW,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.fields?.inventada).toBeDefined();
  });
});

describe("evaluateBisImportGate (orden + seguridad del import)", () => {
  const intake = (over: Partial<BisIntakeRecord>): BisIntakeRecord => ({
    versionId: "v1",
    answers: {},
    contraindicated: false,
    gripStrengthKg: null,
    weightGoalKg: null,
    updatedAt: NOW,
    ...over,
  });

  it("sin captura de condiciones NO habilita el import (orden impuesto por el sistema)", () => {
    const g = evaluateBisImportGate(null);
    expect(g.allowed).toBe(false);
    if (!g.allowed) expect(g.reason).toBe("conditions_missing");
  });

  it("con contraindicacion (marcapasos) bloquea el import", () => {
    const g = evaluateBisImportGate(intake({ contraindicated: true }));
    expect(g.allowed).toBe(false);
    if (!g.allowed) expect(g.reason).toBe("contraindicated");
  });

  it("con condiciones respondidas y sin contraindicacion habilita el import", () => {
    expect(evaluateBisImportGate(intake({})).allowed).toBe(true);
  });
});
