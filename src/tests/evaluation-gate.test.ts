import { describe, expect, it } from "vitest";

import { canCreateEvaluation } from "@/modules/evaluations/policies/can-create-evaluation";
import {
  followupExpiry,
  generateOpaqueToken,
  isLinkUsable,
} from "@/modules/evaluations/services/survey-link-service";

describe("canCreateEvaluation (gate regla 15)", () => {
  it("permite con las 3 autorizaciones necesarias vigentes", () => {
    const r = canCreateEvaluation(["servicio", "datos_sensibles", "internacional_ia"]);
    expect(r.ok).toBe(true);
  });

  it("permite aunque haya tambien opcionales", () => {
    const r = canCreateEvaluation([
      "servicio",
      "datos_sensibles",
      "internacional_ia",
      "investigacion",
    ]);
    expect(r.ok).toBe(true);
  });

  it("bloquea si falta una necesaria y reporta cual", () => {
    const r = canCreateEvaluation(["servicio", "datos_sensibles"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(["internacional_ia"]);
  });

  it("bloquea sin ninguna autorizacion", () => {
    const r = canCreateEvaluation([]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toHaveLength(3);
  });
});

describe("survey-link service", () => {
  it("genera tokens opacos unicos y largos", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40); // 32 bytes en base64url
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, sin PII ni estructura
  });

  it("un link inicial (sin expiracion ni consumo) siempre sirve", () => {
    expect(isLinkUsable({ consumedAt: null, expiresAt: null }, Date.now())).toBe(true);
  });

  it("un link consumido no sirve", () => {
    expect(
      isLinkUsable({ consumedAt: "2026-06-20T00:00:00Z", expiresAt: null }, Date.now()),
    ).toBe(false);
  });

  it("un link de seguimiento vencido no sirve; vigente si", () => {
    const now = Date.parse("2026-06-21T00:00:00Z");
    const vencido = followupExpiry(now - 31 * 24 * 60 * 60 * 1000).toISOString();
    const vigente = followupExpiry(now - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isLinkUsable({ consumedAt: null, expiresAt: vencido }, now)).toBe(false);
    expect(isLinkUsable({ consumedAt: null, expiresAt: vigente }, now)).toBe(true);
  });
});
