import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// El servicio avisa a Sentry cuando Upstash cae; se mockea para no cargar el SDK real en test.
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const {
  generateOtpCode,
  storeOtp,
  consumeOtp,
  verifyOtp,
  maskEmail,
} = await import("@/modules/consent/otp/otp-service");
import type { OtpMeta, OtpStore } from "@/modules/consent/otp/otp-service";

const META: OtpMeta = { channel: "email", maskedDestination: "j***@gmail.com", sentAt: 1_700_000_000_000 };

// Mock en memoria del subset de Redis que usa el servicio (hset/hgetall/hincrby/expire/del). No simula
// el TTL real (eso es de Upstash); el vencimiento se prueba borrando la clave, que es lo que hace el TTL.
function memStore(): OtpStore & { _map: Map<string, Record<string, unknown>> } {
  const map = new Map<string, Record<string, unknown>>();
  return {
    _map: map,
    async hset(key, value) {
      map.set(key, { ...(map.get(key) ?? {}), ...value });
      return 1;
    },
    async hgetall<T>(key: string) {
      return (map.get(key) as T) ?? null;
    },
    async hincrby(key, field, by) {
      const cur = map.get(key) ?? {};
      const next = Number(cur[field] ?? 0) + by;
      map.set(key, { ...cur, [field]: next });
      return next;
    },
    async expire() {
      return 1;
    },
    async del(key) {
      return map.delete(key) ? 1 : 0;
    },
  };
}

