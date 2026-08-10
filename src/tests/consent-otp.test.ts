import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  generateOtpCode,
  storeOtp,
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

  it("código correcto -> ok con la metadata de la traza, y se CONSUME (2do intento -> expired)", async () => {
    await storeOtp("s1", "123456", META, store);
    const r = await verifyOtp("s1", "123456", store);
    expect(r.status).toBe("ok");
    expect(r.meta).toEqual(META); // canal + destino enmascarado + sentAt para la traza
    expect((await verifyOtp("s1", "123456", store)).status).toBe("expired"); // ya consumido
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
});
