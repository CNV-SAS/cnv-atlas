import { type CurrentUser, hasAnyRole } from "@/modules/auth/roles";

// Policies de gestion de evaluaciones por sesion (regla 3). El alcance fino por
// paciente (is_patient_professional) lo impone la RLS al leer/escribir; estas solo
// gobiernan el rol.

// Confirmar identidad: el profesional del paciente o un admin.
export function canConfirmIdentity(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}

// Emitir link de seguimiento: el profesional (dueno del link) o un admin. El
// professional_id del link es el del profesional asignado al paciente; cuando lo
// emite un admin se resuelve a ese profesional (mismo patron que el checkout de B6).
// La RLS (survey_links_insert) ya admite ambos: el profesional dueno y admin.
export function canEmitFollowupLink(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}

// Gestionar el link base (inicial reusable) de consultorio del profesional. Es del
// propio profesional; la accion resuelve el professional_id del usuario autenticado.
export function canManageBaseSurveyLink(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}

// Cerrar (archivar) un shell firmado sin responder: SOLO el profesional dueno del paciente. No admin: es
// su paciente y el sabe si va a volver; ampliarlo a admin es un cambio de RLS que no urge (la RLS de
// update de evaluations hoy solo cubre al profesional dueno). El alcance fino (que sea su paciente) lo
// impone la RLS al leer la evaluacion en el action.
export function canAbandonEvaluation(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional"]);
}

// ═══ REGISTRAR LA ENCUESTA CON EL PACIENTE AL LADO (2026-09-24) ═══
//
// Hay pacientes que firman y dejan la encuesta sin responder (sin conexion, o porque la llenan con la
// profesional en consulta). El enlace de reanudacion solo se le muestra al PACIENTE, asi que ella no tenia
// como abrirla: la unica accion disponible en ese estado era CERRAR la evaluacion, o sea archivar un
// consentimiento ya firmado y empezar de cero.
//
// SOLO EL PROFESIONAL DUEÑO, igual que cerrar y por la misma razon: es su paciente y es un acto de su
// consulta. El alcance fino (que sea SU paciente) lo impone la RLS al leer la evaluacion en el action.
export function canRegistrarEncuestaDelPaciente(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional"]);
}

// ═══ RETIRAR UNA CONSULTA QUE NO OCURRIO (0212, Santiago 2026-10-07) ═══
//
// EL PROFESIONAL DUEÑO Y ADMIN, y la diferencia con `canAbandonEvaluation` (que es solo el profesional) tiene
// dos razones concretas:
//
//   1. POR QUIEN HACE EL TRABAJO. Retirar consultas importadas que no ocurrieron es DEPURACION de un lote: la
//      hace Santiago revisando con la Integrante, no la Integrante una por una. Con la policy en
//      "solo profesional", el unico que puede limpiar es quien no lo esta haciendo. Lo descubrio el, que abrio
//      la ficha y no vio el boton.
//   2. Y POR QUE AQUI SI SE PUEDE. El argumento de `canAbandonEvaluation` es la RLS ("el update de evaluations
//      hoy solo cubre al profesional dueno"), y es correcto para ese camino. El retiro escribe por Drizzle
//      (service role), asi que no choca con esa RLS. No se amplia la otra policy: su razon sigue en pie.
//
// EL ALCANCE FINO LO SIGUE IMPONIENDO LA RLS AL LEER: el action resuelve la evaluacion con el cliente con
// sesion antes de escribir, asi que un profesional solo alcanza las de sus pacientes. Admin ve todas, que es
// justamente lo que hace falta para depurar un lote.
//
// SOPORTE NO: retirar una consulta cambia lo que dice una historia clinica, y soporte acompaña sin decidir
// sobre el registro clinico.
export function canRetirarConsulta(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}