describe("consent OTP service", () => {
  let store: ReturnType<typeof memStore>;
  beforeEach(() => {
    store = memStore();
  });

  it("genera un código de 6 dígitos", () => {
    for (let i = 0; i < 50; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it("enmascara el correo (nunca el completo)", () => {
    expect(maskEmail("juan@gmail.com")).toBe("j***@gmail.com");
    expect(maskEmail("juan@gmail.com")).not.toContain("uan");
  });

  it("NUNCA guarda el código en claro; solo su hash", async () => {
    await storeOtp("s1", "123456", META, store);
    const stored = store._map.get("consent-otp:s1")!;
    expect(stored.hash).toBeTypeOf("string");
    expect(String(stored.hash)).not.toContain("123456");
  });

  it("código correcto -> ok con la metadata, y NO se consume solo por verificarlo", async () => {
    // ANTES verifyOtp borraba el codigo al validarlo, y la firma seguia despues (resolver identidad,
    // persistir). Si algo de eso fallaba, el codigo quedaba quemado SIN QUE HUBIERA FIRMA y el paciente
    // reintentaba con el mismo recibiendo "ya no sirve, pide otro": el bucle visto en produccion.
    await storeOtp("s1", "123456", META, store);
    const r = await verifyOtp("s1", "123456", store);
    expect(r.status).toBe("ok");
    expect(r.meta).toEqual(META); // canal + destino enmascarado + sentAt para la traza
    // Sigue sirviendo: el consumo es un acto aparte, y va cuando la firma ya se persistio.
    expect((await verifyOtp("s1", "123456", store)).status).toBe("ok");
  });

  it("consumeOtp lo gasta: despues ya no vale (un solo uso, donde toca)", async () => {
    await storeOtp("s1", "123456", META, store);
    expect((await verifyOtp("s1", "123456", store)).status).toBe("ok");
    expect(await consumeOtp("s1", store)).toBe(true);
    expect((await verifyOtp("s1", "123456", store)).status).toBe("expired");
  });

  it("verificar SIN consumir no abre fuerza bruta: los aciertos tambien gastan intento", async () => {
    // Es el riesgo real del cambio. El contador se incrementa ANTES de comparar, en CADA verificacion,
    // asi que un atacante tiene los mismos 5 intentos de antes; lo unico que cambia es que acertar ya no
    // borra el codigo por si solo.
    await storeOtp("s1", "123456", META, store);
    for (let i = 0; i < 5; i++) expect((await verifyOtp("s1", "123456", store)).status).toBe("ok");
    expect((await verifyOtp("s1", "123456", store)).status).toBe("too_many_attempts");
  });

  it("código incorrecto -> invalid; el correcto sigue valiendo hasta el tope", async () => {
    await storeOtp("s1", "123456", META, store);
    expect((await verifyOtp("s1", "000000", store)).status).toBe("invalid");
    expect((await verifyOtp("s1", "123456", store)).status).toBe("ok");
  });

  it("supera el tope de intentos -> too_many_attempts e invalida la sesión", async () => {
    await storeOtp("s1", "123456", META, store);
    for (let i = 0; i < 5; i++) await verifyOtp("s1", "000000", store); // 5 fallidos (tope)
    expect((await verifyOtp("s1", "123456", store)).status).toBe("too_many_attempts"); // 6to: cerrado
    expect((await verifyOtp("s1", "123456", store)).status).toBe("expired"); // sesión invalidada
  });

  it("sin código guardado (vencido/ausente) -> expired", async () => {
    expect((await verifyOtp("s1", "123456", store)).status).toBe("expired");
  });

  it("sin almacén configurado -> unavailable (no se deja pasar la firma)", async () => {
    expect((await verifyOtp("s1", "123456", null)).status).toBe("unavailable");
    expect(await storeOtp("s1", "123456", META, null)).toBe(false);
  });

  it("Upstash CONFIGURADO pero CAIDO (lanza) -> falla cerrado, no error tecnico", async () => {
    // Store que existe pero cuyas operaciones lanzan (fallo de red de Upstash): distinto de null.
    const boom: OtpStore = {
      hset: async () => {
        throw new Error("ECONNRESET");
      },
      hgetall: async () => {
        throw new Error("ECONNRESET");
      },
      hincrby: async () => 0,
      expire: async () => 1,
      del: async () => 1,
    };
    // storeOtp no lanza: devuelve false (el llamador muestra "no disponible", no un stack tecnico).
    expect(await storeOtp("s1", "123456", META, boom)).toBe(false);
    // verifyOtp no lanza: devuelve unavailable (falla cerrado, nunca "invalid" ni "expired").
    expect((await verifyOtp("s1", "123456", boom)).status).toBe("unavailable");
  });
  // ── EL CAMINO REAL: se equivoca y despues acierta (defecto del smoke 2026-08-26) ─────────────────────
  //
  // El camino feliz estaba cubierto y el de fallo tambien, pero NO el de fallo SEGUIDO DE ACIERTO, que es
  // justo el que recorre cualquiera que se equivoque al copiar el codigo. Se agrega porque Santiago llego
  // al defecto por ahi.
  describe("codigo malo, codigo malo, codigo bueno", () => {
    it("el bueno sigue sirviendo despues de dos fallos, y firmar puede consumirlo", async () => {
      await storeOtp("s1", "123456", META, store);
      expect((await verifyOtp("s1", "000000", store)).status).toBe("invalid");
      expect((await verifyOtp("s1", "111111", store)).status).toBe("invalid");
      // El bueno: comprueba bien y NO se gasta por comprobarlo (esa es la separacion de ayer).
      expect((await verifyOtp("s1", "123456", store)).status).toBe("ok");
      // Y firmar lo consume, ya con la firma persistida.
      expect(await consumeOtp("s1", store)).toBe(true);
      expect((await verifyOtp("s1", "123456", store)).status).toBe("expired");
    });

    it("los fallos previos NO dejan la sesion marcada: el acierto es limpio", async () => {
      // La sospecha al ver el defecto era que algo del intento fallido no se limpiaba. No es asi: los
      // fallos solo suben el contador, y mientras no llegue al tope el codigo bueno vale igual.
      await storeOtp("s1", "123456", META, store);
      for (let i = 0; i < 4; i++) await verifyOtp("s1", "000000", store);
      const r = await verifyOtp("s1", "123456", store);
      expect(r.status).toBe("ok");
      expect(r.meta).toEqual(META); // la traza sale intacta pese a los fallos
    });
  });
});
