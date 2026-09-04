import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks de las dependencias del servicio: las lecturas service-role del intake y el
// escritor transaccional (server-only, tocan BD). Asi se prueba la orquestacion de la
// FIRMA (validacion, resolucion de identidad, sellado de consentimiento, verificacion
// del codigo, mapeo del gate) sin base de datos. El alias "@" lo resuelve vitest.config.
//
// Reorganizacion del intake (2026-08-10): el flujo atomico viejo (submitSurveyIntake ->
// writeIntakeEvaluation) se retiro. La preparacion comun (resolveSignedIntake) que este
// test ejercita vive ahora bajo signSurveyIntake, que crea el shell firmado via
// signIntakeEvaluation; las respuestas son otra fase (fase 2, cubierta por el test de BD real).
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
  return { signIntakeEvaluation: vi.fn(), ConsentGateError };
});

// Firma electronica (B7): el servicio verifica el codigo antes de crear nada. Se mockea el servicio
// OTP (server-only + Redis) para probar la orquestacion sin Upstash; por defecto devuelve 'ok'.
vi.mock("@/modules/consent/otp/otp-service", () => ({
  verifyOtp: vi.fn(),
  consumeOtp: vi.fn(),
}));

import * as intakeReads from "@/modules/patients/data/patients-intake";
import * as writer from "@/modules/evaluations/data/intake-writer";
import * as otp from "@/modules/consent/otp/otp-service";
import { signSurveyIntake } from "@/modules/evaluations/services/survey-intake";
import type { SurveyLinkView } from "@/modules/evaluations/types";

const okOtp = {
  status: "ok" as const,
  meta: {
    channel: "email" as const,
    maskedDestination: "m***@example.com",
    sentAt: 1_700_000_000_000,
  },
};

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
  aceptacion_medio_electronico: true,
  mayoria_de_edad: true,
};

const validIdentity = {
  documentType: "CC",
  documentNumber: "1234567",
  firstName: "Maria",
  lastName: "Gomez",
  birthDate: "1990-05-10",
  sex: "F", // obligatorio y exacto F/M (el motor lo exige)
  // PAIS Y CIUDAD OBLIGATORIOS desde el 2026-09-04. Entraron al fixture porque sin ellos NINGUN caso de
  // este archivo pasa, que es la señal de que el requisito muerde de verdad y no solo en su propio test.
  country: "Colombia",
  city: "Medellín",
};

function input(over: Partial<Parameters<typeof signSurveyIntake>[0]> = {}) {
  return {
    link: initialLink,
    consent: validConsent,
    identity: validIdentity,
    otp: { sessionId: "11111111-2222-3333-4444-555555555555", code: "123456" },
    ipAddress: "1.2.3.4",
    ...over,
  };
}

beforeEach(() => {
  vi.mocked(intakeReads.findPatientByDocument).mockReset();
  vi.mocked(intakeReads.findDuplicateCandidates).mockReset();
  vi.mocked(writer.signIntakeEvaluation).mockReset();
  vi.mocked(otp.verifyOtp).mockReset();
  vi.mocked(otp.verifyOtp).mockResolvedValue(okOtp);
  vi.mocked(otp.consumeOtp).mockReset();
  vi.mocked(otp.consumeOtp).mockResolvedValue(true);
  vi.mocked(intakeReads.findDuplicateCandidates).mockResolvedValue([]);
  vi.mocked(writer.signIntakeEvaluation).mockResolvedValue({
    evaluationId: "ev-1",
    patientId: "pat-1",
    resumeToken: "resume-abc",
  });
});

