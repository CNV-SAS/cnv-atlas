import { beforeEach, describe, expect, it, vi } from "vitest";

// CANDADO DEL ENVIO DEL CODIGO DE FIRMA, compartido por el enlace publico y el presencial (2026-09-08).
//
// POR QUE SE COMPARTE. El envio vivia dentro de la action publica, que arranca exigiendo el token del
// enlace. En presencial NO HAY ENLACE, asi que devolvia "Link invalido" y bloqueaba la firma entera. La
// salida facil era una segunda copia del envio; la copia habria heredado mal justo lo que hace prueba a
// la firma (la hora del SERVIDOR, el enmascarado del destino, el fallo en voz alta sin almacen).
//
// LO QUE ESTE CANDADO PROTEGE es que compartirlo no aflojo nada, que es la pregunta que hizo Santiago:
// el codigo sigue yendo AL CORREO QUE SE LE PASA (el del paciente), la hora la pone el servidor, y sin
// almacen no se manda nada. Lo probamos ejercitando el servicio, no leyendo su codigo.

// El servicio es server-only; en el test no aplica.
vi.mock("server-only", () => ({}));
vi.mock("@/modules/consent/otp/otp-service", () => ({
  generateOtpCode: vi.fn(() => "123456"),
  maskEmail: vi.fn((e: string) => `***${e.slice(-8)}`),
  storeOtp: vi.fn(),
}));
vi.mock("@/lib/email/resend", () => ({ sendConsentOtpEmail: vi.fn() }));

import { sendConsentOtpEmail } from "@/lib/email/resend";
import { storeOtp } from "@/modules/consent/otp/otp-service";
import { enviarCodigoDeFirma } from "@/modules/evaluations/services/enviar-codigo-firma";

const sinLimite = async () => ({ success: true, remaining: 4 });

function entrada(over: Partial<Parameters<typeof enviarCodigoDeFirma>[0]> = {}) {
  return {
    sessionId: "11111111-1111-4111-8111-111111111111",
    ageBranch: "mayor" as const,
    destino: "paciente@ejemplo.com",
    limitar: sinLimite,
    ...over,
  };
}

beforeEach(() => {
  vi.mocked(storeOtp).mockReset();
  vi.mocked(storeOtp).mockResolvedValue(true);
  vi.mocked(sendConsentOtpEmail).mockReset();
  vi.mocked(sendConsentOtpEmail).mockResolvedValue({ ok: true, value: { id: "e1" } });
});

describe("el código va al correo que se le pasa, y a ninguno más", () => {
  it("el destino del correo es el que entra, no otro", () => {
    // En presencial quien opera la pantalla es el profesional: si el destino saliera de la sesión, el
    // código llegaría a SU bandeja y la firma dejaría de probar que fue el paciente.
    return enviarCodigoDeFirma(entrada()).then(() => {
      expect(sendConsentOtpEmail).toHaveBeenCalledWith("paciente@ejemplo.com", "123456");
    });
  });

  it("y el guardado lleva la hora del SERVIDOR y el destino enmascarado", async () => {
    const antes = Date.now();
    await enviarCodigoDeFirma(entrada());
    const meta = vi.mocked(storeOtp).mock.calls[0][2];
    expect(meta.channel).toBe("email");
    expect(meta.sentAt).toBeGreaterThanOrEqual(antes);
    // Enmascarado: lo que se le enseña al paciente en pantalla no es el correo entero.
    expect(meta.maskedDestination).not.toBe("paciente@ejemplo.com");
  });
});

describe("nada se manda si algo del camino falla", () => {
  it("sin almacén NO se envía correo: un código que no se guardó no se puede verificar", async () => {
    vi.mocked(storeOtp).mockResolvedValue(false);
    const r = await enviarCodigoDeFirma(entrada());
    expect(r.ok).toBe(false);
    expect(sendConsentOtpEmail).not.toHaveBeenCalled();
  });

  it("con el límite agotado no se genera ni se guarda nada", async () => {
    const r = await enviarCodigoDeFirma(
      entrada({ limitar: async () => ({ success: false, remaining: 0 }) }),
    );
    expect(r.ok).toBe(false);
    expect(storeOtp).not.toHaveBeenCalled();
    expect(sendConsentOtpEmail).not.toHaveBeenCalled();
  });

  it("un correo mal escrito NO gasta uno de los cinco envíos", async () => {
    // El paciente lo corrige y vuelve a pedirlo: ese es el camino normal, y castigarlo con una de las
    // cinco cuotas convierte un typo en un bloqueo de quince minutos.
    const limitar = vi.fn(sinLimite);
    const r = await enviarCodigoDeFirma(entrada({ destino: "no-es-un-correo", limitar }));
    expect(r.ok).toBe(false);
    expect(limitar).not.toHaveBeenCalled();
  });
});

describe("el mensaje del correo faltante nombra a QUIÉN se le pide", () => {
  it("en rama menor pide el del representante, no el del paciente", async () => {
    const r = await enviarCodigoDeFirma(entrada({ ageBranch: "menor", destino: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("del representante");
  });
});
