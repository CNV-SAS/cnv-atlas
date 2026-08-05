import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { navItemsForRoles } from "@/components/layout/nav-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MFA_REQUIRED_ROLES, mfaRequirement } from "@/modules/auth/mfa-policy";
import { hasAnyRole } from "@/modules/auth/roles";
import { requireUser } from "@/modules/auth/session";

// Layout de las rutas autenticadas. requireUser asegura sesion activa. El enforcement de MFA aplica a
// los roles de MFA_REQUIRED_ROLES (internos + PROFESIONAL, gate Hito 2): un profesional que pierde su
// cuenta expone las historias clinicas de sus pacientes. Un usuario sin rol requerido no llega a
// consultar las APIs de MFA. Resuelta la sesion, monta el shell con la navegacion filtrada por rol.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  if (hasAnyRole(user, MFA_REQUIRED_ROLES)) {
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
    <AppShell
      user={{ fullName: user.fullName, email: user.email }}
      navItems={navItemsForRoles(user.roles)}
    >
      {children}
    </AppShell>
  );
}
