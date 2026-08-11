// URL absoluta de la pagina de reanudacion de la encuesta. Modulo NEUTRO (sin server-only ni "use
// client"): lo usan la accion del servidor (para el correo) y la pantalla "firmado" (en cliente), y AMBOS
// deben producir el MISMO enlace.
//
// Prefiere el dominio canonico NEXT_PUBLIC_APP_URL:
//   - Es lo que va en un correo: persistente, tiene que funcionar siempre, no puede depender de por donde
//     entro el paciente (una URL de deploy de Vercel o un Host reescrito darian un enlace roto).
//   - Garantiza que el enlace del correo y el de la pantalla sean identicos (los dos salen de aqui).
// El origen de la request/navegador es solo fallback de desarrollo (cuando la variable no esta puesta).
// Devuelve "" si no hay forma de construir un absoluto.
export function buildResumeUrl(resumeToken: string, fallbackOrigin?: string | null): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || fallbackOrigin || "").replace(/\/+$/, "");
  return base ? `${base}/encuesta/reanudar/${resumeToken}` : "";
}
