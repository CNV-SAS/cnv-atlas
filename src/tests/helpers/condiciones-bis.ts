import { desc } from "drizzle-orm";

import type { db as Db } from "@/db";
import * as schema from "@/db/schema";

// Las condiciones de la toma BIS de una evaluacion de prueba (2026-09-22). Desde que el diagnostico las exige
// (`condicionesParaDiagnosticar` en el pipeline), una evaluacion de prueba que genera diagnostico tiene que
// traerlas, igual que una real. Se siembran vacias (nada que comprometa la validez) y sin contraindicacion,
// con la version vigente del catalogo.
export async function sembrarCondicionesBis(
  db: typeof Db,
  evaluationId: string,
  extra: { gripStrengthKg?: string | null } = {},
): Promise<void> {
  const [version] = await db
    .select({ id: schema.bisConditionVersions.id })
    .from(schema.bisConditionVersions)
    .orderBy(desc(schema.bisConditionVersions.publishedAt))
    .limit(1);
  if (!version) throw new Error("sembrarCondicionesBis: no hay un catalogo de condiciones BIS en la base.");
  await db
    .insert(schema.evaluationBisIntake)
    .values({
      evaluationId,
      bisConditionVersionId: version.id,
      conditionAnswers: {},
      contraindicated: false,
      gripStrengthKg: extra.gripStrengthKg ?? null,
      // LAS REGISTRO ALGUIEN (0170). Este helper representa al profesional respondiendo el formulario, asi
      // que lleva la marca. La fila SIN marca existe tambien, y significa otra cosa: una consulta importada
      // del HTML que solo trae medidas, a la que el diagnostico le sigue pidiendo las condiciones.
      conditionsRegisteredAt: new Date(),
    })
    .onConflictDoNothing();
}
