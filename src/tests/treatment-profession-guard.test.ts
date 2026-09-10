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
// EL MOCK CONSERVA LOS ERRORES REALES (`importOriginal`): el servicio hace `e instanceof StaleProtocoloError`
// para traducir el rechazo de concurrencia, y con la clase mockeada esa rama revienta. Solo se sustituye la
// funcion que escribe.
vi.mock("@/modules/treatment/data/protocolo-writer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/treatment/data/protocolo-writer")>()),
  guardarProtocolo: vi.fn(async () => ({ guardadas: [] })),
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
  saveNutraceuticals as writeNutraceuticals,
} from "@/modules/treatment/data/treatment-writer";
import { guardarProtocolo as writeGuardarProtocolo } from "@/modules/treatment/data/protocolo-writer";
import { generateMenu } from "@/modules/treatment/services/generate-menu";
import {
  acknowledgeRestrictions,
  addNote,
  guardarProtocolo,
  saveNutraceuticals,
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

const NUTRA_INPUT = { evaluationId: "E1", nutraceuticals: [], baseSignature: "" };

// EL GUARDADO UNICO SUSTITUYE A LAS SEIS ESCRITURAS DE SECCION (2026-09-09). Antes cada una tenia su
// propio servicio y su propio caso aqui; ahora las siete viajan juntas, asi que el guard de profesion se
// comprueba UNA vez sobre el acto que existe. La garantia es la misma y mas estricta: si el guard fallara,
// fallaria para las siete a la vez y este caso lo ve.
const PROTOCOLO_INPUT = {
  evaluationId: "E1",
  editable: {
    ajustes: {
      adjGeb: null,
      adjPal: null,
      adjKcalObj: null,
      adjProtGkg: null,
      adjFatPct: null,
      adjDeficit: null,
      pesoMetaFijado: null,
    },
    objetivo: null,
    restricciones: [],
    intercambio: null,
    tiemposActivos: null,
    tiempos: null,
    menuSemanal: null,
  },
  firmas: {
    ajustes: "",
    objetivo: "",
    restricciones: "",
    intercambio: "",
    tiemposActivos: "",
    tiempos: "",
    menuSemanal: "",
  },
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

  it("guardarProtocolo: profesional sin profesión -> forbidden y no escribe NINGUNA sección", async () => {
    // LA GARANTIA QUE ESTE ARCHIVO PROTEGE, aplicada al acto que existe desde el 2026-09-09. Antes habia
    // seis casos, uno por seccion; ahora las siete viajan juntas y el guard se comprueba una vez. Es mas
    // estricto, no menos: si el guard fallara, fallaria para las siete a la vez.
    profOf.mockResolvedValueOnce(PRO_NULL);
    let r = await guardarProtocolo(PROTOCOLO_INPUT, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writeGuardarProtocolo).not.toHaveBeenCalled();

    profOf.mockResolvedValueOnce(PRO("nutricionista"));
    r = await guardarProtocolo(PROTOCOLO_INPUT, actor);
    expect(r.ok).toBe(true);
    expect(writeGuardarProtocolo).toHaveBeenCalledTimes(1);
  });

  it("guardarProtocolo: un NO-nutricionista (médico) tampoco escribe", async () => {
    // Q17: solo el nutricionista edita el protocolo nutricional. El medico tiene su propia vista, de
    // lectura, y sus propias notas.
    profOf.mockResolvedValueOnce(PRO("medico"));
    const r = await guardarProtocolo(PROTOCOLO_INPUT, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("forbidden");
    expect(writeGuardarProtocolo).not.toHaveBeenCalled();
  });

  it("guardarProtocolo: un NO-profesional (admin, sin perfil) NO cae en el guard y escribe", async () => {
    // El guard es de ambito de practica del PROFESIONAL; admin queda gobernado por su policy, no por
    // este guard (no le cambia lo que ya podia hacer via canManageTreatment).
    profOf.mockResolvedValueOnce(NOT_PRO);
    const r = await guardarProtocolo(PROTOCOLO_INPUT, actor);
    expect(r.ok).toBe(true);
    expect(writeGuardarProtocolo).toHaveBeenCalledTimes(1);
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
// Eran SIETE en la tabla aunque el titulo dijera seis; al retirar las guias dietarias (2026-09-01) quedan
// las seis reales, asi que el titulo y la tabla por fin dicen lo mismo.
// EL GUARD DE "PROTOCOLO YA APROBADO" SE RETIRO (2026-09-09), y con el las seis comprobaciones que este
// bloque afirmaba. No es que se relajara un candado: es que el estado que gateaba dejo de existir.
//
// POR QUE EXISTIA: aprobar CERRABA la prescripcion (el trigger congelaba la fila), asi que un guardado
// posterior chocaba contra la base y la pantalla se veia editable mientras el servidor rechazaba. El guard
// adelantaba ese rechazo con un mensaje legible. Servia para que la pantalla y el servidor no se
// contradijeran, no para proteger un dato.
//
// POR QUE YA NO: la prescripcion esta SIEMPRE abierta. Lo que conserva la constancia de lo entregado es la
// copia inmutable de cada emision (`prescription_emissions`), que no depende de que nadie deje de editar,
// y eso lo prueban `emitir-prescripcion-writer` y `treatment-immutability` contra base real.
//
// Y EL BLOQUE NO SE SUSTITUYE POR OTRO AQUI: lo que ahora hay que afirmar es que editar DESPUES de
// entregar SE PUEDE, y eso se comprueba contra la base (en `treatment-immutability`), no con mocks.

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
