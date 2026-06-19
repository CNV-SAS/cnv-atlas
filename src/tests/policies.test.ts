import { describe, expect, it } from "vitest";

import { mfaRequirement } from "../modules/auth/mfa-policy";
import { canAccessAdmin } from "../modules/auth/policies/can-access-admin";
import { canManageUsers } from "../modules/auth/policies/can-manage-users";
import type { AppRole, CurrentUser } from "../modules/auth/roles";

function userWith(roles: AppRole[]): CurrentUser {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    email: "u@example.com",
    fullName: "Usuario",
    organizationId: "11111111-1111-1111-1111-111111111111",
    status: "active",
    roles,
  };
}

describe("policies de administracion", () => {
  it("canAccessAdmin: solo admin", () => {
    expect(canAccessAdmin(userWith(["admin"]))).toBe(true);
    expect(canAccessAdmin(userWith(["professional"]))).toBe(false);
    expect(canAccessAdmin(userWith(["direccion", "soporte"]))).toBe(false);
    expect(canAccessAdmin(userWith([]))).toBe(false);
  });

  it("canManageUsers: solo admin", () => {
    expect(canManageUsers(userWith(["admin"]))).toBe(true);
    expect(canManageUsers(userWith(["soporte"]))).toBe(false);
    expect(canManageUsers(userWith([]))).toBe(false);
  });
});

describe("enforcement de MFA (mfaRequirement)", () => {
  it("professional nunca se fuerza, aun sin MFA", () => {
    expect(mfaRequirement(userWith(["professional"]), false, "aal1")).toBe("ok");
    expect(mfaRequirement(userWith(["professional"]), false, null)).toBe("ok");
  });

  it("interno sin factor verificado -> enroll", () => {
    expect(mfaRequirement(userWith(["admin"]), false, "aal1")).toBe("enroll");
    expect(mfaRequirement(userWith(["soporte"]), false, "aal1")).toBe("enroll");
    expect(mfaRequirement(userWith(["direccion"]), false, "aal1")).toBe("enroll");
    expect(mfaRequirement(userWith(["obbia"]), false, "aal1")).toBe("enroll");
  });

  it("interno con factor pero sin elevar (aal1) -> challenge", () => {
    expect(mfaRequirement(userWith(["admin"]), true, "aal1")).toBe("challenge");
  });

  it("interno con factor y aal2 -> ok", () => {
    expect(mfaRequirement(userWith(["admin"]), true, "aal2")).toBe("ok");
  });
});
