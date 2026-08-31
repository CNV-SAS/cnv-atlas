import { describe, expect, it } from "vitest";

import { runEngine } from "@/clinical-engine";
import { normalizeHeader } from "@/modules/bis/services/header-map";
import { buildEngineInput } from "@/modules/clinical-pipeline/services/build-engine-input";

import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";

// AF/IR: clasificacion antes null (port incompleto, no exclusion deliberada), ahora poblada con
// cAF/cIR (expuestos por el mecanismo derivado). Los VALORES ESPERADOS se verifican contra ATLAS_v7,
// no contra nuestra salida: cAF/cIR del frozen son byte-identicos a los clasificadores del HTML nuevo
// (docs/entregas/gildardo-2026-07-30/ATLAS_v7.html, cAF:3246 == frozen:52; cortes de dAF:12735
// identicos). Donante golden Juan Esteban: AF 5,8 (M) -> "Bajo" (5,8 < 6,5); IR 0,798 (M) ->
// "Inflamacion bajo grado" (0,798 >= 0,78, corte masculino). Nota: el display dAF/dIR del HTML rotula
// IR elevado como "Inflamacion DE bajo grado" (una palabra mas); usamos el clasificador cIR verbatim,
// ambos son de Gildardo, diferencia cosmetica.

const FIX: Record<string, number> = {};
for (const [k, v] of Object.entries(biodyJson as Record<string, unknown>)) {
  if (typeof v === "number" && Number.isFinite(v)) FIX[normalizeHeader(k)] = v;
}
const input = buildEngineInput(
  { sex: "M", birthDate: "1971-11-05", surveyAnswers: [], expectedFieldKeys: ["d2_19"], bisRaw: FIX, gripStrengthKg: null },
  { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" },
  new Date("2026-06-22T00:00:00Z"),
);

describe("clasificacion de AF e IR (contra ATLAS_v7, no contra nuestra salida)", () => {
  const out = runEngine(input);

  it("AF 5,8 (M) clasifica 'Bajo' (corte cAF/dAF <6,5)", () => {
    expect(out.indicators.AF).toBe(5.8);
    expect(out.classifications.AF?.label).toBe("Bajo");
  });

  it("IR 0,798 (M) clasifica 'Inflamacion bajo grado' (corte cIR 0,78)", () => {
    expect(out.indicators.IR).toBe(0.798);
    expect(out.classifications.IR?.label).toBe("Inflamación bajo grado");
  });
});
