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
};

// Una evaluacion en la linea de tiempo del paciente (/pacientes/[id]). Enlaza a la
// vista de resultados que ya existe (/evaluaciones/[id]).
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
