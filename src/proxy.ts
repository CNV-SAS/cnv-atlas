import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// proxy.ts (Next 16, antes "middleware"). NO es capa de seguridad (SECURITY.md):
// solo refresca la sesion de Supabase en cada request y redirige por presencia de
// sesion. La autorizacion real vive en RLS y en las policies del codigo.

const PUBLIC_PREFIXES = ["/encuesta", "/checkout", "/privacy", "/terms"];
const AUTH_PREFIXES = ["/login", "/set-password", "/mfa", "/auth"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response; // sin config no bloquea el arranque

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refresca el token si expiro (escribe cookies nuevas en la respuesta).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Las rutas /api nunca se redirigen a /login: los webhooks de pago (Wompi,
  // Alegra) llegan sin sesion y deben alcanzar su handler. Las APIs que requieran
  // sesion se protegen en su propio handler, no aqui. El refresco de sesion de
  // arriba ya corrio, asi que las cookies quedan frescas para esas rutas.
  if (path.startsWith("/api")) return response;

  const isPublic =
    PUBLIC_PREFIXES.some((p) => path.startsWith(p)) ||
    AUTH_PREFIXES.some((p) => path.startsWith(p));

  // Sin sesion en ruta protegida -> login.
  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Con sesion en /login -> dashboard.
  if (user && path === "/login") {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashUrl);
  }

  return response;
}

export const config = {
  // Excluye estaticos y assets; el resto pasa por el proxy.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
