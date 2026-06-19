import { redirect } from "next/navigation";

import { MfaSetup } from "@/modules/auth/components/mfa-setup";
import { getCurrentUser } from "@/modules/auth/session";

export const metadata = { title: "Configurar MFA - Atlas" };

// Fuera del grupo (app) para no entrar en bucle con el enforcement del layout.
// Exige sesion (aal1 basta para enrolar); sin ella, a /login.
export default async function MfaSetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <h1 className="text-xl font-semibold">Configura la verificacion en dos pasos</h1>
      <MfaSetup />
    </>
  );
}
