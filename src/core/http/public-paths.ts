// Rutas accesibles SIN sesion. Vive aparte del proxy (que es Edge, con imports de @supabase/ssr) para poder
// probarse en node: el bug de /forgot-password (una pagina de recuperacion que el proxy rebotaba a /login,
// porque no estaba en la lista) no lo atrapaba ningun test porque el codigo de la pagina estaba bien y el
// enrutamiento no. Un test sobre esta funcion pura SI lo atrapa.

// Publicas de verdad (sin sesion ni intencion de auth): encuesta del paciente, checkout, legales.
export const PUBLIC_PREFIXES = ["/encuesta", "/checkout", "/privacy", "/terms"];

// De autenticacion: se acceden SIN sesion (el que las necesita justamente no puede entrar). OJO: toda pagina
// de recuperacion/acceso va aqui. `/mfa` cubre /mfa-challenge y /mfa-setup; `/auth` cubre los callbacks.
export const AUTH_PREFIXES = ["/login", "/forgot-password", "/set-password", "/mfa", "/auth"];

export function isPublicPath(path: string): boolean {
  return (
    PUBLIC_PREFIXES.some((p) => path.startsWith(p)) || AUTH_PREFIXES.some((p) => path.startsWith(p))
  );
}
