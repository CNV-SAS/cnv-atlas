import { hasRole, type CurrentUser } from "@/modules/auth/roles";

// ═══ QUIEN LE QUITA EL ACCESO A UN INTEGRANTE (regla dura 14, Gildardo 2026-10-25) ═══
//
// SOLO ADMIN, y no `soporte` ni `direccion`. Quitar el acceso es la mitad del offboarding: deja a una
// persona fuera de las historias clinicas de sus pacientes y sus pacientes sin quien los atienda hasta que
// alguien los reasigne. Es una decision de la organizacion, no una operacion de mesa de ayuda.
//
// VA EN UNA POLICY PROPIA y no reusa `canAccessAdmin` en el call site, aunque hoy devuelvan lo mismo: la
// regla dura 3 es que la autorizacion se nombra, y el dia que `soporte` pueda entrar a /admin esta pregunta
// tiene que seguir respondiendo que no. Una policy con nombre propio es lo que hace que ese dia se note.
export function canDeactivateProfessional(user: CurrentUser): boolean {
  return hasRole(user, "admin");
}
