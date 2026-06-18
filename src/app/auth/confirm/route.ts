import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Callback de invitacion/recuperacion. El token (token_hash) se intercambia
// SERVER-SIDE con verifyOtp; nunca llega al cliente. Tras verificarlo, fija una
// cookie httpOnly de corta vida que autoriza /set-password: asi una sesion normal
// (sin haber pasado por aqui con un token valido) no puede fijar contrasena.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next");
  // Solo rutas internas (evita open redirect).
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/set-password";

  if (!tokenHash || (type !== "invite" && type !== "recovery")) {
    redirect("/login?error=enlace_invalido");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    redirect("/login?error=enlace_expirado");
  }

  const cookieStore = await cookies();
  cookieStore.set("atlas-pwd-reset", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutos para completar el set-password
    path: "/",
  });

  redirect(next);
}
