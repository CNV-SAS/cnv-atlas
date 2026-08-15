import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { evaluations, patientProfiles, patients } from "@/db/schema";

import type { EvaluationCharacterization } from "./survey-answers-types";

// Caracterizacion sociodemografica DE ESTA evaluacion (columnas versionadas de `evaluations`), para el
// bloque de D8. Drizzle owner: la autorizacion (que la evaluacion sea del profesional) ya se verifico
// antes en la pagina (getEvaluationHeaderForSession / getEvaluationResults bajo RLS; sin acceso, la pagina
// hace 404 y no se llega aqui). Devuelve la fila (con nulls donde no se capturo) o null si no existe.
export async function getEvaluationCharacterization(
  evaluationId: string,
): Promise<EvaluationCharacterization | null> {
  const [row] = await db
    .select({
      educationLevel: evaluations.educationLevel,
      occupation: evaluations.occupation,
      maritalStatus: evaluations.maritalStatus,
      socioeconomicStratum: evaluations.socioeconomicStratum,
      ethnicity: evaluations.ethnicity,
    })
    .from(evaluations)
    .where(eq(evaluations.id, evaluationId))
    .limit(1);
  return row ?? null;
}

// ¿El PERFIL del paciente tiene algun sociodemografico? Distingue, cuando las columnas de la evaluacion
// estan vacias, "el paciente no lo respondio" (perfil tambien vacio) de "esta evaluacion es anterior al
// registro por evaluacion" (perfil con datos, escrito por un intake previo a esas columnas). El D8 lo usa
// para NO decir "no se capturo" cuando el dato existe en el perfil. Mismo owner/justificacion de auth que
// getEvaluationCharacterization (la pagina ya verifico ownership por RLS antes de llegar aca).
export async function getPatientProfileHasCharacterization(evaluationId: string): Promise<boolean> {
  const [row] = await db
    .select({
      educationLevel: patientProfiles.educationLevel,
      occupation: patientProfiles.occupation,
      maritalStatus: patientProfiles.maritalStatus,
      socioeconomicStratum: patientProfiles.socioeconomicStratum,
      ethnicity: patientProfiles.ethnicity,
    })
    .from(evaluations)
    .innerJoin(patients, eq(patients.id, evaluations.patientId))
    .innerJoin(patientProfiles, eq(patientProfiles.patientId, patients.id))
    .where(eq(evaluations.id, evaluationId))
    .limit(1);
  return row ? Object.values(row).some((v) => v != null) : false;
}
