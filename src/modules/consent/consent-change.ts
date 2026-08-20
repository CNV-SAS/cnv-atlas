// Guard de "sin cambios" para el camino de EXCEPCION del seguimiento (dictamen legal 2026-08-20 §3): si el
// paciente entra por la excepcion ("cambiar autorizaciones o contacto") y confirma SIN cambiar nada, NO se
// crea un consentimiento nuevo (pedir la misma autorizacion repetidamente la degrada; el asesor lo subraya).
// Compara las TRES cosas: autorizaciones, version y contacto. Una diferencia en cualquiera dispara el
// re-consentimiento. Funcion PURA (sin BD) para poder probar los dos casos (identico no crea, distinto si).

export type ConsentState = {
  types: readonly string[]; // consent_type de las autorizaciones VIGENTES (revoked_at IS NULL)
  version: string; // version del consentimiento vigente
  email: string | null; // contacto vigente
  phone: string | null;
};

// true = lo enviado es IDENTICO a lo vigente (no crea consentimiento nuevo). Compara el CONJUNTO de
// autorizaciones (no el orden), la version exacta y el contacto (correo y celular).
export function consentUnchanged(vigente: ConsentState, submitted: ConsentState): boolean {
  if (vigente.version !== submitted.version) return false;
  if (vigente.email !== submitted.email) return false;
  if (vigente.phone !== submitted.phone) return false;
  const a = new Set(vigente.types);
  const b = new Set(submitted.types);
  if (a.size !== b.size) return false;
  for (const t of a) if (!b.has(t)) return false;
  return true;
}
