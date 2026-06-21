import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks de las dependencias del servicio: las lecturas service-role del intake y el
// escritor transaccional (server-only, tocan BD). Asi se prueba la orquestacion
// (validacion, resolucion de identidad, sellado de consentimiento, mapeo del gate)
// sin base de datos. El alias "@" lo resuelve vitest.config.
vi.mock("@/modules/patients/data/patients-intake", () => ({
  findPatientByDocument: vi.fn(),
  findDuplicateCandidates: vi.fn(),
}));

// El escritor se mockea, pero ConsentGateError debe ser una clase real para que el
// instanceof del servicio funcione (se lanza desde el mock y se atrapa en el
// servicio). La clase se define DENTRO del factory porque vi.mock se eleva al tope.
vi.mock("@/modules/evaluations/data/intake-writer", () => {
  class ConsentGateError extends Error {
    constructor(public readonly missing: string[]) {
      super("gate");
      this.name = "ConsentGateError";
    }
  }
  return { writeIntakeEvaluation: vi.fn(), ConsentGateError };
});

import * as intakeReads from "@/modules/patients/data/patients-intake";
import * as writer from "@/modules/evaluations/data/intake-writer";
import { submitSurveyIntake } from "@/modules/evaluations/services/survey-intake";
import type { SurveyLinkView } from "@/modules/evaluations/types";

const initialLink: SurveyLinkView = {
  id: "link-1",
  organizationId: "11111111-1111-1111-1111-111111111111",
  professionalId: "33333333-3333-3333-3333-333333333333",
  type: "inicial",
  patientId: null,
  prefill: null,
};

const validConsent = {
  servicio: true,
  datos_sensibles: true,
  internacional_ia: true,
  mayoria_de_edad: true,
};

const validIdentity = {
  documentType: "CC",
  documentNumber: "1234567",
  firstName: "Maria",
  lastName: "Gomez",
  birthDate: "1990-05-10",
};

function input(over: Partial<Parameters<typeof submitSurveyIntake>[0]> = {}) {
  return {
    link: initialLink,
    surveyVersionId: "55555555-5555-5555-5555-555555555552",
    consent: validConsent,
    identity: validIdentity,
    answers: [],
    ipAddress: "1.2.3.4",
    ...over,
  };
}

beforeEach(() => {
  vi.mocked(intakeReads.findPatientByDocument).mockReset();
  vi.mocked(intakeReads.findDuplicateCandidates).mockReset();
  vi.mocked(writer.writeIntakeEvaluation).mockReset();
  vi.mocked(intakeReads.findDuplicateCandidates).mockResolvedValue([]);
  vi.mocked(writer.writeIntakeEvaluation).mockResolvedValue({
    evaluationId: "ev-1",
    patientId: "pat-1",
  });
});

describe("submitSurveyIntake", () => {
  it("sin match exacto -> inicial; sella las 3 autorizaciones necesarias", async () => {
    vi.mocked(intakeReads.findPatientByDocument).mockResolvedValue(null);
    const res = await submitSurveyIntake(input());
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.mode).toBe("inicial");
    const call = vi.mocked(writer.writeIntakeEvaluation).mock.calls[0][0];
    expect(call.mode).toBe("inicial");
    expect(call.patientId).toBeNull();
    expect(call.consents.map((c) => c.type)).toEqual([
      "servicio",
      "datos_sensibles",
      "internacional_ia",
    ]);
    // sella version y hash canonicos vigentes
    expect(call.consents[0].consentVersion).toBe("1.2");
    expect(call.consents[0].documentHash).toHaveLength(64);
  });

  it("match exacto por documento -> seguimiento con el paciente existente", async () => {
    vi.mocked(intakeReads.findPatientByDocument).mockResolvedValue({ id: "pat-existente" });
    const res = await submitSurveyIntake(input());
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.mode).toBe("seguimiento");
    const call = vi.mocked(writer.writeIntakeEvaluation).mock.calls[0][0];
    expect(call.mode).toBe("seguimiento");
    expect(call.patientId).toBe("pat-existente");
  });

  it("registra las autorizaciones opcionales marcadas", async () => {
    vi.mocked(intakeReads.findPatientByDocument).mockResolvedValue(null);
    await submitSurveyIntake(
      input({ consent: { ...validConsent, investigacion: true } }),
    );
    const call = vi.mocked(writer.writeIntakeEvaluation).mock.calls[0][0];
    expect(call.consents.map((c) => c.type)).toContain("investigacion");
  });

  it("rechaza (validation) si falta una autorizacion necesaria; no escribe", async () => {
    const res = await submitSurveyIntake(
      input({ consent: { ...validConsent, internacional_ia: false } }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("validation");
    expect(writer.writeIntakeEvaluation).not.toHaveBeenCalled();
  });

  it("rechaza (validation) si no declara mayoria de edad; no escribe", async () => {
    const res = await submitSurveyIntake(
      input({ consent: { ...validConsent, mayoria_de_edad: false } }),
    );
    expect(res.ok).toBe(false);
    expect(writer.writeIntakeEvaluation).not.toHaveBeenCalled();
  });

  it("mapea ConsentGateError del escritor a un error de autorizacion", async () => {
    vi.mocked(intakeReads.findPatientByDocument).mockResolvedValue(null);
    vi.mocked(writer.writeIntakeEvaluation).mockRejectedValue(
      new writer.ConsentGateError(["internacional_ia"]),
    );
    const res = await submitSurveyIntake(input());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("forbidden");
  });

  it("expone candidatos a duplicado para que el profesional confirme", async () => {
    vi.mocked(intakeReads.findPatientByDocument).mockResolvedValue(null);
    vi.mocked(intakeReads.findDuplicateCandidates).mockResolvedValue([
      {
        patientId: "dup-1",
        firstName: "Maria",
        lastName: "Gomez",
        birthDate: "1990-05-10",
        documentType: "CE",
        documentNumber: "999",
      },
    ]);
    const res = await submitSurveyIntake(input());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.duplicateCandidates).toHaveLength(1);
      expect(res.value.duplicateCandidates[0].patientId).toBe("dup-1");
    }
  });

  it("consume el link de seguimiento (un solo uso); no el inicial", async () => {
    vi.mocked(intakeReads.findPatientByDocument).mockResolvedValue({ id: "pat-x" });
    // inicial: linkId null
    await submitSurveyIntake(input());
    expect(vi.mocked(writer.writeIntakeEvaluation).mock.calls[0][0].linkId).toBeNull();
    // seguimiento: linkId = id del link
    const followLink: SurveyLinkView = { ...initialLink, type: "seguimiento", patientId: "pat-x" };
    await submitSurveyIntake(input({ link: followLink }));
    expect(vi.mocked(writer.writeIntakeEvaluation).mock.calls[1][0].linkId).toBe("link-1");
  });
});
