import { beforeEach, describe, expect, it, vi } from "vitest";

// Checkpoint 2.2: el menu ya NO lee el objetivo GUARDADO (protocol.kcalObjetivo), que se colapso; lee el
// objetivo EFECTIVO de la cadena calorica (computeProtocoloEfectivo sobre el snapshot + ajustes, la misma
// funcion que sella la aprobacion). Este test blinda el cuidado: si alguien dejara el menu apuntando al
// campo muerto (que ahora queda null en borrador), generaria sobre cero. Se prueba con el objetivo
// guardado en un valor ABSURDO (9999) y un snapshot valido: el menu debe usar el de la cadena (2503), no 9999.

vi.mock("server-only", () => ({}));
// isEngineOutput mockeado a true (no armar un diagnostico completo); computeProtocoloEfectivo queda REAL.
vi.mock("@/clinical-engine", async (orig) => ({
  ...(await orig<typeof import("@/clinical-engine")>()),
  isEngineOutput: () => true,
}));
// buildMenuPrompt: se captura su input (lo que importa) y devuelve mensajes cualquiera. vi.hoisted para
// que el factory de vi.mock (que se iza al top) pueda referenciarlo sin caer en el TDZ del const.
const { buildMenuPrompt } = vi.hoisted(() => ({
  buildMenuPrompt: vi.fn((input: { kcalObjetivo: number; proteinaGramos: number }) => {
    void input; // solo se necesita para tipar mock.calls; el cuerpo no lo usa
    return [{ role: "system", content: "s" }] as unknown as never;
  }),
}));
// CONTRATO v4 (2026-08-29): la IA ADAPTA en vez de componer, asi que el mock sigue al contrato nuevo.
vi.mock("@/modules/treatment/ai/prompts/menu.v4", () => ({
  buildMenuAdaptarPrompt: buildMenuPrompt,
  MENU_PROMPT_KEY: "menu.adapt",
  MENU_PROMPT_VERSION: 4,
  // El parser real es estricto a proposito; aqui devuelve una forma valida minima para que el test
  // siga midiendo lo suyo (que el objetivo sale de la cadena) y no el contrato de la IA.
  parseCambiosMenu: vi.fn(() => ({ cambios: [] })),
  verificarCita: vi.fn(() => true),
}));
// El generador lee la encuesta para las alergias y el patron alimentario (3.2). Sin este mock, la
// lectura real intenta abrir una sesion de Supabase fuera de un request y tumba el test.
vi.mock("@/modules/evaluations/data/survey-answers-reader", () => ({
  getSurveyAnswersForEvaluation: vi.fn(async () => [
    { section: "Alergias y digestión", questions: [{ fieldKey: "d6_43", answerValue: JSON.stringify(["Ninguna"]) }] },
  ]),
}));
vi.mock("@/lib/ai/provider", () => ({
  AiError: class AiError extends Error {},
  generateText: vi.fn(async () => ({ provider: "groq", model: "m", text: "menu", latencyMs: 1 })),
}));
vi.mock("@/lib/ai/config", () => ({ resolveAiConfig: vi.fn(async () => ({ provider: "groq", model: "m", source: "env" })) }));
vi.mock("@/lib/ai/prompts", () => ({ getActivePrompt: vi.fn(async () => null) }));
vi.mock("@/lib/observability/report-error", () => ({ reportServerError: vi.fn() }));
vi.mock("@/modules/treatment/data/menu-writer", () => ({ recordMenuSuggestion: vi.fn(async () => {}) }));
vi.mock("@/modules/treatment/services/require-profession", () => ({
  requireNutricionista: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/modules/treatment/data/treatment-reader", () => ({ getTreatmentProtocol: vi.fn() }));
// LA PRESCRIPCION DEL MOTOR QUE GOBIERNA (2026-08-31): `generateMenu` la lee para armar las restricciones
// del prompt, en vez de tomarlas del snapshot sellado (que las computa con el motor que NO gobierna: a un
// hipertenso le mandaba "Sodio < 2300" al generador). Se mockea con el caso del hipertenso, que es el que
// hizo visible el defecto, para que el prompt de estos tests lleve lo que de verdad lleva en produccion.
vi.mock("@/modules/treatment/data/dieta-resumen-reader", () => ({
  getPrescripcionNutricional: vi.fn(async () => ({
    tipoEnergia: "Hipocalórica",
    protKg: 1.3,
    protG: 91,
    sodioMax: 1500,
    filas: [{ nombre: "Sodio", valor: "< 1.500 mg/día", ref: "OMS; DASH/NHLBI; AHA/ACC 2025" }],
    limites: [{ nombre: "Sodio", valor: "< 1.500 mg/día", ref: "OMS; DASH/NHLBI; AHA/ACC 2025" }],
    atributos: ["Hiposódica (<1.500 mg Na)", "Patrón DASH"],
    notas: [],
    referencias: ["OMS; DASH/NHLBI; AHA/ACC 2025"],
  })),
}));
vi.mock("@/modules/diagnoses/data/results-reader", () => ({ getEvaluationResults: vi.fn() }));

import { getEvaluationResults } from "@/modules/diagnoses/data/results-reader";
import { getPrescripcionNutricional } from "@/modules/treatment/data/dieta-resumen-reader";
import { getTreatmentProtocol } from "@/modules/treatment/data/treatment-reader";
import { generateMenu } from "@/modules/treatment/services/generate-menu";

const readProtocol = vi.mocked(getTreatmentProtocol);
const readResults = vi.mocked(getEvaluationResults);

// Snapshot minimo para computeProtocoloEfectivo: ffm 60 -> GEB round(500+22*60)=1820; PAL 1.375 ->
// GET round(1820*1.375)=2503; deficit 0 -> kcalObj 2503; protG round(0.8*70)=56.
const SNAP = {
  pesoCalculo: 70,
  estrategia: { deficit: 0 },
  protMin: 0.8,
  caloricoInputs: { ffm: 60, talla: 175, edad: 30, sexoM: true },
} as unknown as NonNullable<Awaited<ReturnType<typeof getTreatmentProtocol>>>["protocolSuggested"];

describe("generateMenu: el objetivo sale de la cadena, no del campo guardado (checkpoint 2.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readProtocol.mockResolvedValue({
      treatmentId: "T1",
      diagnosisConfirmed: true,
      // Campo VIEJO en un valor absurdo: si el menu lo leyera, generaria sobre 9999 (o null en la practica).
      kcalObjetivo: 9999,
      proteinaGramos: 8888,
      // CON UNA RESTRICCION: desde el contrato v4 la IA solo entra si hay alguna (su §13). Sin esto el
      // gate corta antes de armar el prompt, y este test dejaria de medir lo suyo.
      restricciones: ["Sin gluten"],
      protocolSuggested: SNAP,
      adjGeb: null,
      adjPal: null,
      adjKcalObj: null,
      adjProtGkg: null,
      adjFatPct: null,
      adjPesoMeta: null,
    } as unknown as Awaited<ReturnType<typeof getTreatmentProtocol>>);
    readResults.mockResolvedValue({
      snapshot: { structural: { nombre: "F" }, frSector: { nombre: "S" }, dfi: { rutas: [] } },
    } as unknown as Awaited<ReturnType<typeof getEvaluationResults>>);
  });

  it("usa el objetivo EFECTIVO de la cadena (2503/56), no el guardado (9999/8888)", async () => {
    const r = await generateMenu("E1", { actorId: "u", actorEmail: "x@cnv", ip: null });
    expect(r.ok).toBe(true);
    expect(buildMenuPrompt).toHaveBeenCalledTimes(1);
    const input = buildMenuPrompt.mock.calls[0]![0];
    expect(input.kcalObjetivo).toBe(2503); // de la cadena, no 9999
    expect(input.proteinaGramos).toBe(56); // de la cadena, no 8888
  });

  it("sin snapshot sellado -> no genera (guarda defensiva contra el null-deref, no gate de 'objetivo')", async () => {
    readProtocol.mockResolvedValue({
      treatmentId: "T1",
      diagnosisConfirmed: true,
      kcalObjetivo: 9999,
      proteinaGramos: 8888,
      restricciones: [],
      protocolSuggested: null,
    } as unknown as Awaited<ReturnType<typeof getTreatmentProtocol>>);
    const r = await generateMenu("E1", { actorId: "u", actorEmail: "x@cnv", ip: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("conflict");
    expect(buildMenuPrompt).not.toHaveBeenCalled();
  });
});

