import { describe, expect, it } from "vitest";

import { createReferralSchema } from "@/modules/referrals/validations";

// D-009: la regla "otro exige texto" (además del CHECK de la BD) y el mínimo de motivo. Pura.

const base = {
  treatmentId: "11111111-1111-1111-1111-111111111111",
  reason: "HTA activa, requiere valoración",
  referredAt: "2026-08-08",
};

describe("createReferralSchema", () => {
  it("acepta una remisión a una de las cuatro profesiones sin texto libre", () => {
    expect(createReferralSchema.safeParse({ ...base, referredTo: "medico" }).success).toBe(true);
  });

  it("rechaza 'otro' sin el texto del destino", () => {
    const r = createReferralSchema.safeParse({ ...base, referredTo: "otro" });
    expect(r.success).toBe(false);
  });

  it("acepta 'otro' con el texto del destino (endocrino, psiquiatría, etc.)", () => {
    const r = createReferralSchema.safeParse({
      ...base,
      referredTo: "otro",
      referredToOther: "Endocrinología",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza un motivo vacío", () => {
    expect(createReferralSchema.safeParse({ ...base, referredTo: "medico", reason: "  " }).success).toBe(
      false,
    );
  });
});
