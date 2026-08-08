import { describe, expect, it, vi } from "vitest";

// computePatientBandText es puro, pero vive en reports-repository (server-only). Se mockea el guard
// para importarlo sin contexto de Server Component.
vi.mock("server-only", () => ({}));

import { computePatientBandText } from "@/modules/reports/data/reports-repository";
import { BAND_TEXT } from "@/modules/followups/services/eb-trajectory";

// P0 Parte 2 (P5): la regla de QUÉ ve el paciente en el PDF por caso. Pura, sin BD.
// Regla: hay banda Y (banda != empeoró, O empeoró confirmado).

// El tercer arg es dfiComplete: con la encuesta incompleta la banda no se comunica (D-007). Los casos
// "normales" abajo pasan true (diagnóstico completo).
describe("computePatientBandText (qué ve el paciente en el PDF)", () => {
  it("sin banda sellada (primera medición o intervalo corto): sin sección", () => {
    expect(computePatientBandText(null, false, true)).toBeNull();
    expect(computePatientBandText({}, false, true)).toBeNull();
  });

  it("mejoró: se comunica siempre (no requiere confirmación)", () => {
    expect(computePatientBandText({ band: "mejoro" }, false, true)).toBe(BAND_TEXT.mejoro);
  });

  it("sin cambio: se comunica siempre", () => {
    expect(computePatientBandText({ band: "sin_cambio" }, false, true)).toBe(BAND_TEXT.sin_cambio);
  });

  it("empeoró SIN confirmar: NO se comunica (sale sin la sección)", () => {
    expect(computePatientBandText({ band: "empeoro" }, false, true)).toBeNull();
  });

  it("empeoró CONFIRMADO (con cita, garantizada al confirmar): se comunica", () => {
    expect(computePatientBandText({ band: "empeoro" }, true, true)).toBe(BAND_TEXT.empeoro);
  });

  it("encuesta INCOMPLETA: NO se comunica ninguna banda, ni una favorable (D-007)", () => {
    // Ni siquiera "mejoró" con confirmación: la EB-BIS se distorsiona con la encuesta a medias.
    expect(computePatientBandText({ band: "mejoro" }, false, false)).toBeNull();
    expect(computePatientBandText({ band: "sin_cambio" }, false, false)).toBeNull();
    expect(computePatientBandText({ band: "empeoro" }, true, false)).toBeNull();
  });
});
