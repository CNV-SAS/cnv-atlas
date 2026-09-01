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
  saveRestricciones: vi.fn(),
  saveGuidelines: vi.fn(),
  saveObjetivo: vi.fn(),
  saveIntercambio: vi.fn(),
  saveTiempos: vi.fn(),
  saveAdjustments: vi.fn(),
  saveNutraceuticals: vi.fn(),
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
  saveGuidelines as writeGuidelines,
  saveIntercambio as writeIntercambio,
  saveTiempos as writeTiempos,
  saveNutraceuticals as writeNutraceuticals,
  saveObjetivo as writeObjetivo,
  saveRestricciones as writeRestricciones,
} from "@/modules/treatment/data/treatment-writer";
import { generateMenu } from "@/modules/treatment/services/generate-menu";
import {
  acknowledgeRestrictions,
  addNote,
  saveAdjustments,
  saveGuidelines,
  saveIntercambio,
  saveTiempos,
  saveNutraceuticals,
  saveObjetivo,
  saveRestricciones,
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

const RESTR_INPUT = { evaluationId: "E1", restricciones: [], baseSignature: "" };
const GUIDE_INPUT = { evaluationId: "E1", guidelines: [], baseSignature: "" };
const OBJ_INPUT = { evaluationId: "E1", objetivo: "x", baseSignature: "" };
const INTER_INPUT = { evaluationId: "E1", intercambio: { objetivoBase: 2000, porciones: {} }, baseSignature: "" };
const TIEMPOS_INPUT = { evaluationId: "E1", tiempos: { activos: { desayuno: true }, celdas: {}, base: { porciones: {}, activos: {} } }, baseSignature: "" };
const NUTRA_INPUT = { evaluationId: "E1", nutraceuticals: [], baseSignature: "" };
const ADJ_INPUT = {
  evaluationId: "E1",
  adjGeb: null,
  adjPal: null,
  adjKcalObj: null,
  adjProtGkg: null,
  adjFatPct: null,
  adjPesoMeta: null,
  pesoMetaIngreso: null,
  baseSignature: "",
};

describe("guard de profesion: escrituras de tratamiento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readProtocol.mockResolvedValue(CONFIRMED);
    // DEFAULT (no `once`): el reader real SIEMPRE devuelve un objeto, nunca undefined. Los casos que
    // prueban el guard encolan su forma con `mockResolvedValueOnce`, que tiene prioridad; este default
    // es para las llamadas que NO encolan nada, como la de addNote. Sin el, addNote reventaba al
    // destructurar undefined y el test decia "el guard se le colo a la nota", que era falso.
    profOf.mockResolvedValue(NOT_PRO);
  });

  it("saveRestricciones: profesional sin profesion -> forbidden y no escribe; con profesion -> escribe", async () => {
    profOf.mockResolvedValueOnce(PRO_NULL);
    let r = await saveRestricciones(RESTR_INPUT, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writeRestricciones).not.toHaveBeenCalled();

    profOf.mockResolvedValueOnce(PRO("nutricionista"));
    r = await saveRestricciones(RESTR_INPUT, actor);
    expect(r.ok).toBe(true);
    expect(writeRestricciones).toHaveBeenCalledTimes(1);
  });

  it("saveRestricciones: un NO-profesional (admin, sin perfil) NO cae en el guard y escribe", async () => {
    // El guard es de ambito de practica del profesional; admin queda gobernado por su policy, no
    // por este guard (no le cambia lo que ya podia hacer via canManageTreatment).
    profOf.mockResolvedValueOnce(NOT_PRO);
    const r = await saveRestricciones(RESTR_INPUT, actor);
    expect(r.ok).toBe(true);
    expect(writeRestricciones).toHaveBeenCalledTimes(1);
  });

  it("saveGuidelines: profesional sin profesion -> forbidden; con profesion -> escribe", async () => {
    profOf.mockResolvedValueOnce(PRO_NULL);
    let r = await saveGuidelines(GUIDE_INPUT, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writeGuidelines).not.toHaveBeenCalled();

    profOf.mockResolvedValueOnce(PRO("nutricionista"));
    r = await saveGuidelines(GUIDE_INPUT, actor);
    expect(r.ok).toBe(true);
    expect(writeGuidelines).toHaveBeenCalledTimes(1);
  });

  it("saveObjetivo: profesional sin profesion -> forbidden; con profesion -> escribe", async () => {
    profOf.mockResolvedValueOnce(PRO_NULL);
    let r = await saveObjetivo(OBJ_INPUT, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writeObjetivo).not.toHaveBeenCalled();

    profOf.mockResolvedValueOnce(PRO("nutricionista"));
    r = await saveObjetivo(OBJ_INPUT, actor);
    expect(r.ok).toBe(true);
    expect(writeObjetivo).toHaveBeenCalledTimes(1);
  });

  it("saveAdjustments: NO-nutricionista (medico) -> forbidden y no escribe; nutricionista -> escribe", async () => {
    profOf.mockResolvedValueOnce(PRO("medico")); // Q17: solo nutricionista aprueba/edita el protocolo nutricional
    let r = await saveAdjustments(ADJ_INPUT, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writeAdjustments).not.toHaveBeenCalled();

    profOf.mockResolvedValueOnce(PRO("nutricionista"));
    r = await saveAdjustments(ADJ_INPUT, actor);
    expect(r.ok).toBe(true);
    expect(writeAdjustments).toHaveBeenCalledTimes(1);
  });

  it("saveTiempos: profesional sin profesion -> forbidden; con profesion -> escribe", async () => {
    profOf.mockResolvedValueOnce(PRO_NULL);
    let r = await saveTiempos(TIEMPOS_INPUT, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writeTiempos).not.toHaveBeenCalled();

    profOf.mockResolvedValueOnce(PRO("nutricionista"));
    r = await saveTiempos(TIEMPOS_INPUT, actor);
    expect(r.ok).toBe(true);
    expect(writeTiempos).toHaveBeenCalledTimes(1);
  });

  it("saveNutraceuticals: NO-nutricionista (medico) -> forbidden y no escribe; nutricionista -> escribe", async () => {
    profOf.mockResolvedValueOnce(PRO("medico")); // solo el nutricionista prescribe nutraceuticos
    let r = await saveNutraceuticals(NUTRA_INPUT, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writeNutraceuticals).not.toHaveBeenCalled();

    profOf.mockResolvedValueOnce(PRO("nutricionista"));
    r = await saveNutraceuticals(NUTRA_INPUT, actor);
    expect(r.ok).toBe(true);
    expect(writeNutraceuticals).toHaveBeenCalledTimes(1);
  });

  it("saveIntercambio: NO-nutricionista (medico) -> forbidden y no escribe; nutricionista -> escribe", async () => {
    profOf.mockResolvedValueOnce(PRO("medico")); // solo el nutricionista edita el plan nutricional
    let r = await saveIntercambio(INTER_INPUT, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writeIntercambio).not.toHaveBeenCalled();

    profOf.mockResolvedValueOnce(PRO("nutricionista"));
    r = await saveIntercambio(INTER_INPUT, actor);
    expect(r.ok).toBe(true);
    expect(writeIntercambio).toHaveBeenCalledTimes(1);
  });

  it("acknowledgeRestrictions: sin profesion -> forbidden y no escribe; con profesion -> escribe", async () => {
    profOf.mockResolvedValueOnce(PRO_NULL);
    let r = await acknowledgeRestrictions({ evaluationId: "E1" }, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writeAcknowledge).not.toHaveBeenCalled();

    profOf.mockResolvedValueOnce(PRO("nutricionista"));
    r = await acknowledgeRestrictions({ evaluationId: "E1" }, actor);
    expect(r.ok).toBe(true);
    expect(writeAcknowledge).toHaveBeenCalledTimes(1);
  });

  it("addNote NO esta gateada por profesion (es documentacion, no prescripcion): sin profesion igual escribe", async () => {
    // Decision explicita: la nota clinica es documentacion, no un acto de prescripcion. Un profesional
    // sin profesion configurada igual puede documentar; el guard cubre solo las cinco escrituras que
    // crean o producen la prescripcion. Si esto cambia a forbidden, se rompio la decision.
    //
    // EL COMENTARIO DECIA "addNote NO llama a getActorProfession", y desde el 2026-08-31 SI la llama:
    // no para gatear, sino para SELLAR con que rol se escribio (Gildardo §8, una nota por profesion).
    // Por eso este caso ahora afirma algo mas fuerte que antes: la lee Y NO la usa como puerta.
    const r = await addNote({ evaluationId: "E1", note: "hola" }, actor);
    expect(r.ok).toBe(true);
    expect(addTreatmentNote).toHaveBeenCalledTimes(1);
  });
});

