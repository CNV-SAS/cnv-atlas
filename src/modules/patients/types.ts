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
export type IdentityResolution = {
  mode: EvaluationType; // 'inicial' (sin match) | 'seguimiento' (match exacto)
  matchedPatientId: string | null;
  duplicateCandidates: DuplicateCandidate[];
};
