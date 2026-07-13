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
  | "auditoria"
  | "direccion"
  | "obbia";

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
    label: "Direccion",
    href: "/direccion",
    icon: "direccion",
    roles: ["admin", "direccion"],
  },
  {
    label: "Investigacion",
    href: "/obbia",
    icon: "obbia",
    roles: ["admin", "obbia"],
  },
  {
    // Pacientes es una vista clinica: por RLS solo la ven el profesional dueno, admin y
    // soporte. Direccion y obbia no acceden a datos de paciente (sus tableros son agregados),
    // por eso no aparece para ellos aunque el link exista.
    label: "Pacientes",
    href: "/pacientes",
    icon: "clinica",
    roles: ["admin", "professional"],
  },
  {
    label: "Evaluaciones",
    href: "/evaluaciones",
    icon: "evaluaciones",
    roles: ["admin", "professional"],
  },
  {
    // Reportes tambien es clinico (RLS: profesional dueno o admin). Fuera para direccion/obbia.
    label: "Reportes",
    href: "/reportes",
    icon: "reportes",
    roles: ["admin", "professional"],
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
  {
    // Auditoria de notas seudonimizada (Nivel b). Visible para quien puede solicitar y
    // sostener un grant; el contenido lo gobierna la RLS (grant activo + Anexo 3).
    label: "Auditoria de notas",
    href: "/auditoria/notas",
    icon: "auditoria",
    roles: ["admin", "soporte"],
  },
  {
    label: "Solicitar acceso",
    href: "/auditoria/solicitar",
    icon: "auditoria",
    roles: ["admin", "soporte"],
  },
  {
    // Bandeja de aprobacion: admin aprueba a soporte, direccion aprueba a admin.
    label: "Aprobaciones de acceso",
    href: "/auditoria/aprobaciones",
    icon: "auditoria",
    roles: ["admin", "direccion"],
  },
];

// Devuelve los items visibles para un conjunto de roles, en el orden definido.
export function navItemsForRoles(roles: readonly AppRole[]): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.some((r) => roles.includes(r)));
}

// Un item coincide con la ruta si es exacta o si es un prefijo de segmento (ancestro).
export function pathMatches(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Item activo = gana el prefijo mas largo. Evita que /admin (Usuarios) se marque activo en
// /admin/ia o /admin/auditoria, porque esos tienen un href mas largo que tambien coincide; a
// la vez conserva el resaltado de la seccion en rutas de detalle como /evaluaciones/[id],
// donde no existe un item mas especifico.
export function isNavItemActive(href: string, pathname: string, items: NavItem[]): boolean {
  if (!pathMatches(href, pathname)) return false;
  return !items.some(
    (other) => other.href.length > href.length && pathMatches(other.href, pathname),
  );
}
