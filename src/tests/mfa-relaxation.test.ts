import { afterEach, describe, expect, it, vi } from "vitest";

import { mfaRelaxedForTesting } from "@/modules/auth/mfa-relaxation";

// La relajacion del MFA es POSITIVA y FAIL-SAFE: el flag ES la URL de Supabase del entorno de PRUEBAS, y
// solo se activa si la URL en uso coincide EXACTAMENTE. Se prueba que produccion (otra base) nunca la
// active, ni copiando el flag; y que el candado NO depende de VERCEL_ENV (que vale "production" tambien en
// la rama principal del proyecto de pruebas, asi que no distingue).
const OLD = { ...process.env };
afterEach(() => {
  process.env = { ...OLD };
  vi.unstubAllEnvs();
});

function setEnv(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v ?? "");
}

const PRUEBAS = "https://staging.supabase.co";
const PROD = "https://prod.supabase.co";

describe("mfaRelaxedForTesting", () => {
  it("sin el flag -> false", () => {
    setEnv({ ATLAS_MFA_RELAXED: undefined, NEXT_PUBLIC_SUPABASE_URL: PRUEBAS });
    expect(mfaRelaxedForTesting()).toBe(false);
  });
  it("el flag nombra la base EN USO (pruebas) -> true, aunque VERCEL_ENV sea production", () => {
    // Clave: en la rama principal del proyecto de pruebas VERCEL_ENV vale "production"; la relajacion NO
    // debe depender de eso. Coincide la URL -> activa.
    setEnv({ ATLAS_MFA_RELAXED: PRUEBAS, NEXT_PUBLIC_SUPABASE_URL: PRUEBAS, VERCEL_ENV: "production" });
    expect(mfaRelaxedForTesting()).toBe(true);
  });
  it("produccion (otra base) con el flag copiado por error -> false (inerte por construccion)", () => {
    // El flag quedo apuntando a la base de pruebas, pero corremos contra la de produccion: no coincide.
    setEnv({ ATLAS_MFA_RELAXED: PRUEBAS, NEXT_PUBLIC_SUPABASE_URL: PROD, VERCEL_ENV: "production" });
    expect(mfaRelaxedForTesting()).toBe(false);
  });
  it("flag con un valor cualquiera que no es la URL en uso -> false", () => {
    setEnv({ ATLAS_MFA_RELAXED: "1", NEXT_PUBLIC_SUPABASE_URL: PRUEBAS });
    expect(mfaRelaxedForTesting()).toBe(false);
  });
});