// Guard de SERVIDOR contra editar un protocolo APROBADO (2026-08-22). Antes solo la UI lo bloqueaba; con dos
// pestañas era alcanzable por accidente. Las SEIS escrituras de seccion deben rechazar con conflict cuando el
// protocolo ya fue aprobado, sin tocar el writer. (acknowledgeRestrictions y addNote NO se bloquean: son
// legitimos post-aprobacion; se cubren en sus propios casos.)
describe("guard de aprobado: las seis escrituras de seccion rechazan si el protocolo ya fue aprobado", () => {
  const APPROVED = { treatmentId: "T1", diagnosisConfirmed: true, approved: true } as unknown as TreatmentProtocol;
  beforeEach(() => {
    vi.clearAllMocks();
    readProtocol.mockResolvedValue(APPROVED);
    profOf.mockResolvedValue(PRO("nutricionista")); // pasa el guard de profesion; lo frena el de aprobado
  });

  const casos: [string, () => Promise<{ ok: boolean; error?: { code: string } }>, unknown][] = [
    ["saveRestricciones", () => saveRestricciones(RESTR_INPUT, actor), writeRestricciones],
    ["saveGuidelines", () => saveGuidelines(GUIDE_INPUT, actor), writeGuidelines],
    ["saveObjetivo", () => saveObjetivo(OBJ_INPUT, actor), writeObjetivo],
    ["saveIntercambio", () => saveIntercambio(INTER_INPUT, actor), writeIntercambio],
    ["saveTiempos", () => saveTiempos(TIEMPOS_INPUT, actor), writeTiempos],
    ["saveNutraceuticals", () => saveNutraceuticals(NUTRA_INPUT, actor), writeNutraceuticals],
    ["saveAdjustments", () => saveAdjustments(ADJ_INPUT, actor), writeAdjustments],
  ];
  for (const [name, call, writer] of casos) {
    it(`${name}: protocolo aprobado -> conflict y NO escribe`, async () => {
      const r = await call();
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error?.code).toBe("conflict");
      expect(writer).not.toHaveBeenCalled();
    });
  }
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
