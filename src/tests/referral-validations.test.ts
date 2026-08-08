import { describe, expect, it } from "vitest";

import { createReferralSchema, isFutureDate } from "@/modules/referrals/validations";

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

// D-009 (smoke 2026-08-08): una remisión (o un retorno) no puede fecharse en el futuro; el acto que se
// registra ya ocurrió. Antes el cálculo de "pendiente hace X" no contemplaba negativos y una fecha futura
// se mostraba como "hoy"; la raíz es que no debería poder registrarse.
describe("isFutureDate", () => {
  const today = "2026-08-08";
  it("hoy NO es futuro (se permite registrar hoy)", () => {
    expect(isFutureDate(today, today)).toBe(false);
  });
  it("una fecha anterior NO es futuro (registrar después algo hecho antes)", () => {
    expect(isFutureDate("2026-07-01", today)).toBe(false);
  });
  it("una fecha posterior a hoy SÍ es futuro (se rechaza)", () => {
    expect(isFutureDate("2026-08-09", today)).toBe(true);
    expect(isFutureDate("2999-01-01", today)).toBe(true);
  });
});
