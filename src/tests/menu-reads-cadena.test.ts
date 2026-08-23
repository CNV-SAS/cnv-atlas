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
vi.mock("@/modules/treatment/ai/prompts/menu.v2", () => ({
  buildMenuPrompt,
  MENU_PROMPT_KEY: "menu.generate",
  MENU_PROMPT_VERSION: 2,
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
vi.mock("@/modules/diagnoses/data/results-reader", () => ({ getEvaluationResults: vi.fn() }));

import { getEvaluationResults } from "@/modules/diagnoses/data/results-reader";
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
      restricciones: [],
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
