import { err, ok, type Result } from "@/core/errors/result";
import { hasRole, type AppRole, type CurrentUser } from "@/modules/auth/roles";

// Reglas PURAS del mecanismo de grants (sin server-only ni BD), para que el service y
// sus tests las compartan. Espejan los enums de la BD.

export type AccessGrantType = "notes_pseudonymous" | "notes_identified";
export type AccessReasonCategory = "auditoria_calidad" | "soporte_tecnico";
export type AccessGrantStatus = "pending" | "approved" | "denied" | "revoked";

// Topes de duracion por nivel (Clausula 17: ni el Nivel b es monitoreo continuo). Se
// aplican al aprobar; la renovacion es un grant nuevo, no una extension. Documentados en
// SECURITY.md como control de gobierno.
export const GRANT_LIMITS: Record<AccessGrantType, { defaultHours: number; maxHours: number }> = {
  // Nivel (b): default 30 dias, tope duro 90 dias.
  notes_pseudonymous: { defaultHours: 720, maxHours: 2160 },
  // Nivel (c): default 48 horas, tope duro 7 dias.
  notes_identified: { defaultHours: 48, maxHours: 168 },
};

// Matriz solicitante -> aprobador: soporte lo aprueba admin; admin lo aprueba direccion
// (admin no puede autoaprobarse). Si el usuario tiene ambos roles, prevalece admin
// (necesita a direccion). Devuelve null si el rol no puede solicitar.
export function computeApproverRole(requester: CurrentUser): AppRole | null {
  if (hasRole(requester, "admin")) return "direccion";
  if (hasRole(requester, "soporte")) return "admin";
  return null;
}

// Un aprobador puede decidir un grant si NO es el propio solicitante (nadie se
// autoaprueba) y tiene el rol que ese grant designo como aprobador.
export function canDecideGrant(
  approver: CurrentUser,
  grant: { requesterId: string; approverRole: AppRole },
): boolean {
  if (approver.id === grant.requesterId) return false;
  return hasRole(approver, grant.approverRole);
}

// Resuelve la duracion efectiva del grant al aprobar: default del nivel si no se pide una,
// o la pedida acotada por el tope duro. Nunca supera el maximo del nivel.
export function resolveExpiryHours(
  grantType: AccessGrantType,
  requestedHours?: number,
): Result<number, string> {
  const limits = GRANT_LIMITS[grantType];
  if (requestedHours == null) return ok(limits.defaultHours);
  if (!Number.isInteger(requestedHours) || requestedHours < 1) {
    return err("La duracion debe ser un numero entero de horas positivo.");
  }
  if (requestedHours > limits.maxHours) {
    return err(`La duracion excede el tope de ${limits.maxHours} horas para este nivel.`);
  }
  return ok(requestedHours);
}