describe("signSurveyIntake", () => {
  it("sin match exacto -> inicial; sella las 3 autorizaciones necesarias", async () => {
    vi.mocked(intakeReads.findPatientByDocument).mockResolvedValue(null);
    const res = await signSurveyIntake(input());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.mode).toBe("inicial");
      expect(res.value.resumeToken).toBe("resume-abc"); // el token con el que sigue la fase 2
    }
    const call = vi.mocked(writer.signIntakeEvaluation).mock.calls[0][0];
    expect(call.mode).toBe("inicial");
    expect(call.patientId).toBeNull();
    // Las 3 necesarias del gate + la aceptacion del medio electronico (firma electronica, v1.7).
    expect(call.consents.map((c) => c.type)).toEqual([
      "servicio",
      "datos_sensibles",
      "aceptacion_medio_electronico",
    ]);
    // sella version y hash canonicos vigentes
    expect(call.consents[0].consentVersion).toBe("1.0");
    expect(call.consents[0].documentHash).toHaveLength(64);
  });

  it("match exacto por documento -> seguimiento con el paciente existente", async () => {
    // Mismo nombre que validIdentity -> seguimiento sin conflicto de identidad.
    vi.mocked(intakeReads.findPatientByDocument).mockResolvedValue({
      id: "pat-existente",
      firstName: "Maria",
      lastName: "Gomez",
    });
    const res = await signSurveyIntake(input());
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.mode).toBe("seguimiento");
    const call = vi.mocked(writer.signIntakeEvaluation).mock.calls[0][0];
    expect(call.mode).toBe("seguimiento");
    expect(call.patientId).toBe("pat-existente");
  });

  it("registra las autorizaciones opcionales marcadas", async () => {
    vi.mocked(intakeReads.findPatientByDocument).mockResolvedValue(null);
    await signSurveyIntake(
      input({ consent: { ...validConsent, investigacion: true } }),
    );
    const call = vi.mocked(writer.signIntakeEvaluation).mock.calls[0][0];
    expect(call.consents.map((c) => c.type)).toContain("investigacion");
  });

  const minorConsent = {
    servicio: true,
    datos_sensibles: true,
    aceptacion_medio_electronico: true,
    ageBranch: "menor",
    legalRepresentativeName: "Maria Perez",
    legalRepresentativeDocument: "CC 123456",
    legalRepresentativeRelationship: "madre",
    legalRepresentativeEmail: "madre@example.com",
    minorBirthDate: "2010-01-01", // 14-17 en 2026
    asentimiento_menor: true,
  };

  it("rama menor 14-17 -> agrega representante_legal (con datos) y asentimiento_menor", async () => {
    vi.mocked(intakeReads.findPatientByDocument).mockResolvedValue(null);
    await signSurveyIntake(
      input({
        consent: minorConsent,
        identity: { ...validIdentity, birthDate: "2010-01-01" },
      }),
    );
    const call = vi.mocked(writer.signIntakeEvaluation).mock.calls[0][0];
    const types = call.consents.map((c) => c.type);
    expect(types).toContain("representante_legal");
    expect(types).toContain("asentimiento_menor");
    const rep = call.consents.find((c) => c.type === "representante_legal");
    expect(rep?.legalRepresentative).toEqual({
      name: "Maria Perez",
      document: "CC 123456",
      relationship: "madre",
      email: "madre@example.com",
    });
    // Las 3 necesarias siguen presentes, firmadas por el representante (gate sin cambios).
    expect(types).toEqual(
      expect.arrayContaining(["servicio", "datos_sensibles"]),
    );
  });

  it("rama menor bajo 14 -> representante_legal sin asentimiento_menor", async () => {
    vi.mocked(intakeReads.findPatientByDocument).mockResolvedValue(null);
    await signSurveyIntake(
      input({
        consent: { ...minorConsent, minorBirthDate: "2020-01-01" },
        identity: { ...validIdentity, birthDate: "2020-01-01" },
      }),
    );
    const call = vi.mocked(writer.signIntakeEvaluation).mock.calls[0][0];
    const types = call.consents.map((c) => c.type);
    expect(types).toContain("representante_legal");
    expect(types).not.toContain("asentimiento_menor");
  });

  it("rechaza (validation) si falta una autorizacion necesaria; no escribe", async () => {
    const res = await signSurveyIntake(
      input({ consent: { ...validConsent, datos_sensibles: false } }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("validation");
    expect(writer.signIntakeEvaluation).not.toHaveBeenCalled();
  });

  it("rechaza (validation) si no declara mayoria de edad; no escribe", async () => {
    const res = await signSurveyIntake(
      input({ consent: { ...validConsent, mayoria_de_edad: false } }),
    );
    expect(res.ok).toBe(false);
    expect(writer.signIntakeEvaluation).not.toHaveBeenCalled();
  });

  it("mapea ConsentGateError del escritor a un error de autorizacion", async () => {
    vi.mocked(intakeReads.findPatientByDocument).mockResolvedValue(null);
    vi.mocked(writer.signIntakeEvaluation).mockRejectedValue(
      new writer.ConsentGateError(["datos_sensibles"]),
    );
    const res = await signSurveyIntake(input());
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
    const res = await signSurveyIntake(input());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.duplicateCandidates).toHaveLength(1);
      expect(res.value.duplicateCandidates[0].patientId).toBe("dup-1");
    }
  });

  it("firma electronica: pasa la metadata (canal, destino enmascarado, marcas) al escritor", async () => {
    vi.mocked(intakeReads.findPatientByDocument).mockResolvedValue(null);
    await signSurveyIntake(input());
    const call = vi.mocked(writer.signIntakeEvaluation).mock.calls[0][0];
    expect(call.signature?.channel).toBe("email");
    expect(call.signature?.maskedDestination).toBe("m***@example.com");
    expect(call.signature?.sentAt).toBe(1_700_000_000_000);
    expect(typeof call.signature?.validatedAt).toBe("number"); // hora del servidor al validar
  });

  it("codigo incorrecto -> validation con mensaje propio; NO escribe (verificar+crear o nada)", async () => {
    vi.mocked(otp.verifyOtp).mockResolvedValue({ status: "invalid" });
    const res = await signSurveyIntake(input());
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("validation");
      expect(res.error.message).toContain("no es correcto");
    }
    expect(writer.signIntakeEvaluation).not.toHaveBeenCalled();
    expect(intakeReads.findPatientByDocument).not.toHaveBeenCalled(); // ni siquiera resuelve identidad
  });

  it("codigo vencido -> mensaje DISTINTO al incorrecto (pedir uno nuevo)", async () => {
    vi.mocked(otp.verifyOtp).mockResolvedValue({ status: "expired" });
    const res = await signSurveyIntake(input());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain("venció");
    expect(writer.signIntakeEvaluation).not.toHaveBeenCalled();
  });

  it("verificacion no disponible (Upstash) -> internal, no valida la firma en silencio", async () => {
    vi.mocked(otp.verifyOtp).mockResolvedValue({ status: "unavailable" });
    const res = await signSurveyIntake(input());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("internal");
    expect(writer.signIntakeEvaluation).not.toHaveBeenCalled();
  });

  it("no verifica la firma antes de validar la forma (no quema el codigo por un campo malo)", async () => {
    const res = await signSurveyIntake(
      input({ consent: { ...validConsent, datos_sensibles: false } }),
    );
    expect(res.ok).toBe(false);
    expect(otp.verifyOtp).not.toHaveBeenCalled(); // validacion de forma primero
  });

  it("consume el link de seguimiento (un solo uso); no el inicial", async () => {
    vi.mocked(intakeReads.findPatientByDocument).mockResolvedValue({
      id: "pat-x",
      firstName: "Maria",
      lastName: "Gomez",
    });
    // inicial: linkId null
    await signSurveyIntake(input());
    expect(
      vi.mocked(writer.signIntakeEvaluation).mock.calls[0][0].linkId,
    ).toBeNull();
    // seguimiento: linkId = id del link
    const followLink: SurveyLinkView = {
      ...initialLink,
      type: "seguimiento",
      patientId: "pat-x",
    };
    await signSurveyIntake(input({ link: followLink }));
    expect(vi.mocked(writer.signIntakeEvaluation).mock.calls[1][0].linkId).toBe(
      "link-1",
    );
  });
});

