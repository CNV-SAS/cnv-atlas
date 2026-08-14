import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { evaluations } from "@/db/schema";

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
