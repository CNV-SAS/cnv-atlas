import { beforeEach, describe, expect, it, vi } from "vitest";

// Guard interino de ambito de practica (T2b, 2026-07-30) EN AISLAMIENTO. Ninguna escritura del
// tratamiento procede si el PROFESIONAL no tiene profesion configurada (profession = null): es la
// unica defensa a NIVEL DE ACCION (las server actions se invocan sin pasar por la UI, ocultar la
// subpestana no basta). Por operacion, positivo y negativo: profesion configurada PASA el guard
// (llega al writer o al siguiente gate); null FALLA (forbidden) y NO toca el writer.
//
// El guard aplica SOLO al profesional: un actor sin perfil profesional (isProfessional=false, p.
// ej. admin) NO cae aqui (su permiso lo gobierna la policy de la action; gobernanza aparte). Se
// prueba explicitamente.
//
// Alcance deliberado: solo se distingue null de no-null. La matriz "que profesion puede aprobar
// que protocolo" es gobernanza clinica (Gildardo Q17, BACKLOG), fuera de este guard y este test.
//
// approveProtocol tiene su propio caso null en treatment-approve-authz.test.ts (ya arma el
// SUGGESTED real); aqui se cubren las otras cinco escrituras.

vi.mock("server-only", () => ({}));
vi.mock("@/modules/treatment/data/actor-profession-reader", () => ({
  getActorProfession: vi.fn(),
}));
vi.mock("@/modules/treatment/data/treatment-reader", () => ({
  getTreatmentProtocol: vi.fn(),
  getTreatmentForApproval: vi.fn(),
}));
vi.mock("@/modules/treatment/data/treatment-writer", () => ({
  saveProtocol: vi.fn(),
  saveAdjustments: vi.fn(),
  acknowledgeRestrictions: vi.fn(),
  addTreatmentNote: vi.fn(),
  writeApproveProtocol: vi.fn(),
  TreatmentStateError: class TreatmentStateError extends Error {},
}));
vi.mock("@/modules/diagnoses/data/results-reader", () => ({
  getEvaluationResults: vi.fn(),
}));
vi.mock("@/modules/treatment/data/menu-writer", () => ({
  recordMenuSuggestion: vi.fn(),
}));

import { getEvaluationResults } from "@/modules/diagnoses/data/results-reader";
import { getActorProfession } from "@/modules/treatment/data/actor-profession-reader";
import { recordMenuSuggestion } from "@/modules/treatment/data/menu-writer";
import {
  getTreatmentProtocol,
  type TreatmentProtocol,
} from "@/modules/treatment/data/treatment-reader";
import {
  addTreatmentNote,
  acknowledgeRestrictions as writeAcknowledge,
  saveAdjustments as writeAdjustments,
  saveProtocol as writeProtocol,
} from "@/modules/treatment/data/treatment-writer";
import { generateMenu } from "@/modules/treatment/services/generate-menu";
import {
  acknowledgeRestrictions,
  addNote,
  saveAdjustments,
  saveProtocol,
} from "@/modules/treatment/services/treatment-service";

const profOf = vi.mocked(getActorProfession);
const readProtocol = vi.mocked(getTreatmentProtocol);

// Formas de actor que devuelve el reader: profesional con/sin profesion, y no-profesional (admin).
const PRO = (profession: string) => ({ isProfessional: true, profession });
const PRO_NULL = { isProfessional: true, profession: null };
const NOT_PRO = { isProfessional: false, profession: null };

const actor = { actorId: "user-x", actorEmail: "x@cnv", ip: null };
// El servicio solo lee treatmentId + diagnosisConfirmed en estas ops; el resto no se toca.
const CONFIRMED = { treatmentId: "T1", diagnosisConfirmed: true } as unknown as TreatmentProtocol;

const SAVE_INPUT = {
  evaluationId: "E1",
  kcalObjetivo: null,
  proteinaGramos: null,
  restricciones: [],
  nutraceuticals: [],
  guidelines: [],
};
const ADJ_INPUT = {
  evaluationId: "E1",
  adjGeb: null,
  adjPal: null,
  adjKcalObj: null,
  adjProtGkg: null,
  adjFatPct: null,
  adjPesoMeta: null,
};

