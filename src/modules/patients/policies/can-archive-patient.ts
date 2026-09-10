import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy contextual (regla 3): quien puede ARCHIVAR y DESARCHIVAR un paciente.
//
// ── ARCHIVAR NO ES BORRAR, Y ESA ES LA RAZON DE QUE EXISTA ──────────────────────────────────────────
//
// Santiago pidio archivar y NO eliminar (2026-09-10), y la razon se sostiene sola: un paciente con datos
// clinicos arrastra evaluaciones, diagnosticos sellados y su rastro de auditoria. Borrarlo rompe la
// trazabilidad que la regla dura 8 protege, y ademas dejaria eventos de auditoria apuntando a una entidad
// que ya no existe. Archivar mueve `patients.status` a `inactive` y no toca NADA mas: el paciente sigue
// completo y su historia sigue ahi.
//
// ── QUIEN ──────────────────────────────────────────────────────────────────────────────────────────
//
// EL PROFESIONAL Y EL ADMIN, a diferencia de `canCreatePatientPresencial` (solo profesional). Crear en
// consulta exige haber estado en la sala: quien crea firma una declaracion sobre un acto que ocurrio
// delante suyo. Archivar no afirma nada sobre el paciente, es una decision de ORGANIZACION de la lista, y
// un admin depurando el roster es un caso legitimo.
//
// El alcance fino lo sigue poniendo la RLS: el profesional solo ve (y por tanto solo archiva) los suyos.
export function canArchivePatient(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}
