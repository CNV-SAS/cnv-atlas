// Lector de entorno PURO (sin secretos ni BD; por eso no lleva `server-only` y es testeable). Solo lo
// llama el layout (servidor); en un cliente los env no-publicos serian undefined y devolveria false.
//
// Relajacion del segundo factor SOLO para el entorno de PRUEBAS (gate Hito 2: los profesionales que
// prueban no pueden configurar cada uno un autenticador, y Santiago no acompaña a cada uno). NO es un
// interruptor que alguien pueda encender mal: es codigo que se NIEGA a funcionar en produccion, por
// construccion (condicion registrada en BACKLOG y LANZAMIENTO).
//
// La relajacion es POSITIVA y FAIL-SAFE: solo se activa si la base de Supabase EN USO es EXACTAMENTE la
// que NOMBRA el flag. `ATLAS_MFA_RELAXED` NO es "1": es la URL de Supabase del entorno de PRUEBAS (la
// misma que NEXT_PUBLIC_SUPABASE_URL de ese proyecto). La relajacion se activa solo si
// `NEXT_PUBLIC_SUPABASE_URL === ATLAS_MFA_RELAXED`. Consecuencia: PRODUCCION -que apunta a OTRA base de
// Supabase- NUNCA coincide, asi el flag sea copiado por error a produccion: es inerte por construccion,
// sin depender de VERCEL_ENV (que vale "production" en la rama principal de CUALQUIER proyecto, tambien
// el de pruebas, asi que no distingue) ni de marcar produccion aparte. Funciona con UN solo proyecto hoy
// (el flag nombra la nube actual, que sera pruebas) y sigue seguro al separar entornos.
//
// IMPORTANTE (sin rastro): la relajacion solo PAUSA la exigencia (el redirect a enroll/challenge del
// layout); NO marca ninguna cuenta como exenta. `mfaRequirement` sigue devolviendo "enroll" para un rol
// obligatorio sin TOTP, asi que al quitar la relajacion (Hito 3) TODAS esas cuentas caen al enroll en el
// proximo login. No queda ninguna sin segundo factor "para siempre".
export function mfaRelaxedForTesting(): boolean {
  const flag = process.env.ATLAS_MFA_RELAXED;
  if (!flag) return false;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  // Confirmacion POSITIVA de la base de pruebas: la URL en uso debe ser EXACTAMENTE la que nombra el flag.
  return supabaseUrl.length > 0 && supabaseUrl === flag;
}
