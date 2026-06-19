import "server-only";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { type AppRole, type CurrentUser, hasAnyRole, hasRole } from "./roles";

// Reexporta los helpers puros para que los call sites de servidor importen todo
// desde "./session" como antes.
export type { AppRole, CurrentUser };
export { hasAnyRole, hasRole };

// Usuario autenticado actual con sus roles, leido bajo RLS (datos propios).
// getUser() valida el JWT contra el servidor de Auth (no confia en la cookie).
// Los roles salen del helper current_user_roles() (RPC), que ya resuelve por
// auth.uid(); asi se evita la ambiguedad del select embebido.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, organization_id, status")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  const { data: roleData } = await supabase.rpc("current_user_roles");
  const roles = (roleData as AppRole[] | null) ?? [];

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    organizationId: profile.organization_id,
    status: profile.status as "active" | "inactive",
    roles,
  };
}

// Exige sesion activa. Sin sesion: a /login. Con sesion pero status inactivo:
// a /auth/logout, que hace signOut() y limpia las cookies (logout inmediato, no
// solo un rebote; una cuenta desactivada no debe conservar sesion valida).
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "active") redirect("/auth/logout");
  return user;
}