// ── EL CASO QUE ORIGINO EL CAMBIO (defecto real en produccion, 2026-08-26) ───────────────────────────
//
// Una persona pidio el codigo, lo puso, y el sistema le seguia pidiendo que lo pidiera. La causa: el
// codigo se CONSUMIA al verificarlo, y la firma seguia despues. Si algo posterior fallaba, el codigo ya
// estaba quemado sin que hubiera firma, y el reintento con el mismo codigo daba "ya no sirve, pide otro".
describe("el codigo sobrevive a un fallo posterior a la verificacion", () => {
  it("si la persistencia falla, el codigo NO se consume", async () => {
    vi.mocked(writer.signIntakeEvaluation).mockRejectedValue(
      new Error("cayo la BD"),
    );
    const r = await signSurveyIntake(input());
    expect(r.ok).toBe(false);
    // Lo que importa: el codigo sigue vivo, asi que el paciente puede reintentar con el MISMO.
    expect(otp.consumeOtp).not.toHaveBeenCalled();
  });

  it("y se consume SOLO cuando la firma quedo persistida", async () => {
    const r = await signSurveyIntake(input());
    expect(r.ok).toBe(true);
    expect(otp.consumeOtp).toHaveBeenCalledTimes(1);
  });

  it("el consumo va DESPUES de persistir, no antes", async () => {
    // Si se invirtiera el orden volveria el defecto: se gastaria el codigo y despues se veria si la firma
    // se puede completar.
    const orden: string[] = [];
    vi.mocked(writer.signIntakeEvaluation).mockImplementation(async () => {
      orden.push("persistir");
      return { evaluationId: "e1", patientId: "p1", resumeToken: "t1" };
    });
    vi.mocked(otp.consumeOtp).mockImplementation(async () => {
      orden.push("consumir");
      return true;
    });
    await signSurveyIntake(input());
    expect(orden).toEqual(["persistir", "consumir"]);
  });

  // PAIS Y CIUDAD OBLIGATORIOS (Santiago, 2026-09-04) ─────────────────────────────────────────────────
  //
  // POR QUE SON OBLIGATORIOS Y NO UN CAMPO MAS: la ciudad es lo que decide la REGION del paciente, y de
  // la region sale la lista de intercambio que se le entrega impresa. Sin ciudad recibe la lista nacional
  // de 350 alimentos en vez de la de su zona, y no es un dato que se pueda pedir despues: cuando el
  // profesional imprime el plan, el paciente ya cerro la encuesta.
  it("sin ciudad no se puede firmar, y el mensaje dice cual falta", async () => {
    const r = await signSurveyIntake(
      input({ identity: { ...validIdentity, city: "  " } }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("validation");
    // EL MENSAJE NOMBRA EL CAMPO. Con el generico ("Revisa los datos de identificación") el paciente
    // queda buscando cual de doce campos es, y estos dos viajan por un input OCULTO, asi que la
    // validacion del navegador no siempre los atrapa antes.
    expect(r.error.message).toContain("ciudad");
  });

  it("sin pais tampoco", async () => {
    const r = await signSurveyIntake(
      input({ identity: { ...validIdentity, country: "" } }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain("país");
  });

  it("pero un municipio que NO esta en la lista curada entra igual", async () => {
    // EL SEGUNDO CUIDADO DEL CAMBIO, y es el que lo hace seguro: obligatorio no es lo mismo que
    // restringido a la lista. El desplegable conserva "Otra" con texto libre, asi que un municipio
    // pequeño no queda fuera. Si algun dia alguien cierra la ciudad a un enum, este caso se pone rojo.
    const r = await signSurveyIntake(
      input({ identity: { ...validIdentity, city: "Sonsón" } }),
    );
    expect(r.ok).toBe(true);
  });

  it("y el mensaje de los demas campos NO filtra el ingles de Zod al paciente", async () => {
    // Zod trae sus textos por defecto en ingles ("Invalid email", "Too small: expected string..."), y
    // esto lo lee un paciente. Solo pais y ciudad tienen mensaje escrito por nosotros; el resto cae al
    // generico en español. Sin este caso, un campo nuevo filtraria ingles a la pantalla sin que se note.
    const r = await signSurveyIntake(
      input({ identity: { ...validIdentity, documentNumber: "1" } }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toBe("Revisa los datos de identificación.");
  });
});
