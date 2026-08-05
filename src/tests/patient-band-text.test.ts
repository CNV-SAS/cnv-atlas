import { describe, expect, it } from "vitest";

import { computePatientBandText } from "@/modules/reports/data/reports-repository";
import { BAND_TEXT } from "@/modules/followups/services/eb-trajectory";

// P0 Parte 2 (P5): la regla de QUÉ ve el paciente en el PDF por caso. Pura, sin BD.
// Regla: hay banda Y (banda != empeoró, O empeoró confirmado).

describe("computePatientBandText (qué ve el paciente en el PDF)", () => {
  it("sin banda sellada (primera medición o intervalo corto): sin sección", () => {
    expect(computePatientBandText(null, false)).toBeNull();
    expect(computePatientBandText({}, false)).toBeNull();
  });

  it("mejoró: se comunica siempre (no requiere confirmación)", () => {
    expect(computePatientBandText({ band: "mejoro" }, false)).toBe(BAND_TEXT.mejoro);
  });

  it("sin cambio: se comunica siempre", () => {
    expect(computePatientBandText({ band: "sin_cambio" }, false)).toBe(BAND_TEXT.sin_cambio);
  });

  it("empeoró SIN confirmar: NO se comunica (sale sin la sección)", () => {
    expect(computePatientBandText({ band: "empeoro" }, false)).toBeNull();
  });

  it("empeoró CONFIRMADO (con cita, garantizada al confirmar): se comunica", () => {
    expect(computePatientBandText({ band: "empeoro" }, true)).toBe(BAND_TEXT.empeoro);
  });
});
