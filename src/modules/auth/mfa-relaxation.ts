// Lector de entorno PURO (sin secretos ni BD; por eso no lleva `server-only` y es testeable). Solo lo
// llama el layout (servidor); en un cliente los env no-publicos serian undefined y devolveria false.
//
// Relajacion del segundo factor SOLO para el entorno de PRUEBAS (gate Hito 2: los profesionales que
// prueban no pueden configurar cada uno un autenticador, y Santiago no acompaña a cada uno). NO es un
// interruptor que alguien pueda encender mal: es codigo que se NIEGA a funcionar en produccion, por
// construccion (condicion registrada en BACKLOG y LANZAMIENTO).
//
// La relajacion es INERTE en produccion por DOS candados independientes:
//   (a) `VERCEL_ENV` lo pone Vercel automaticamente (production/preview/development), NO se setea a mano;
//       si es "production", esta funcion devuelve false SIEMPRE, pase lo que pase con el flag.
//   (b) doble candado barato: si el proyecto de Supabase en uso es el de PRODUCCION
//       (NEXT_PUBLIC_SUPABASE_URL === ATLAS_PROD_SUPABASE_URL), tambien devuelve false. Asi ni un flag
//       copiado por error ni un deploy mal configurado relajan la base de produccion.
//
// IMPORTANTE (sin rastro): la relajacion solo PAUSA la exigencia (el redirect a enroll/challenge del
// layout); NO marca ninguna cuenta como exenta. `mfaRequirement` sigue devolviendo "enroll" para un rol
// obligatorio sin TOTP, asi que al quitar la relajacion (Hito 3) TODAS esas cuentas caen al enroll en el
// proximo login. No queda ninguna sin segundo factor "para siempre".
export function mfaRelaxedForTesting(): boolean {
  if (process.env.ATLAS_MFA_RELAXED !== "1") return false;
  // Candado (a): produccion NUNCA relaja. Vercel marca VERCEL_ENV; no es un valor que se ponga a mano.
  if (process.env.VERCEL_ENV === "production") return false;
  // Candado (b): el proyecto de Supabase de produccion NUNCA relaja, aunque el flag y VERCEL_ENV fallaran.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const prodUrl = process.env.ATLAS_PROD_SUPABASE_URL ?? "";
  if (prodUrl && supabaseUrl === prodUrl) return false;
  return true;
}
