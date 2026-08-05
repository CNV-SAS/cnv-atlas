import Link from "next/link";

import { ForgotPasswordForm } from "@/modules/auth/components/forgot-password-form";

export const metadata = { title: "Recuperar clave - Atlas" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Recuperar clave</h1>
      <p className="text-sm text-muted-foreground">
        Escribe tu correo y te enviaremos un enlace para fijar una clave nueva.
      </p>
      <ForgotPasswordForm />
      <Link href="/login" className="text-sm underline underline-offset-4">
        Volver a iniciar sesion
      </Link>
    </>
  );
}
