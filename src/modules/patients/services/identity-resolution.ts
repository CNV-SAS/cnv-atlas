import type { DocumentType, IdentityInput, IdentityResolution } from "../types";
import { nameSimilarity } from "./name-matching";

// Resolucion de identidad del intake (MVP.md, "Encuesta y resolucion de identidad").
// Atlas NO le pregunta al paciente inicial vs seguimiento: resuelve por documento
// exacto. Coincide -> seguimiento; no coincide -> inicial. Ante parecido sin match
// exacto, levanta candidatos para que el profesional resuelva (nunca fusiona solo).

// Umbrales de similitud de nombre para marcar un posible duplicado:
//  - STRONG: nombre casi identico (typo), basta por si solo.
//  - WITH_BIRTHDATE: nombre similar, se exige misma fecha de nacimiento como apoyo.
export const NAME_MATCH_STRONG = 0.9;
export const NAME_MATCH_WITH_BIRTHDATE = 0.8;

// Fila minima de un paciente existente para comparar (la entrega el reader).
export type CandidateRow = {
  patientId: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  documentType: DocumentType;
  documentNumber: string;
};

// Dependencias inyectadas: lecturas contra la BD (service role). Inyectarlas deja la
// logica de resolucion pura y testeable sin tocar la base.
export type IdentityResolutionDeps = {
  findPatientByDocument: (
    organizationId: string,
    documentType: DocumentType,
    documentNumber: string,
  ) => Promise<{ id: string } | null>;
  findDuplicateCandidates: (
    organizationId: string,
    criteria: { birthDate: string | null; lastName: string },
  ) => Promise<CandidateRow[]>;
};

export async function resolveIdentity(
  deps: IdentityResolutionDeps,
  input: IdentityInput,
): Promise<IdentityResolution> {
  // 1. Match exacto por (organizacion, tipo y numero de documento).
  const exact = await deps.findPatientByDocument(
    input.organizationId,
    input.documentType,
    input.documentNumber,
  );
  if (exact) {
    return { mode: "seguimiento", matchedPatientId: exact.id, duplicateCandidates: [] };
  }

  // 2. Sin match exacto -> inicial. Buscar posibles duplicados (otra persona ya
  //    registrada con nombre parecido y, si se sabe, misma fecha de nacimiento).
  const rows = await deps.findDuplicateCandidates(input.organizationId, {
    birthDate: input.birthDate,
    lastName: input.lastName,
  });
  const fullName = `${input.firstName} ${input.lastName}`;
  const duplicateCandidates = rows
    .map((r) => {
      const score = nameSimilarity(fullName, `${r.firstName} ${r.lastName}`);
      const birthDateMatches =
        !!input.birthDate && !!r.birthDate && input.birthDate === r.birthDate;
      return { ...r, score, birthDateMatches };
    })
    .filter(
      (c) =>
        c.score >= NAME_MATCH_STRONG ||
        (c.score >= NAME_MATCH_WITH_BIRTHDATE && c.birthDateMatches),
    )
    .sort((a, b) => b.score - a.score);

  return { mode: "inicial", matchedPatientId: null, duplicateCandidates };
}
