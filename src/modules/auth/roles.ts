// Tipos y helpers de rol PUROS (sin server-only), para que las policies y sus
// tests se importen sin arrastrar codigo de servidor. session.ts los reexporta.

// Espeja el enum app_role de la BD.
export type AppRole = "admin" | "direccion" | "soporte" | "obbia" | "professional";

export type CurrentUser = {
  id: string; // = auth.users.id = profiles.id
  email: string;
  fullName: string;
  organizationId: string;
  status: "active" | "inactive";
  roles: AppRole[];
};

export function hasRole(user: CurrentUser, role: AppRole): boolean {
  return user.roles.includes(role);
}

export function hasAnyRole(user: CurrentUser, roles: readonly AppRole[]): boolean {
  return roles.some((r) => user.roles.includes(r));
}
