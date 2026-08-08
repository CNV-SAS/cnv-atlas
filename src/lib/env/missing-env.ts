// Nombra EXACTAMENTE cual(es) variable(s) de entorno faltan, en vez de "Faltan A o B" (que obliga a
// revisar las dos cuando quiza solo falta una). Puro, sin dependencias: lo pueden usar tanto los
// clientes de servidor como el de navegador. Devuelve el mensaje, o null si estan todas.
//
// Uso: const msg = missingEnvMessage({ VAR_A: a, VAR_B: b }); if (msg) throw new Error(msg);
export function missingEnvMessage(vars: Record<string, string | undefined>): string | null {
  const missing = Object.entries(vars)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length === 0) return null;
  const plural = missing.length > 1;
  return `Falta${plural ? "n" : ""} la${plural ? "s" : ""} variable${plural ? "s" : ""} de entorno ${missing.join(" y ")}`;
}
