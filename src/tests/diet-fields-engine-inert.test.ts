import { describe, expect, it, vi } from "vitest";

import { runEngine } from "@/clinical-engine";
import { normalizeHeader } from "@/modules/bis/services/header-map";
import {
  buildEngineInput,
  type SurveyFieldAnswer,
} from "@/modules/clinical-pipeline/services/build-engine-input";

import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";

// BEFORE-AFTER del fix 1b (field_keys de los 5 campos del parrafo de dieta). Al darles field_key, esos campos
// EMPIEZAN a viajar al input del motor (surveyAnswers = todo lo que tiene field_key). Este test prueba que eso
// NO cambia el diagnostico: con el interruptor LE8_MAPEO_CORREGIDO en OFF (estado vigente, P-04), el frozen NO
// lee d7_agua (lee d1_16, historico), y no lee d8_59/d8_60/d7_55/d7_56 en absoluto. Asi que el campo entra sin
// efecto. Si algun dia el switch se enciende (Q26), d7_agua SI alimentara el motor y este test cambiaria: es la
// señal de que ese flip es un cambio de diagnostico (ver dfi-narrative / la nota del switch).

vi.mock("server-only", () => ({}));

const NOW = new Date("2026-06-22T00:00:00Z");
const MODEL = { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" };

function bisRaw(): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const [k, v] of Object.entries(biodyJson as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) raw[normalizeHeader(k)] = v;
  }
  return raw;
}

function run(surveyAnswers: SurveyFieldAnswer[]) {
  return runEngine(
    buildEngineInput(
      { sex: "M", birthDate: "1971-11-05", surveyAnswers, expectedFieldKeys: ["d2_19"], bisRaw: bisRaw() },
      MODEL,
      NOW,
    ),
  );
}

// Los 5 campos que reciben field_key en el fix, con valores no triviales (d7_agua alto, contadores > 0).
const DIET_FIELDS: SurveyFieldAnswer[] = [
  { fieldKey: "d8_59", value: "Restaurante o fonda", type: "opcion" },
  { fieldKey: "d8_60", value: "3–4 veces/semana", type: "opcion" },
  { fieldKey: "d7_agua", value: "8", type: "contador" },
  { fieldKey: "d7_55", value: "3", type: "contador" },
  { fieldKey: "d7_56", value: "1", type: "contador" },
];

describe("before-after: los 5 campos de dieta entran al motor SIN cambiar el diagnostico (switch OFF)", () => {
  it("los valores CLINICOS del dfi son identicos con y sin los 5 campos en el input (switch OFF)", () => {
    const sin = run([]);
    const con = run(DIET_FIELDS);

    // El unico campo que cambia es dfi.degradedReason (string de DISPLAY): pasa de "Sin datos de encuesta" a
    // "Encuesta incompleta: falta 1 de 1", porque ahora hay ALGUNAS respuestas. Eso NO es el diagnostico, es el
    // motivo de la degradacion reflejando que llegaron datos. Se excluye de la comparacion CLINICA a proposito.
    const clinico = (o: ReturnType<typeof run>) => {
      const { degradedReason: _omit, ...dfiClinico } = o.dfi;
      void _omit;
      return dfiClinico;
    };
    expect(clinico(con)).toEqual(clinico(sin));
    expect(con.indicators).toEqual(sin.indicators);
    expect(con.classifications).toEqual(sin.classifications);
    expect(con.efrPhenotype).toEqual(sin.efrPhenotype);
    // en particular d7_agua NO movio la hidratacion (le8Total identico): el switch OFF lee d1_16, no d7_agua.
    expect(con.dfi.le8Total).toBe(sin.dfi.le8Total);
    expect(con.dfi.domains).toEqual(sin.dfi.domains);
    expect(con.dfi.riesgo).toEqual(sin.dfi.riesgo);
    expect(con.dfi.rutas).toEqual(sin.dfi.rutas);
  });
});
