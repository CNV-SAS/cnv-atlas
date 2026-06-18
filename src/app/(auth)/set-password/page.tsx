import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SetPasswordForm } from "@/modules/auth/components/set-password-form";

export const metadata = { title: "Fijar contrasena - Atlas" };

// Requisito de seguridad: una sesion normal NO basta para fijar contrasena aqui.
// Solo el callback /auth/confirm, tras verificar un token de invitacion o
// recuperacion valido server-side, fija la cookie httpOnly atlas-pwd-reset. Sin
// ella, se redirige a /login aunque exista una sesion activa.
export default async function SetPasswordPage() {
  const cookieStore = await cookies();
  if (cookieStore.get("atlas-pwd-reset")?.value !== "1") {
    redirect("/login");
  }

  return (
    <>
      <h1 className="text-xl font-semibold">Fijar tu contrasena</h1>
      <SetPasswordForm />
    </>
  );
}
