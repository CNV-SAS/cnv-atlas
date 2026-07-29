import { beforeEach, describe, expect, it, vi } from "vitest";

// Control de seguridad de confirmDiagnosis EN AISLAMIENTO (mini-bloque): confirmar es la firma
// clinica que habilita prescribir, asi que el chequeo de asignacion (que sea el profesional asignado)
// es el control critico. Se prueba sustituyendo las dependencias con vi.mock (reader RLS, lookup del
// perfil, writer), sin infra de sesion.

vi.mock("server-only", () => ({}));
vi.mock("@/modules/diagnoses/data/diagnosis-confirm-reader", () => ({
  getDiagnosisForConfirmation: vi.fn(),
}));
vi.mock("@/modules/payments/data/payments-repository", () => ({
  getProfessionalProfileIdByUser: vi.fn(),
}));
vi.mock("@/modules/diagnoses/data/diagnosis-confirm-writer", () => ({
  confirmDiagnosis: vi.fn(),
  DiagnosisStateError: class DiagnosisStateError extends Error {},
}));

import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";
import { getDiagnosisForConfirmation } from "@/modules/diagnoses/data/diagnosis-confirm-reader";
import { confirmDiagnosis as writeConfirm } from "@/modules/diagnoses/data/diagnosis-confirm-writer";
import { confirmDiagnosis } from "@/modules/diagnoses/services/diagnosis-confirm-service";

const reader = vi.mocked(getDiagnosisForConfirmation);
const profileOf = vi.mocked(getProfessionalProfileIdByUser);
const writer = vi.mocked(writeConfirm);

const ASSIGNED = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const base = { diagnosisId: "D1", evaluationProfessionalId: ASSIGNED, alreadyConfirmed: false };
const actor = { actorId: "user-x", actorEmail: "x@cnv", ip: null };

describe("confirmDiagnosis: control de asignacion (aislado)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reader.mockResolvedValue(base);
    writer.mockResolvedValue(undefined);
  });

  it("el profesional ASIGNADO confirma (y se escribe)", async () => {
    profileOf.mockResolvedValue(ASSIGNED);
    const r = await confirmDiagnosis({ evaluationId: "E1" }, actor);
    expect(r.ok).toBe(true);
    expect(writer).toHaveBeenCalledTimes(1);
  });

  it("un profesional NO asignado falla (forbidden) y NO escribe", async () => {
    profileOf.mockResolvedValue(OTHER);
    const r = await confirmDiagnosis({ evaluationId: "E1" }, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writer).not.toHaveBeenCalled();
  });

  it("sin perfil profesional falla (forbidden) y NO escribe", async () => {
    profileOf.mockResolvedValue(null);
    const r = await confirmDiagnosis({ evaluationId: "E1" }, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writer).not.toHaveBeenCalled();
  });

  it("un diagnostico YA confirmado no se re-confirma (conflict) y NO escribe", async () => {
    profileOf.mockResolvedValue(ASSIGNED);
    reader.mockResolvedValue({ ...base, alreadyConfirmed: true });
    const r = await confirmDiagnosis({ evaluationId: "E1" }, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("conflict");
    expect(writer).not.toHaveBeenCalled();
  });
});
