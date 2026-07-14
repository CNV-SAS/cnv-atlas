import { describe, it, expect } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { scrubPhiFromEvent, REDACTED } from "./scrub";

// Prueba determinista del scrubbing de PHI: mete dato sensible sintetico en cada
// vector de un evento y verifica que sale redactado. No depende de Sentry real,
// asi que demuestra "no sale PHI" sin mirar el dashboard.
describe("scrubPhiFromEvent", () => {
  it("elimina PII de usuario, request y campos clinicos, y preserva lo benigno", () => {
    const event = {
      user: {
        id: "uuid-123",
        email: "juan@example.com",
        username: "juanp",
        ip_address: "1.2.3.4",
      },
      request: {
        url: "https://atlas.cnvsystem.com/x",
        cookies: { session: "abc" },
        query_string: "documento=123",
        headers: { cookie: "s=1", authorization: "Bearer x", "user-agent": "UA" },
        data: { nombre: "Juan", diagnostico: "X" },
      },
      extra: {
        nombre: "Juan Perez",
        documento: "CC123",
        indicador_bis: 42,
        note: "el paciente refiere dolor",
        motivo: "verificacion de queja de Juan",
        representante_documento: "CC456",
        foo: "ok",
      },
      tags: { paciente_id: "p1", modulo: "evaluations" },
      contexts: {
        os: { name: "Windows" },
        paciente: { cedula: "999", nota: "texto narrativo" },
      },
      breadcrumbs: [{ category: "x", data: { celular: "300", ok: "keep" } }],
    } as unknown as ErrorEvent;

    const out = scrubPhiFromEvent(event);

    // Usuario: solo id.
    expect(out.user).toEqual({ id: "uuid-123" });

    // Request: sin cookies ni cuerpo; query y headers sensibles fuera; UA queda.
    expect(out.request?.cookies).toBeUndefined();
    expect((out.request as { data?: unknown }).data).toBeUndefined();
    expect(out.request?.query_string).toBe(REDACTED);
    expect(out.request?.headers?.cookie).toBeUndefined();
    expect(out.request?.headers?.authorization).toBeUndefined();
    expect(out.request?.headers?.["user-agent"]).toBe("UA");

    // extra: PHI redactada (incluida narrativa libre y motivo de grant), benigno intacto.
    expect(out.extra?.nombre).toBe(REDACTED);
    expect(out.extra?.documento).toBe(REDACTED);
    expect(out.extra?.indicador_bis).toBe(REDACTED);
    expect(out.extra?.note).toBe(REDACTED);
    expect(out.extra?.motivo).toBe(REDACTED);
    expect(out.extra?.representante_documento).toBe(REDACTED);
    expect(out.extra?.foo).toBe("ok");

    // tags: id de paciente redactado, modulo intacto.
    expect(out.tags?.paciente_id).toBe(REDACTED);
    expect(out.tags?.modulo).toBe("evaluations");

    // contexts: estandar preservado, personalizado scrubbeado.
    expect((out.contexts?.os as { name?: string })?.name).toBe("Windows");
    expect((out.contexts?.paciente as { cedula?: string })?.cedula).toBe(REDACTED);
    expect((out.contexts?.paciente as { nota?: string })?.nota).toBe(REDACTED);

    // breadcrumbs: data clinica redactada, resto intacto.
    expect((out.breadcrumbs?.[0].data as { celular?: string })?.celular).toBe(REDACTED);
    expect((out.breadcrumbs?.[0].data as { ok?: string })?.ok).toBe("keep");
  });
});
