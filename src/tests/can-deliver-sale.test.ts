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
    expect(canDeliverSale(user(["professional"]), { professional_id: "prof-1" }, "prof-1", "loc-1")).toBe(true);
  });

  it("otro profesional, no", () => {
    expect(canDeliverSale(user(["professional"]), { professional_id: "prof-1" }, "prof-2", "loc-2")).toBe(false);
  });

  it("un profesional sin perfil no entrega una venta sin profesional (null no es igual a null aqui)", () => {
    expect(canDeliverSale(user(["professional"]), { professional_id: null }, null, null)).toBe(false);
  });

  it("admin, si; direccion, no", () => {
    expect(canDeliverSale(user(["admin"]), { professional_id: "prof-1" }, null, null)).toBe(true);
    expect(canDeliverSale(user(["direccion"]), { professional_id: "prof-1" }, null, null)).toBe(false);
  });
});

// ═══ UNA VENTA QUE SALE DE LA BODEGA NO LA ENTREGA EL PROFESIONAL (Santiago, smoke del 2026-10-04) ═══
//
// LO QUE PASO: cobro OMEGA COMPLEX desde la bodega (no tiene unidades) y la pantalla le dejo marcar
// "Entregado". Al hacerlo, el aviso de "falta despacharla" DESAPARECIO de /pagos: admin nunca se entera y
// nadie le lleva el producto al paciente. Es el olvido invisible que ese aviso existe para evitar.
//
// Y LO QUE LO HACE PEOR: la pantalla YA DECIA "Sale de la bodega de CNV: falta despacharla", y su comentario
// afirmaba que esa linea "es lo que evita que el profesional la de por entregada". No evitaba nada: era texto.
// Un comentario que AFIRMA una garantia que el codigo no da deja tranquilo al siguiente que lo lea.
describe("la venta que sale de la bodega", () => {
  const suya = { professional_id: "prof-1" };

  it("el profesional NO la entrega: el producto no estuvo en sus manos", () => {
    expect(
      canDeliverSale(user(["professional"]), { ...suya, location_id: "bodega" }, "prof-1", "su-vitrina"),
      "volvio a dejar que el profesional de por entregado lo que sale de la bodega",
    ).toBe(false);
  });

  it("y la de su propia vitrina si, que es el control", () => {
    // Sin este caso, bloquear TODAS las entregas tambien pasaria el de arriba.
    expect(canDeliverSale(user(["professional"]), { ...suya, location_id: "su-vitrina" }, "prof-1", "su-vitrina")).toBe(
      true,
    );
  });

  it("admin SI la entrega: es quien despacha", () => {
    expect(canDeliverSale(user(["admin"]), { ...suya, location_id: "bodega" }, null, null)).toBe(true);
  });

  it("y una venta sin ubicacion sellada no se bloquea: son las anteriores al Bloque 3", () => {
    // Bloquearlas seria romper la entrega de ventas viejas por un dato que entonces no se guardaba.
    expect(canDeliverSale(user(["professional"]), { ...suya, location_id: null }, "prof-1", "su-vitrina")).toBe(true);
  });
});
