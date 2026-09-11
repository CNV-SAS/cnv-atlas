import type { PendienteDelPaciente } from "./pendientes";

/**
 * Una evaluacion en el desplegable de la fila. Lleva su ROTULO ya resuelto ("Inicial", "Seguimiento 2")
 * porque la numeracion depende del ORDEN entre las del paciente, y eso se sabe donde estan todas juntas,
 * no en la vista fila por fila.
 */
export type EvaluacionDeLaFila = {
  evaluationId: string;
  /** "Inicial", "Seguimiento 1", "Seguimiento 2"... */
  rotulo: string;
  /** Fecha de medicion, o la de creacion si aun no se midio. */
  fecha: string;
};

import type { Database } from "@/types/database.generated";

// Tipos de dominio de pacientes (grupo 2), derivados de la Database generada.
type Tables = Database["public"]["Tables"];

export type Patient = Tables["patients"]["Row"];
export type PatientProfile = Tables["patient_profiles"]["Row"];
export type DocumentType = Database["public"]["Enums"]["document_type"];
export type EvaluationType = Database["public"]["Enums"]["evaluation_type"];

// Datos de identidad que llegan del intake (encuesta publica, sin sesion).
export type IdentityInput = {
  organizationId: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  birthDate: string | null; // yyyy-MM-dd
};

// Candidato a duplicado: un paciente distinto con alta similitud de nombre (y, si
// se conoce, misma fecha de nacimiento). El profesional resuelve aguas abajo; Atlas
// nunca fusiona automaticamente (MVP.md, resolucion de identidad).
export type DuplicateCandidate = {
  patientId: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  documentType: DocumentType;
  documentNumber: string;
  score: number; // 0..1 similitud de nombre
  birthDateMatches: boolean;
};

// Resultado de la resolucion de identidad. mode es DERIVADO por documento exacto;
// Atlas no le pregunta al paciente inicial vs seguimiento. duplicateCandidates solo
// se llena en el caso inicial (sin match exacto pero con parecidos a revisar).
// identityConflict: el documento coincidio (seguimiento) PERO el nombre declarado difiere del registrado
// (nameSimilarity < umbral). Se atribuye igual (el documento es la llave) pero se marca para que el
// profesional resuelva antes de usarla. Solo puede ser true en modo 'seguimiento'.
export type IdentityResolution = {
  mode: EvaluationType; // 'inicial' (sin match) | 'seguimiento' (match exacto)
  matchedPatientId: string | null;
  duplicateCandidates: DuplicateCandidate[];
  identityConflict: boolean;
};

// Fila del roster de pacientes del profesional (/pacientes). El alcance (solo los
// pacientes propios, o todos para admin) lo resuelve RLS, no la app.
export type PatientListItem = {
  patientId: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  birthDate: string | null; // yyyy-MM-dd
  status: string;
  evaluationCount: number;
  /** Fecha de la ultima evaluacion REAL (medicion; created_at si no se midio). null si no tiene. */
  lastEvaluationDate: string | null;
  /**
   * Le falta alguna autorizacion NECESARIA vigente (regla dura 15): no se le pueden crear evaluaciones.
   * Se calcula con la MISMA policy que gatea la creacion, para que la lista y el gate no discrepen.
   */
  sinAutorizacionVigente: boolean;
  /**
   * QUE LE FALTA, dicho como accion ("Montar BIS", "Generar diagnostico"), y cuantas evaluaciones mas
   * suyas estan paradas. Instruccion de Santiago (2026-09-10): la columna dice la ACCION, no el estado.
   * La regla vive en `pendientes.ts`, que es puro.
   */
  pendiente: PendienteDelPaciente;
  /**
   * LAS TRES ULTIMAS EVALUACIONES, para el desplegable de la fila (Santiago, 2026-09-10).
   *
   * VIENEN EN LA MISMA CONSULTA que ya se hacia: el lector de la lista ya embebia las evaluaciones para
   * contarlas y para la columna de pendientes; solo le faltaban el `id` y el `type`. Asi que desplegar
   * NO pide nada al servidor: el dato ya esta en la pagina cuando se pinta la lista.
   *
   * TRES Y NO TODAS porque el desplegable es un atajo, no la ficha: quien quiera la historia entera tiene
   * el boton del panel en la columna de acciones, que es donde vive ahora.
   */
  ultimasEvaluaciones: EvaluacionDeLaFila[];
};

// Una evaluacion en la linea de tiempo del paciente (/pacientes/[id]). Enlaza a la
// vista de resultados que ya existe (/ani-bis-e/[id]).
export type PatientEvaluationItem = {
  evaluationId: string;
  type: EvaluationType;
  status: string;
  createdAt: string;
  measurementDate: string | null; // fecha de MEDICION (cronologia clinica); null si aun no se midio
  superseded: boolean; // reemplazada por una correccion: se marca, no se oculta (la historia la conserva)
  reasonForVisit: string[]; // motivo de consulta (caracterizacion del encuentro, multi); [] si no se dio
};

// Detalle del paciente para su historia (/pacientes/[id]): identidad, contacto y la
// linea de tiempo de sus evaluaciones. RLS decide si la sesion puede verlo (null si no).
export type PatientDetail = {
  patientId: string;
  documentType: DocumentType;
  documentNumber: string;
  status: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  sex: string | null;
  city: string | null;
  country: string | null;
  // Caracterizacion sociodemografica OPCIONAL (E1). null si el paciente no la dio.
  educationLevel: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  socioeconomicStratum: string | null;
  ethnicity: string | null;
  ancestry: string | null;
  email: string | null;
  phone: string | null;
  evaluations: PatientEvaluationItem[];
};

// Estado de la busqueda por documento antes de crear un paciente en consulta (useActionState). Modulo
// NEUTRO a proposito: lo produce una action de servidor y lo consume la pantalla del profesional, que es
// cliente. El tipo VeredictoDocumento vive en el reader `server-only` y NO puede cruzar esta frontera.
//
// LO QUE VIAJA, y es todo lo que puede viajar: el veredicto. En 'ajeno' no hay ni un dato mas, ni el
// nombre ni de quien es (el candado `buscar-por-documento.test.ts` lo sostiene). En 'propio' viaja el id
// del paciente y el de su evaluacion pendiente, que la RLS ya le dejaba leer.
export type VerificarDocumentoState = {
  error: string | null;
  veredicto: "libre" | "propio" | "ajeno" | null;
  /** Eco de lo consultado, para que la pantalla siga adelante con el mismo documento sin re-teclearlo. */
  documentType: string | null;
  documentNumber: string | null;
  patientId: string | null;
  evaluacionPendienteId: string | null;
};

/** Estado de la accion de archivar. Misma forma que el resto de formularios (`FormToastState`). */
export type ArchivarPacienteState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};
