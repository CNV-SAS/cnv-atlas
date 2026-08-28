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
  | "obbia"
  | "perfil"
  | "verificacion";

// GRUPOS DE LA BARRA. Con hasta 16 items visibles, una lista plana deja de recorrerse: se lee entera cada
// vez en vez de saltar al bloque que interesa. Los grupos NO son una copia de la referencia: salen de los
// items que ya existen, que ya estaban ordenados en estos mismos racimos.
//
// `null` = sin rotulo. El Tablero va solo arriba: un grupo de un item no se rotula, el rotulo ocuparia mas
// que el item que agrupa.
export type NavGroup = "clinica" | "operacion" | "cuenta" | "administracion" | null;

export const GROUP_LABELS: Record<Exclude<NavGroup, null>, string> = {
  clinica: "Clínica",
  operacion: "Operación",
  cuenta: "Cuenta",
  administracion: "Administración",
};

// El ORDEN de los grupos en la barra. Lo clinico primero porque es el trabajo; la administracion al final
// porque se visita poco y solo la ve quien la necesita.
const GROUP_ORDER: NavGroup[] = [null, "clinica", "operacion", "cuenta", "administracion"];

// UMBRAL DE AGRUPACION. Los rotulos solo se pintan cuando la lista es lo bastante larga como para que
// agrupar AHORRE mas de lo que cuesta. Un profesional ve 8 items: en esa lista los rotulos son ruido, se
// abarca de un vistazo. Un admin ve 16: ahi la lista plana es la que cuesta. Es la misma logica adaptativa
// que ya tiene la barra por rol, aplicada a la forma en vez de al contenido.
export const UMBRAL_ROTULOS = 10;

export type NavItem = {
  label: string;
  href: string;
  icon: NavIconKey;
  roles: readonly AppRole[];
  group: NavGroup;
};

