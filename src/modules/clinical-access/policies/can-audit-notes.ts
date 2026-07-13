import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy contextual (SECURITY.md, regla dura 3): quien puede abrir la pantalla de
// auditoria de notas (Nivel b). Solo los roles internos operativos que pueden pedir un
// grant: admin y soporte. Ver el contenido depende ademas de tener un grant
// notes_pseudonymous activo (lo gobierna la RLS); esta policy es la puerta de la
// pantalla, no la del dato. dirección y obbia no acceden; el profesional ve sus notas
// por la via normal, no por aqui.
export function canAuditNotes(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin", "soporte"]);
}