describe("la IA solo entra si hay restricciones (su §13)", () => {
  // LIMPIAR LOS MOCKS AQUI TAMBIEN, y no es ceremonia: `beforeEach` se aplica al describe donde se
  // declara, asi que sin esto `buildMenuPrompt.mock.calls[0]` devuelve la llamada de un test de OTRO
  // describe, y la asercion mide el caso equivocado. Me paso escribiendo esto.
  beforeEach(() => vi.clearAllMocks());

  it("SIN ninguna restricción no llama al modelo, y lo dice", async () => {
    // Su instrucción literal: "la IA solo lo adapta CUANDO HAY RESTRICCIONES". Sin ninguna, el ciclo YA es
    // el menú correcto; llamar al modelo solo abriría la puerta a que cambie algo que no había que cambiar.
    readProtocol.mockResolvedValue({
      treatmentId: "T1",
      diagnosisConfirmed: true,
      restricciones: [],
      protocolSuggested: { ...SNAP, restricciones: [] },
      adjGeb: null, adjPal: null, adjKcalObj: null, adjProtGkg: null, adjFatPct: null, adjPesoMeta: null,
    } as unknown as Awaited<ReturnType<typeof getTreatmentProtocol>>);
    // Y el MOTOR tampoco devuelve ninguna: desde el 2026-08-31 el gate lo decide `motorTratNutri`, no el
    // snapshot. Este es el paciente sin comorbilidad y con composicion normal, para el que su motor no
    // fija limites ni atributos (verificado ejecutandolo). La proteina objetivo NO cuenta: es una meta,
    // no un limite, y contarla abriria el gate para todos.
    vi.mocked(getPrescripcionNutricional).mockResolvedValueOnce({
      tipoEnergia: "Normocalórica",
      protKg: 1,
      protG: 70,
      sodioMax: null,
      filas: [{ nombre: "Proteína", valor: "1 g/kg", ref: "ANI BIS-E" }],
      limites: [],
      atributos: [],
      notas: [],
      referencias: [],
    });

    const r = await generateMenu("E1", { actorId: "u", actorEmail: "x@cnv", ip: null });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe("sin_restricciones");
    // Y no se armó prompt: no hubo llamada que hacer.
    expect(buildMenuPrompt).not.toHaveBeenCalled();
  });

  it("con el PATRÓN declarado como única fuente, SÍ entra", async () => {
    // Las tres fuentes cuentan por igual. Si esta se cayera, a un vegano sin más restricciones se le diría
    // "no hay nada que adaptar" mientras el ciclo le propone carne.
    readProtocol.mockResolvedValue({
      treatmentId: "T1",
      diagnosisConfirmed: true,
      restricciones: [],
      protocolSuggested: { ...SNAP, restricciones: [] },
      adjGeb: null, adjPal: null, adjKcalObj: null, adjProtGkg: null, adjFatPct: null, adjPesoMeta: null,
    } as unknown as Awaited<ReturnType<typeof getTreatmentProtocol>>);
    const { getSurveyAnswersForEvaluation } = await import(
      "@/modules/evaluations/data/survey-answers-reader"
    );
    vi.mocked(getSurveyAnswersForEvaluation).mockResolvedValueOnce([
      { section: "Dieta", questions: [{ fieldKey: "d4_34", answerValue: JSON.stringify(["Vegetariano"]) }] },
    ] as unknown as Awaited<ReturnType<typeof getSurveyAnswersForEvaluation>>);

    const r = await generateMenu("E1", { actorId: "u", actorEmail: "x@cnv", ip: null });
    expect(r.ok).toBe(true);
    expect(buildMenuPrompt).toHaveBeenCalledTimes(1);
  });
});

