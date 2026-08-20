import { CONSENT_VERSION } from "./text/consent-v1.0";

export { CONSENT_VERSION };

// Marca de versiones del consentimiento (dictamen legal 2026-08-20 §3): cada version lleva si su cambio, respecto
// de la ANTERIOR, fue SUSTANTIVO (nuevas finalidades, categorias de datos o destinatarios => exige nueva
// aceptacion con codigo) o NO sustantivo (redaccion/correcciones/aclaraciones que no alteran el alcance => la
// autorizacion previa sigue valida, basta presentar la vigente de forma informativa). Asi el sistema decide
// SOLO si un seguimiento fuerza re-consentimiento, en vez de depender del criterio de quien publique la version.

export type ConsentVersionEntry = { version: string; substantive: boolean; note: string };

// Registro ORDENADO CRONOLOGICAMENTE (no por numero: v1.0 es la MAS NUEVA, va al final). v1.2..v1.7 fueron
// iteraciones internas que NINGUN paciente firmo (ver consent-v1.0.ts); se registran para que el historial
// quede completo y la comparacion sea correcta si alguna vez hubiera un firmante viejo.
export const CONSENT_VERSIONS: readonly ConsentVersionEntry[] = [
  { version: "1.2", substantive: false, note: "Iteracion interna, nadie la firmo." },
  { version: "1.5", substantive: false, note: "Iteracion interna, nadie la firmo." },
  { version: "1.7", substantive: false, note: "Iteracion interna, nadie la firmo." },
  {
    version: "1.0",
    substantive: true,
    note: "LANZAMIENTO (2026-08-12): consolida v1.2-v1.7 + revision legal del 11. SUSTANTIVA respecto de v1.7 (la etnia entro como finalidad de investigacion; 'internacional_ia' se absorbio en 'servicio'). Primera version que un paciente firma.",
  },
];

// ¿Pasar de la version `sealed` (la que firmo el paciente) a `current` exige re-consentimiento? True si entre
// ambas (EXCLUYENDO sealed, INCLUYENDO current) hubo AL MENOS UN cambio sustantivo. Misma version -> false.
// Version desconocida o fuera de orden -> conservador: true (mejor re-consentir que asumir cobertura que no hay).
export function requiresReconsent(
  sealedVersion: string,
  currentVersion: string = CONSENT_VERSION,
): boolean {
  if (sealedVersion === currentVersion) return false;
  const idxSealed = CONSENT_VERSIONS.findIndex((v) => v.version === sealedVersion);
  const idxCurrent = CONSENT_VERSIONS.findIndex((v) => v.version === currentVersion);
  if (idxSealed < 0 || idxCurrent < 0 || idxCurrent < idxSealed) return true;
  return CONSENT_VERSIONS.slice(idxSealed + 1, idxCurrent + 1).some((v) => v.substantive);
}