describe("guard de profesion: escrituras de tratamiento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readProtocol.mockResolvedValue(CONFIRMED);
  });

  it("saveProtocol: profesional sin profesion -> forbidden y no escribe; con profesion -> escribe", async () => {
    profOf.mockResolvedValueOnce(PRO_NULL);
    let r = await saveProtocol(SAVE_INPUT, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writeProtocol).not.toHaveBeenCalled();

    profOf.mockResolvedValueOnce(PRO("nutricionista"));
    r = await saveProtocol(SAVE_INPUT, actor);
    expect(r.ok).toBe(true);
    expect(writeProtocol).toHaveBeenCalledTimes(1);
  });

  it("saveProtocol: un NO-profesional (admin, sin perfil) NO cae en el guard y escribe", async () => {
    // El guard es de ambito de practica del profesional; admin queda gobernado por su policy, no
    // por este guard (no le cambia lo que ya podia hacer via canManageTreatment).
    profOf.mockResolvedValueOnce(NOT_PRO);
    const r = await saveProtocol(SAVE_INPUT, actor);
    expect(r.ok).toBe(true);
    expect(writeProtocol).toHaveBeenCalledTimes(1);
  });

  it("saveAdjustments: sin profesion -> forbidden y no escribe; con profesion -> escribe", async () => {
    profOf.mockResolvedValueOnce(PRO_NULL);
    let r = await saveAdjustments(ADJ_INPUT, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writeAdjustments).not.toHaveBeenCalled();

    profOf.mockResolvedValueOnce(PRO("medico"));
    r = await saveAdjustments(ADJ_INPUT, actor);
    expect(r.ok).toBe(true);
    expect(writeAdjustments).toHaveBeenCalledTimes(1);
  });

  it("acknowledgeRestrictions: sin profesion -> forbidden y no escribe; con profesion -> escribe", async () => {
    profOf.mockResolvedValueOnce(PRO_NULL);
    let r = await acknowledgeRestrictions({ evaluationId: "E1" }, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writeAcknowledge).not.toHaveBeenCalled();

    profOf.mockResolvedValueOnce(PRO("psicologo"));
    r = await acknowledgeRestrictions({ evaluationId: "E1" }, actor);
    expect(r.ok).toBe(true);
    expect(writeAcknowledge).toHaveBeenCalledTimes(1);
  });

  it("addNote: sin profesion -> forbidden y no escribe; con profesion -> escribe", async () => {
    profOf.mockResolvedValueOnce(PRO_NULL);
    let r = await addNote({ evaluationId: "E1", note: "hola" }, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(addTreatmentNote).not.toHaveBeenCalled();

    profOf.mockResolvedValueOnce(PRO("deportologo"));
    r = await addNote({ evaluationId: "E1", note: "hola" }, actor);
    expect(r.ok).toBe(true);
    expect(addTreatmentNote).toHaveBeenCalledTimes(1);
  });
});

describe("guard de profesion: generateMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // diagnostico SIN confirmar: con profesion configurada, el guard pasa y frena en el gate de
    // confirmado (conflict). Asi se distingue "paso el guard" de "lo freno el guard" sin montar la IA.
    readProtocol.mockResolvedValue({
      treatmentId: "T1",
      diagnosisConfirmed: false,
    } as unknown as TreatmentProtocol);
    vi.mocked(getEvaluationResults).mockResolvedValue({
      snapshot: {},
    } as unknown as Awaited<ReturnType<typeof getEvaluationResults>>);
  });

  it("sin profesion -> forbidden; con profesion -> pasa el guard (frena en confirmado), sin persistir sugerencia", async () => {
    profOf.mockResolvedValueOnce(PRO_NULL);
    let r = await generateMenu("E1", actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");

    profOf.mockResolvedValueOnce(PRO("nutricionista"));
    r = await generateMenu("E1", actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("conflict");
    expect(recordMenuSuggestion).not.toHaveBeenCalled();
  });
});
