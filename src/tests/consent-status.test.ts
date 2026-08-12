import { describe, expect, it, vi } from "vitest";

import { buildConsentStatus } from "@/modules/evaluations/data/consent-status-reader";

vi.mock("server-only", () => ({}));

// Ensamble del estado de consentimiento (puro): vigencia de las 3 necesarias, revocacion y rama
// menor. La lectura por RLS no se testea aqui (la gatea patient_consents_select, verificada).

const base = {
  consent_version: "1.7",
  signed_at: "2026-07-01T00:00:00Z",
  revoked_at: null,
  legal_representative_name: null,
  legal_representative_relationship: null,
};

describe("buildConsentStatus", () => {
  it("las 2 necesarias vigentes (v1.0) => allNecessaryActive", () => {
    // v1.0 (revision legal): las necesarias del gate son DOS (internacional_ia dejo de ser autorizacion).
    const s = buildConsentStatus([
      { ...base, consent_type: "servicio" },
      { ...base, consent_type: "datos_sensibles" },
    ]);
    expect(s.allNecessaryActive).toBe(true);
    expect(s.necessary).toHaveLength(2);
    expect(s.necessary.every((n) => n.active && n.version === "1.7")).toBe(true);
    expect(s.representative).toBeNull();
  });

  it("una revocada => no allNecessaryActive y esa marca active=false", () => {
    const s = buildConsentStatus([
      { ...base, consent_type: "servicio" },
      { ...base, consent_type: "datos_sensibles", revoked_at: "2026-07-10T00:00:00Z" },
      { ...base, consent_type: "internacional_ia" },
    ]);
    expect(s.allNecessaryActive).toBe(false);
    expect(s.necessary.find((n) => n.type === "datos_sensibles")?.active).toBe(false);
  });

  it("rama menor => representante presente", () => {
    const s = buildConsentStatus([
      { ...base, consent_type: "servicio" },
      { ...base, consent_type: "datos_sensibles" },
      { ...base, consent_type: "internacional_ia" },
      {
        ...base,
        consent_type: "representante_legal",
        legal_representative_name: "Ana Ruiz",
        legal_representative_relationship: "madre",
      },
    ]);
    expect(s.representative).toEqual({ name: "Ana Ruiz", relationship: "madre" });
  });
});
