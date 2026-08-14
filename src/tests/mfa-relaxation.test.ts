import { afterEach, describe, expect, it, vi } from "vitest";

import { mfaRelaxedForTesting } from "@/modules/auth/mfa-relaxation";

// La relajacion del MFA es INERTE en produccion por construccion (dos candados). Se prueba que ningun
// escenario de produccion la active, aunque el flag este puesto.
const OLD = { ...process.env };
afterEach(() => {
  process.env = { ...OLD };
  vi.unstubAllEnvs();
});

function setEnv(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v ?? "");
}

describe("mfaRelaxedForTesting", () => {
  it("sin el flag -> false", () => {
    setEnv({ ATLAS_MFA_RELAXED: undefined, VERCEL_ENV: "preview" });
    expect(mfaRelaxedForTesting()).toBe(false);
  });
  it("con el flag en un preview (no produccion) -> true", () => {
    setEnv({ ATLAS_MFA_RELAXED: "1", VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: "https://staging.supabase.co", ATLAS_PROD_SUPABASE_URL: "https://prod.supabase.co" });
    expect(mfaRelaxedForTesting()).toBe(true);
  });
  it("candado (a): VERCEL_ENV=production -> false aunque el flag este", () => {
    setEnv({ ATLAS_MFA_RELAXED: "1", VERCEL_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "https://staging.supabase.co" });
    expect(mfaRelaxedForTesting()).toBe(false);
  });
  it("candado (b): el proyecto de Supabase de produccion -> false aunque el flag y VERCEL_ENV fallaran", () => {
    setEnv({ ATLAS_MFA_RELAXED: "1", VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: "https://prod.supabase.co", ATLAS_PROD_SUPABASE_URL: "https://prod.supabase.co" });
    expect(mfaRelaxedForTesting()).toBe(false);
  });
});
