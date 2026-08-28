import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// CANDADO DEL CABLEADO del guard de revocacion a media sesion.
//
// POR QUE HACE FALTA APARTE. `consent-revocation.test.ts` prueba que `closeAwaitingIfConsentRevoked`
// FUNCIONA: cierra la evaluacion, audita sin actor, es idempotente. Pero el hueco original NO era que la
// funcion estuviera mal, era que NADIE PREGUNTABA: el gate corria al crear la evaluacion y despues los dos
// escritores de la fase 2 escribian sin volver a mirar. Si alguien quita la llamada de `survey-intake`, el
// hueco vuelve exactamente igual y aquel candado sigue verde.
//
// Asi que esto no prueba la funcion: prueba los DOS SITIOS DE LLAMADA, que es donde vivia el defecto.

const closeAwaitingIfConsentRevoked = vi.fn();
const saveSurveyProgress = vi.fn(async () => ({ evaluationId: "ev-1" }));
const completeSurvey = vi.fn(async () => ({ evaluationId: "ev-1" }));

vi.mock("@/modules/evaluations/data/intake-writer", () => ({
  closeAwaitingIfConsentRevoked,
  saveSurveyProgress,
  completeSurvey,
  getSurveyProgress: vi.fn(),
  getResumeTokenStatus: vi.fn(),
  signIntakeEvaluation: vi.fn(),
  ConsentGateError: class ConsentGateError extends Error {},
  ResumeTokenError: class ResumeTokenError extends Error {},
}));

const ENTRADA = {
  resumeToken: "token-x",
  surveyVersionId: "11111111-1111-1111-1111-111111111111",
  answers: [],
  ipAddress: null,
  characterization: null,
};

describe("guard de revocacion a media sesion: los dos sitios de llamada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveSurveyProgress.mockResolvedValue({ evaluationId: "ev-1" });
    completeSurvey.mockResolvedValue({ evaluationId: "ev-1" });
  });

  it("GUARDAR PROGRESO pregunta ANTES de escribir, y si revoco no escribe nada nuevo", async () => {
    const { saveProgress, CONSENT_REVOKED_DURING_SURVEY } = await import(
      "@/modules/evaluations/services/survey-intake"
    );
    closeAwaitingIfConsentRevoked.mockResolvedValue({ bloqueada: true });

    const r = await saveProgress(ENTRADA);

    expect(closeAwaitingIfConsentRevoked).toHaveBeenCalledWith("token-x", null);
    expect(saveSurveyProgress).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.message).toBe(CONSENT_REVOKED_DURING_SURVEY);
  });

  it("COMPLETAR pregunta ANTES de escribir, y si revoco no completa", async () => {
    const { submitSurveyAnswers, CONSENT_REVOKED_DURING_SURVEY } = await import(
      "@/modules/evaluations/services/survey-intake"
    );
    closeAwaitingIfConsentRevoked.mockResolvedValue({ bloqueada: true });

    const r = await submitSurveyAnswers(ENTRADA);

    expect(closeAwaitingIfConsentRevoked).toHaveBeenCalledWith("token-x", null);
    expect(completeSurvey).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.message).toBe(CONSENT_REVOKED_DURING_SURVEY);
  });

  it("SIN revocacion no estorba: los dos siguen escribiendo como siempre", async () => {
    const { saveProgress, submitSurveyAnswers } = await import(
      "@/modules/evaluations/services/survey-intake"
    );
    closeAwaitingIfConsentRevoked.mockResolvedValue({ bloqueada: false });

    expect((await saveProgress(ENTRADA)).ok).toBe(true);
    expect(saveSurveyProgress).toHaveBeenCalledOnce();
    expect((await submitSurveyAnswers(ENTRADA)).ok).toBe(true);
    expect(completeSurvey).toHaveBeenCalledOnce();
  });
});

describe("el mensaje al paciente", () => {
  it("lleva las TRES piezas: reconoce el acto, explica la consecuencia y da la salida", async () => {
    const { CONSENT_REVOKED_DURING_SURVEY: m } = await import(
      "@/modules/evaluations/services/survey-intake"
    );
    // Reconoce: le habla de lo que EL hizo, no de un fallo del sistema.
    expect(m).toContain("Retiraste tu autorización");
    // Consecuencia: que pasa con lo que ya escribio. Es la mitad que mas tranquiliza y la que mas se omite.
    expect(m).toContain("se conserva y no se usará");
    // Salida: a donde va si cambia de opinion.
    expect(m).toContain("habla con tu profesional");
    // Y lo que NO puede decir: nada de error, fallo ni enlace invalido. Ejercer un derecho no es un fallo.
    expect(m.toLowerCase()).not.toMatch(/error|fall|inválid|invalid/);
  });
});
