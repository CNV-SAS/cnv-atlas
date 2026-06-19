import { describe, expect, it } from "vitest";

import { assignComodatoSchema, updateDeviceStatusSchema } from "../modules/comodato/validations";

// Fix de B4 (bugs 1 y 2): Zod 4 .uuid() rechazaba los UUIDs fijos del seed por los
// bits de version/variante. Con z.guid() los ids del seed pasan. Esto reproduce
// el caso real que fallaba en la UI.
describe("B4 fix: las validaciones aceptan los UUIDs fijos del seed", () => {
  it("updateDeviceStatusSchema acepta el id de un equipo sembrado", () => {
    const r = updateDeviceStatusSchema.safeParse({
      deviceId: "66666666-6666-6666-6666-666666666601",
      status: "maintenance",
    });
    expect(r.success).toBe(true);
  });

  it("assignComodatoSchema acepta los ids (equipo y profesional) del seed", () => {
    const r = assignComodatoSchema.safeParse({
      deviceId: "66666666-6666-6666-6666-666666666601",
      professionalId: "33333333-3333-3333-3333-333333333333",
      startDate: "2026-06-01",
      expectedEndDate: "2026-12-01",
    });
    expect(r.success).toBe(true);
  });
});
