// Configuracion de navegacion del shell. Modulo puro y serializable (el icono
// es una clave string, no un componente) para poder filtrarlo en el Server
// Component del layout y pasar el resultado al shell cliente. La visibilidad por
// rol es presentacion; la autorizacion real de cada ruta vive en su policy.
import type { AppRole } from "@/modules/auth/roles";

export type NavIconKey =
  | "dashboard"
  | "clinica"
  | "evaluaciones"
  | "reportes"
  | "comercial"
  | "comodato"
  | "nutraceuticos"
  | "pagos"
  | "consentimiento"
  | "admin"
  | "ia"
  | "auditoria";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIconKey;
  roles: readonly AppRole[];
};

// Matriz nav por rol (confirmada para B3). Se afina cuando aterricen los modulos.
export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Tablero",
    href: "/dashboard",
    icon: "dashboard",
    roles: ["admin", "direccion", "soporte", "obbia", "professional"],
  },
  {
    label: "Pacientes",
    href: "/pacientes",
    icon: "clinica",
    roles: ["admin", "direccion", "obbia", "professional"],
  },
  {
    label: "Evaluaciones",
    href: "/evaluaciones",
    icon: "evaluaciones",
    roles: ["admin", "professional"],
  },
  {
    label: "Reportes",
    href: "/reportes",
    icon: "reportes",
    roles: ["admin", "direccion", "obbia", "professional"],
  },
  {
    label: "Comercial",
    href: "/comercial",
    icon: "comercial",
    roles: ["admin", "direccion"],
  },
  {
    label: "Comodato",
    href: "/comodato",
    icon: "comodato",
    roles: ["admin", "soporte"],
  },
  {
    label: "Nutraceuticos",
    href: "/nutraceuticos",
    icon: "nutraceuticos",
    roles: ["admin", "soporte", "direccion"],
  },
  {
    label: "Pagos",
    href: "/pagos",
    icon: "pagos",
    roles: ["admin", "direccion", "professional"],
  },
  {
    // Referencia de solo lectura del consentimiento vigente (DELTA2 C1). Aplica a
    // cualquier rol autenticado; la pagina solo exige sesion, sin policy especial.
    label: "Consentimiento vigente",
    href: "/consentimiento",
    icon: "consentimiento",
    roles: ["admin", "direccion", "soporte", "obbia", "professional"],
  },
  {
    label: "Usuarios",
    href: "/admin",
    icon: "admin",
    roles: ["admin"],
  },
  {
    label: "IA",
    href: "/admin/ia",
    icon: "ia",
    roles: ["admin"],
  },
  {
    label: "Auditoria",
    href: "/admin/auditoria",
    icon: "auditoria",
    roles: ["admin"],
  },
];

// Devuelve los items visibles para un conjunto de roles, en el orden definido.
export function navItemsForRoles(roles: readonly AppRole[]): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.some((r) => roles.includes(r)));
}
