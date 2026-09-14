import { describe, expect, it } from "vitest";

import type { AppRole, CurrentUser } from "@/modules/auth/roles";
import { canDeliverSale } from "@/modules/payments/policies/can-deliver-sale";

// Quien registra la entrega: el profesional DE LA VENTA (tiene el producto en su consultorio) y el admin.
// Direccion ve las ventas pero no entrega.

const user = (roles: AppRole[]): CurrentUser => ({
  id: "u1",
  email: "u@x.co",
  fullName: "U",
  organizationId: "org",
  status: "active",
  roles,
});

describe("canDeliverSale", () => {
  it("el profesional de la venta, si", () => {
    expect(canDeliverSale(user(["professional"]), { professional_id: "prof-1" }, "prof-1")).toBe(true);
  });

  it("otro profesional, no", () => {
    expect(canDeliverSale(user(["professional"]), { professional_id: "prof-1" }, "prof-2")).toBe(false);
  });

  it("un profesional sin perfil no entrega una venta sin profesional (null no es igual a null aqui)", () => {
    expect(canDeliverSale(user(["professional"]), { professional_id: null }, null)).toBe(false);
  });

  it("admin, si; direccion, no", () => {
    expect(canDeliverSale(user(["admin"]), { professional_id: "prof-1" }, null)).toBe(true);
    expect(canDeliverSale(user(["direccion"]), { professional_id: "prof-1" }, null)).toBe(false);
  });
});
