import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SetPasswordForm } from "@/modules/auth/components/set-password-form";
import { SetPasswordMfaForm } from "@/modules/auth/components/set-password-mfa-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Fijar contraseña - Atlas" };

// Requisito de seguridad: una sesion normal NO basta para fijar contrasena aqui. Solo el callback
// /auth/confirm, tras verificar un token de invitacion o recuperacion valido server-side, fija la cookie
// httpOnly atlas-pwd-reset. Sin ella, se redirige a /login aunque exista una sesion activa.
//
// Y NO se cambia la contrasena sin el segundo factor: si la cuenta tiene MFA, Supabase exige AAL2 para el
// cambio (insufficient_aal). Por eso, si la sesion de recuperacion es AAL1 y hay MFA, se pide primero el
// reto de MFA (eleva a AAL2) y solo despues el formulario de clave. Un invitado nuevo no tiene MFA -> pasa
// directo. La escotilla si perdio tambien el factor: el admin lo reinicia (resetUserMfa).
export default async function SetPasswordPage() {
  const cookieStore = await cookies();
  if (cookieStore.get("atlas-pwd-reset")?.value !== "1") {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Sin sesion de recuperacion no se puede fijar la clave (el token no dejo sesion).
    redirect("/login?error=enlace_invalido");
  }

  // Si la cuenta tiene MFA y la sesion aun es AAL1, primero el segundo factor.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsMfa = aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2";

  return (
    <>
      <h1 className="text-xl font-semibold">Fijar tu contraseña</h1>
      {needsMfa ? <SetPasswordMfaForm /> : <SetPasswordForm />}
    </>
  );
}
