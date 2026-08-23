import { type CurrentUser, hasRole } from "@/modules/auth/roles";

// Policies del protocolo por especialidad (T2 A2). Regla dura 3: gobiernan el ROL; el
// alcance fino (que sea ESTE profesional, el asignado a ESTE paciente) lo impone la lectura
// RLS del service (getTreatmentProtocol devuelve null si la evaluacion no es del profesional).
//
// PROFESIONAL-SOLO, admin NO. Motivo (escrito aqui a proposito, no solo en el commit, para
// que nadie lo "arregle" creyendolo una omision): estos campos son actos clinicos, no
// operativos. Los adj_* son los INPUTS CLINICOS de la prescripcion (adj_prot_gkg fija la
// proteina; adj_peso_meta sustituye el peso de calculo en toda la cadena calorica), y
// reconocer contraindicaciones del modelo es acto clinico por definicion. Un admin de CNV es
// rol operativo (invita integrantes, gestiona cuentas), no necesariamente profesional de la
// salud; un permiso operativo no hereda hacia un acto clinico (mismo criterio de ambito de
// practica que motivo el campo profession). Estas columnas son NUEVAS (T2 A2), nacen
// profesional-solo; lo que ya existia (canManageTreatment, professional+admin) queda como
// esta y se revisa en el item de gobernanza diferido (BACKLOG).

// Editar el borrador del protocolo: ajustes (adj_*) y objetivos efectivos.
export function canEditProtocolDraft(user: CurrentUser): boolean {
  return hasRole(user, "professional");
}

// Reconocer las restricciones del modelo. OJO: la operacion existe pero NO esta cableada a ninguna UI
// ni la exige generateMenu (decision 2026-08-23, opcion iii; ver BACKLOG). La policy se conserva con la
// maquinaria; no gatea nada hoy.
export function canAcknowledgeRestrictions(user: CurrentUser): boolean {
  return hasRole(user, "professional");
}

// Aprobar el protocolo: convierte la sugerencia del modelo en una prescripcion de calorias y
// proteina para una persona. El acto mas cargado, profesional-solo. Se implementa en A3 (el
// approve sella el set efectivo, que necesita el motor). El alcance fino NO se apoya en un
// efecto lateral del read path (ajuste de seguridad): el approve writer verificara de forma
// EXPLICITA que el profesional este asignado al paciente, no solo por RLS al leer.
export function canApproveProtocol(user: CurrentUser): boolean {
  return hasRole(user, "professional");
}
