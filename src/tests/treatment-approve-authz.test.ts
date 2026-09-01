import { beforeEach, describe, expect, it, vi } from "vitest";

// Prueba del CONTROL DE SEGURIDAD de approveProtocol EN AISLAMIENTO (T2 A3): el chequeo explicito de
// asignacion es lo unico que impide que un profesional apruebe una prescripcion para el paciente de
// otro, y es lo unico que el test del writer (BD) no cubre. Se prueba sustituyendo las dependencias
// con vi.mock (el reader RLS, el lookup del perfil profesional, el writer): NO requiere infra de
// sesion ni rediseño; el service es testeable por mocks de modulo. computeProtocoloEfectivo queda
// REAL (es puro) para no falsear el camino feliz.

vi.mock("server-only", () => ({}));
vi.mock("@/modules/treatment/data/treatment-reader", () => ({
  getTreatmentForApproval: vi.fn(),
  getTreatmentProtocol: vi.fn(),
}));
vi.mock("@/modules/payments/data/payments-repository", () => ({
  getProfessionalProfileIdByUser: vi.fn(),
}));
vi.mock("@/modules/treatment/data/actor-profession-reader", () => ({
  getActorProfession: vi.fn(),
}));
vi.mock("@/modules/treatment/data/treatment-writer", () => ({
  writeApproveProtocol: vi.fn(),
  saveAdjustments: vi.fn(),
  addTreatmentNote: vi.fn(),
  acknowledgeRestrictions: vi.fn(),
  TreatmentStateError: class TreatmentStateError extends Error {},
}));

import { computeProtocolo, runEngine } from "@/clinical-engine";
import { normalizeHeader } from "@/modules/bis/services/header-map";
import { buildEngineInput } from "@/modules/clinical-pipeline/services/build-engine-input";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";
import { getActorProfession } from "@/modules/treatment/data/actor-profession-reader";
import type { TreatmentForApproval } from "@/modules/treatment/data/treatment-reader";
import { getTreatmentForApproval } from "@/modules/treatment/data/treatment-reader";
import { writeApproveProtocol } from "@/modules/treatment/data/treatment-writer";
import { approveProtocol } from "@/modules/treatment/services/treatment-service";

import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";

const reader = vi.mocked(getTreatmentForApproval);
const profileOf = vi.mocked(getProfessionalProfileIdByUser);
const professionOf = vi.mocked(getActorProfession);
const writer = vi.mocked(writeApproveProtocol);

// SUGGESTED real (F5 del fixture), para que el camino feliz recompute el efectivo de verdad.
const FIX: Record<string, number> = {};
for (const [k, v] of Object.entries(biodyJson as Record<string, unknown>)) {
  if (typeof v === "number" && Number.isFinite(v)) FIX[normalizeHeader(k)] = v;
}
const engineInput = buildEngineInput(
  { sex: "M", birthDate: "1971-11-05", surveyAnswers: [], expectedFieldKeys: ["d2_19"], bisRaw: FIX, gripStrengthKg: null },
  { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" },
  new Date("2026-06-22T00:00:00Z"),
);
const SUGGESTED = computeProtocolo(engineInput, runEngine(engineInput))!;

const ASSIGNED = "11111111-1111-1111-1111-111111111111"; // professional_profiles.id asignado
const OTHER = "22222222-2222-2222-2222-222222222222"; // otro profesional
const treatment: TreatmentForApproval = {
  treatmentId: "T1",
  status: "draft",
  protocolSuggested: SUGGESTED,
  adjustments: { geb: null, pal: null, kcalObj: null, protGkg: null, fatPct: null, deficit: null, pesoMeta: null },
  evaluationProfessionalId: ASSIGNED,
  bisMeasurementDate: null,
};
const actor = { actorId: "user-x", actorEmail: "x@cnv", ip: null };

describe("approveProtocol: control de asignacion (aislado)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reader.mockResolvedValue(treatment);
    writer.mockResolvedValue(undefined);
    professionOf.mockResolvedValue({ isProfessional: true, profession: "nutricionista" }); // por defecto
  });

  it("el profesional ASIGNADO aprueba (y se sella), y el acto SELLA la profesion con que aprobo", async () => {
    profileOf.mockResolvedValue(ASSIGNED);
    const r = await approveProtocol({ evaluationId: "E1" }, actor);
    expect(r.ok).toBe(true);
    expect(writer).toHaveBeenCalledTimes(1);
    // La profesion queda EN el acto (protocol_approved), no solo approved_by = quien. Se lee del actor,
    // no se asume: si el perfil cambia despues, el acto conserva la de la aprobacion (write-once).
    const sealed = writer.mock.calls[0][0].protocolApproved as { approvedProfession?: string | null };
    expect(sealed.approvedProfession).toBe("nutricionista");
  });

  it("el profesional ASIGNADO pero SIN profesion configurada falla (forbidden) y NO sella nada", async () => {
    profileOf.mockResolvedValue(ASSIGNED);
    professionOf.mockResolvedValue({ isProfessional: true, profession: null });
    const r = await approveProtocol({ evaluationId: "E1" }, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writer).not.toHaveBeenCalled();
  });

  it("un profesional NO asignado falla (forbidden) y NO sella nada", async () => {
    profileOf.mockResolvedValue(OTHER);
    const r = await approveProtocol({ evaluationId: "E1" }, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writer).not.toHaveBeenCalled();
  });

  it("sin perfil profesional falla (forbidden) y NO sella nada", async () => {
    profileOf.mockResolvedValue(null);
    const r = await approveProtocol({ evaluationId: "E1" }, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writer).not.toHaveBeenCalled();
  });
});
