import "server-only";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Espeja el enum app_role de la BD. Unica fuente para los call sites de auth.
export type AppRole = "admin" | "direccion" | "soporte" | "obbia" | "professional";

export type CurrentUser = {
  id: string; // = auth.users.id = profiles.id
  email: string;
  fullName: string;
  organizationId: string;
  status: "active" | "inactive";
  roles: AppRole[];
};

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

// Exige sesion activa; si no, redirige a /login. Para usar en layouts y actions.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect("/login");
  return user;
}

export function hasRole(user: CurrentUser, role: AppRole): boolean {
  return user.roles.includes(role);
}

export function hasAnyRole(user: CurrentUser, roles: readonly AppRole[]): boolean {
  return roles.some((r) => user.roles.includes(r));
}