// Matriz nav por rol (confirmada para B3). Se afina cuando aterricen los modulos.
export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Tablero",
    href: "/dashboard",
    icon: "dashboard",
    roles: ["admin", "direccion", "soporte", "obbia", "professional"],
    group: null,
  },
  {
    label: "Dirección",
    href: "/direccion",
    icon: "direccion",
    roles: ["admin", "direccion"],
    group: null,
  },
  {
    label: "Investigación",
    href: "/obbia",
    icon: "obbia",
    roles: ["admin", "obbia"],
    group: null,
  },
  {
    // Pacientes es una vista clinica: por RLS solo la ven el profesional dueno, admin y
    // soporte. Direccion y obbia no acceden a datos de paciente (sus tableros son agregados),
    // por eso no aparece para ellos aunque el link exista.
    label: "Pacientes",
    href: "/pacientes",
    icon: "clinica",
    roles: ["admin", "professional"],
    group: "clinica",
  },
  {
    label: "Evaluaciones",
    href: "/evaluaciones",
    icon: "evaluaciones",
    roles: ["admin", "professional"],
    group: "clinica",
  },
  {
    // Reportes tambien es clinico (RLS: profesional dueno o admin). Fuera para direccion/obbia.
    label: "Reportes",
    href: "/reportes",
    icon: "reportes",
    roles: ["admin", "professional"],
    group: "clinica",
  },
  {
    label: "Comercial",
    href: "/comercial",
    icon: "comercial",
    roles: ["admin", "direccion"],
    group: "operacion",
  },
  {
    label: "Comodato",
    href: "/comodato",
    icon: "comodato",
    roles: ["admin", "soporte"],
    group: "operacion",
  },
  {
    label: "Nutracéuticos",
    href: "/nutraceuticos",
    icon: "nutraceuticos",
    roles: ["admin", "soporte", "direccion"],
    group: "operacion",
  },
  {
    // Inventario en consignacion del profesional (su stock de producto de CNV en custodia). Solo el
    // profesional: es su stock, distinto del catalogo comercial (admin/soporte).
    label: "Mi inventario",
    href: "/mi-inventario",
    icon: "nutraceuticos",
    roles: ["professional"],
    group: "operacion",
  },
  {
    label: "Faltantes",
    href: "/faltantes",
    icon: "nutraceuticos",
    roles: ["admin", "direccion"],
    group: "operacion",
  },
  {
    label: "Pagos",
    href: "/pagos",
    icon: "pagos",
    roles: ["admin", "direccion", "professional"],
    group: "operacion",
  },
  {
    // Referencia de solo lectura del consentimiento vigente (DELTA2 C1). Aplica a
    // cualquier rol autenticado; la pagina solo exige sesion, sin policy especial.
    label: "Consentimiento vigente",
    href: "/consentimiento",
    icon: "consentimiento",
    roles: ["admin", "direccion", "soporte", "obbia", "professional"],
    group: "cuenta",
  },
  {
    // Perfil del integrante (hoy, su estado tributario para poder cobrar la comision). Solo el
    // profesional: es su propio perfil. La pagina redirige a los no-integrantes.
    label: "Mi perfil",
    href: "/perfil",
    icon: "perfil",
    roles: ["professional"],
    group: "cuenta",
  },
  {
    // Verificacion tributaria del RUT de los integrantes (A2). Rol verificador: admin y soporte (trabajo
    // operativo recurrente, no gobernanza).
    label: "Verificación tributaria",
    href: "/verificaciones",
    icon: "verificacion",
    roles: ["admin", "soporte"],
    group: "administracion",
  },
  {
    label: "Usuarios",
    href: "/admin",
    icon: "admin",
    roles: ["admin"],
    group: "administracion",
  },
  {
    label: "IA",
    href: "/admin/ia",
    icon: "ia",
    roles: ["admin"],
    group: "administracion",
  },
  {
    label: "Auditoria",
    href: "/admin/auditoria",
    icon: "auditoria",
    roles: ["admin"],
    group: "administracion",
  },
  {
    // Auditoria de notas seudonimizada (Nivel b). Visible para quien puede solicitar y
    // sostener un grant; el contenido lo gobierna la RLS (grant activo + Anexo 3).
    label: "Auditoria de notas",
    href: "/auditoria/notas",
    icon: "auditoria",
    roles: ["admin", "soporte"],
    group: "administracion",
  },
  {
    label: "Solicitar acceso",
    href: "/auditoria/solicitar",
    icon: "auditoria",
    roles: ["admin", "soporte"],
    group: "administracion",
  },
  {
    // Bandeja de aprobacion: admin aprueba a soporte, direccion aprueba a admin.
    label: "Aprobaciones de acceso",
    href: "/auditoria/aprobaciones",
    icon: "auditoria",
    roles: ["admin", "direccion"],
    group: "administracion",
  },
];

// Devuelve los items visibles para un conjunto de roles, en el orden definido.
export function navItemsForRoles(roles: readonly AppRole[]): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.some((r) => roles.includes(r)));
}

// Los items visibles, ya repartidos en grupos y en el orden de la barra.
//
// `rotular` sale del TOTAL de items visibles, no del tamaño de cada grupo: lo que decide si agrupar ayuda
// es cuanto cuesta recorrer la lista ENTERA. Un grupo de dos items dentro de una lista de ocho no gana
// nada con un rotulo; el mismo grupo dentro de una lista de dieciseis, si.
//
// Los grupos VACIOS se caen: un rotulo sin items debajo es peor que ningun rotulo (anuncia una seccion que
// no existe para ese rol).
export type NavGrupoVisible = { group: NavGroup; label: string | null; items: NavItem[] };

export function navGroupsForRoles(roles: readonly AppRole[]): NavGrupoVisible[] {
  const visibles = navItemsForRoles(roles);
  const rotular = visibles.length >= UMBRAL_ROTULOS;
  return GROUP_ORDER.map((g) => ({
    group: g,
    label: rotular && g !== null ? GROUP_LABELS[g] : null,
    items: visibles.filter((i) => i.group === g),
  })).filter((g) => g.items.length > 0);
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
