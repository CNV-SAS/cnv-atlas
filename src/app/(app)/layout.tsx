import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { navItemsForRoles } from "@/components/layout/nav-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { INTERNAL_ROLES, mfaRequirement } from "@/modules/auth/mfa-policy";
import { hasAnyRole } from "@/modules/auth/roles";
import { requireUser } from "@/modules/auth/session";

// Layout de las rutas autenticadas. requireUser asegura sesion activa. El
// enforcement de MFA aplica SOLO a internos: un professional no llega siquiera a
// consultar las APIs de MFA, asi que nunca se le redirige a setup ni a challenge.
// Resuelta la sesion, monta el shell con la navegacion filtrada por rol.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  if (hasAnyRole(user, INTERNAL_ROLES)) {
    const supabase = await createSupabaseServerClient();
    const [{ data: aal }, { data: factors }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    const hasVerifiedTotp = (factors?.totp?.length ?? 0) > 0;
    const req = mfaRequirement(user, hasVerifiedTotp, aal?.currentLevel ?? null);
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
