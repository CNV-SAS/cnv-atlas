import { describe, expect, it } from "vitest";

import type { CurrentUser } from "@/modules/auth/roles";
import {
  canDecideGrant,
  computeApproverRole,
  GRANT_LIMITS,
  resolveExpiryHours,
} from "@/modules/clinical-access/grant-rules";

// Tests PUROS de las reglas de grants (sin BD): matriz de aprobacion, autoaprobacion
// bloqueada y topes de duracion.

function user(id: string, roles: CurrentUser["roles"]): CurrentUser {
  return { id, email: `${id}@test`, fullName: id, organizationId: "org", status: "active", roles };
}

describe("computeApproverRole: matriz solicitante -> aprobador", () => {
  it("soporte lo aprueba admin", () => {
    expect(computeApproverRole(user("s", ["soporte"]))).toBe("admin");
  });
  it("admin lo aprueba direccion", () => {
    expect(computeApproverRole(user("a", ["admin"]))).toBe("direccion");
  });
  it("si es admin y soporte a la vez, prevalece admin (-> direccion)", () => {
    expect(computeApproverRole(user("as", ["admin", "soporte"]))).toBe("direccion");
  });
  it("un rol que no puede solicitar devuelve null", () => {
    expect(computeApproverRole(user("p", ["professional"]))).toBeNull();
    expect(computeApproverRole(user("o", ["obbia"]))).toBeNull();
    expect(computeApproverRole(user("d", ["direccion"]))).toBeNull();
  });
});

describe("canDecideGrant: separacion solicitante/aprobador", () => {
  it("direccion aprueba la solicitud de admin", () => {
    expect(
      canDecideGrant(user("dir", ["direccion"]), { requesterId: "adm", approverRole: "direccion" }),
    ).toBe(true);
  });
  it("admin aprueba la solicitud de soporte", () => {
    expect(
      canDecideGrant(user("adm", ["admin"]), { requesterId: "sop", approverRole: "admin" }),
    ).toBe(true);
  });
  it("nadie se autoaprueba, aunque tenga el rol aprobador", () => {
    expect(
      canDecideGrant(user("adm", ["admin", "direccion"]), {
        requesterId: "adm",
        approverRole: "direccion",
      }),
    ).toBe(false);
  });
  it("un rol que no es el aprobador designado no puede decidir", () => {
    expect(
      canDecideGrant(user("adm", ["admin"]), { requesterId: "sop", approverRole: "direccion" }),
    ).toBe(false);
  });
});

describe("resolveExpiryHours: default y tope duro por nivel", () => {
  it("usa el default del nivel cuando no se pide duracion", () => {
    expect(resolveExpiryHours("notes_pseudonymous")).toEqual({ ok: true, value: 720 });
    expect(resolveExpiryHours("notes_identified")).toEqual({ ok: true, value: 48 });
  });
  it("acepta una duracion dentro del tope", () => {
    expect(resolveExpiryHours("notes_identified", 100)).toEqual({ ok: true, value: 100 });
  });
  it("rechaza una duracion sobre el tope duro (Nivel c: 168h)", () => {
    const r = resolveExpiryHours("notes_identified", 200);
    expect(r.ok).toBe(false);
  });
  it("rechaza una duracion sobre el tope duro (Nivel b: 2160h)", () => {
    const r = resolveExpiryHours("notes_pseudonymous", 3000);
    expect(r.ok).toBe(false);
  });
  it("rechaza duraciones no positivas o no enteras", () => {
    expect(resolveExpiryHours("notes_identified", 0).ok).toBe(false);
    expect(resolveExpiryHours("notes_identified", -5).ok).toBe(false);
    expect(resolveExpiryHours("notes_identified", 1.5).ok).toBe(false);
  });
  it("el tope de Nivel c (7d) es menor que el de Nivel b (90d)", () => {
    expect(GRANT_LIMITS.notes_identified.maxHours).toBeLessThan(
      GRANT_LIMITS.notes_pseudonymous.maxHours,
    );
  });
});