describe("lo que se adapta es la semana que el profesional TIENE DELANTE", () => {
  // LIMPIAR LOS MOCKS AQUI TAMBIEN, y no es ceremonia: `beforeEach` se aplica al describe donde se
  // declara, asi que sin esto `buildMenuPrompt.mock.calls[0]` devuelve la llamada de un test de OTRO
  // describe, y la asercion mide el caso equivocado. Me paso escribiendo esto.
  beforeEach(() => vi.clearAllMocks());

  it("el prompt lleva la base con las ediciones del profesional, no el ciclo crudo", async () => {
    // Si se mandara el ciclo crudo, la IA propondría sustituir celdas que en pantalla dicen otra cosa: una
    // propuesta clínica sobre un dato falso. El cálculo es el MISMO que usa la grilla (`semanaEfectiva`).
    readProtocol.mockResolvedValue({
      treatmentId: "T1",
      diagnosisConfirmed: true,
      restricciones: ["Sin gluten"],
      protocolSuggested: SNAP,
      menuSemanal: { diaInicio: 0, celdas: { "0_desayuno": "LO QUE ESCRIBIO EL PROFESIONAL" } },
      adjGeb: null, adjPal: null, adjKcalObj: null, adjProtGkg: null, adjFatPct: null, adjPesoMeta: null,
    } as unknown as Awaited<ReturnType<typeof getTreatmentProtocol>>);

    const r = await generateMenu("E1", { actorId: "u", actorEmail: "x@cnv", ip: null });
    expect(r.ok).toBe(true);
    const input = buildMenuPrompt.mock.calls[0]![0] as unknown as {
      base: { dia: number; tiempo: string; texto: string }[];
    };
    const celda = input.base.find((c) => c.dia === 0 && c.tiempo === "desayuno");
    expect(celda?.texto).toBe("LO QUE ESCRIBIO EL PROFESIONAL");
    // Y el resto de la semana sí sale del ciclo.
    expect(input.base.length).toBeGreaterThan(20);
  });
});
