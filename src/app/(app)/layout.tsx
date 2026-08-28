import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { MfaRelaxedBanner } from "@/components/layout/mfa-relaxed-banner";
import { navGroupsForRoles } from "@/components/layout/nav-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MFA_REQUIRED_ROLES, mfaRequirement } from "@/modules/auth/mfa-policy";
import { mfaRelaxedForTesting } from "@/modules/auth/mfa-relaxation";
import { hasAnyRole } from "@/modules/auth/roles";
import { requireUser } from "@/modules/auth/session";

// Layout de las rutas autenticadas. requireUser asegura sesion activa. El enforcement de MFA aplica a
// los roles de MFA_REQUIRED_ROLES (internos + PROFESIONAL, gate Hito 2): un profesional que pierde su
// cuenta expone las historias clinicas de sus pacientes. Un usuario sin rol requerido no llega a
// consultar las APIs de MFA. Resuelta la sesion, monta el shell con la navegacion filtrada por rol.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Relajacion del segundo factor SOLO en pruebas (inerte en produccion por construccion, ver
  // mfa-relaxation). Cuando esta activa, se SALTA el redirect de enroll/challenge (no se marca a nadie
  // como exento: mfaRequirement sigue pidiendo "enroll", asi que al quitarla todos caen al enroll). Se
  // avisa con un banner permanente para todos, incluido el admin.
  const mfaRelaxed = mfaRelaxedForTesting();

  if (hasAnyRole(user, MFA_REQUIRED_ROLES) && !mfaRelaxed) {
    const supabase = await createSupabaseServerClient();
    // getClaims valida el JWT server-side (como getUser; en local cae a getUser)
    // y expone el claim aal sin tocar el user de getSession, asi que no dispara la
    // advertencia de uso inseguro de getSession. listFactors ya usa getUser.
    const [{ data: claimsData }, { data: factors }] = await Promise.all([
      supabase.auth.getClaims(),
      supabase.auth.mfa.listFactors(),
    ]);
    const hasVerifiedTotp = (factors?.totp?.length ?? 0) > 0;
    const currentLevel = claimsData?.claims.aal ?? null;
    const req = mfaRequirement(user, hasVerifiedTotp, currentLevel);
    if (req === "enroll") redirect("/mfa-setup");
    if (req === "challenge") redirect("/mfa-challenge");
  }

  return (
    <>
      {mfaRelaxed ? <MfaRelaxedBanner /> : null}
      <AppShell
        user={{ fullName: user.fullName, email: user.email }}
        grupos={navGroupsForRoles(user.roles)}
      >
        {children}
      </AppShell>
    </>
  );
}
