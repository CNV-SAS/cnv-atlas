import type { ConsentType } from "@/modules/consent/validations";
import type { DuplicateCandidate } from "@/modules/patients/types";
import type { Database } from "@/types/database.generated";

// Tipos de dominio de evaluaciones (grupo 5) y del intake de la encuesta.
type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

export type Evaluation = Tables["evaluations"]["Row"];
export type EvaluationType = Enums["evaluation_type"];
export type DocumentType = Enums["document_type"];

// Pre-fill de un link de seguimiento (lo que se PERSISTE en el link): solo cuasi-identificadores estables y
// editables (ciudad, celular). Nunca identificadores directos del paciente (privacidad: no guardar nombre ni
// documento en el link). El prefill COMPLETO de identidad para el camino con firma NO se guarda aqui: se lee
// fresco del paciente (getFollowupIdentityPrefill) autorizado por el token. Modulo NEUTRO (lo usan el reader
// server-only y los componentes cliente del intake).
export type SurveyLinkPrefill = {
  city?: string | null;
  phone?: string | null;
};

// Prefill COMPLETO de identidad para el camino con firma de un seguimiento (excepcion o bump sustantivo): el
// paciente ya existe y solo confirma. Se lee FRESCO (no se guarda en el link). Tipo NEUTRO: lo produce el
// reader (server) y lo consume SignPhaseForm (cliente).
export type SignIdentityPrefill = {
  documentType: string | null;
  documentNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  sex: string | null;
  country: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
};

// Vista del link resuelto para la pagina publica. No incluye el token.
export type SurveyLinkView = {
  id: string;
  organizationId: string;
  professionalId: string;
  type: EvaluationType; // inicial (reusable) | seguimiento (un uso)
  patientId: string | null; // seguimiento: el paciente al que esta atado
  prefill: SurveyLinkPrefill | null;
};

// Identidad declarada por el paciente en el intake (entrada cruda, sin sesion).
export type IntakeIdentity = {
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  sex: string | null;
  country: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
};

// Resultado del intake: la evaluacion creada, su modo derivado y, si los hubo,
// los candidatos a duplicado para que el profesional confirme la identidad.
export type SurveyIntakeResult = {
  evaluationId: string;
  patientId: string;
  mode: EvaluationType;
  duplicateCandidates: DuplicateCandidate[];
};

export type { ConsentType };
