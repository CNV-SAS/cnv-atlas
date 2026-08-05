import "server-only";

import { and, eq, isNull, ne, sql } from "drizzle-orm";

import type { DbTransaction } from "@/db";
import { bisMeasurements, evaluations, reports } from "@/db/schema";
import {
  type EbTrajectory,
  type PriorEvaluation,
  resolveTrajectory,
} from "@/modules/followups/services/eb-trajectory";

// P0 Parte 2 (P3): computa la trayectoria de EB-BIS a SELLAR en el reporte de un SEGUIMIENTO. Compara la
// EB actual contra la PREVIA COMPARABLE del paciente. Corre DENTRO de la tx del writer (recibe tx).
//
// Decisiones ya tomadas (no rehacer, verificadas en C2-a): la cronologia se mide entre `measurement_date`
// (no `created_at`, que se mueve con una correccion); las previas se filtran por `superseded_at IS NULL`
// (una reemplazada por correccion no es candidata); `resolveTrajectory`/`pickComparablePrior` castigan
// por INTERVALO (>=12 semanas), no por posicion. La EB previa sale del snapshot SELLADO del reporte de
// esa evaluacion (`snapshot -> indicators -> eb`), no se recomputa.
//
// Devuelve la EbTrajectory a sellar, o null si no hay banda que comunicar (primera comparable, intervalo
// corto, o sin EB actual): en esos casos el reporte se sella sin trayectoria y el paciente ve la lectura
// funcional, como en la 1a medicion.
export async function computeTrajectoryToSeal(
  tx: DbTransaction,
  args: { patientId: string; evaluationId: string; currentEb: number | null },
): Promise<EbTrajectory | null> {
  if (args.currentEb == null) return null; // sin EB actual no hay con que comparar (degradado)

  // Fecha de medicion de la evaluacion ACTUAL (ancla clinica). Una evaluacion tiene una sola medicion.
  const [curMeas] = await tx
    .select({ d: bisMeasurements.measurementDate })
    .from(bisMeasurements)
    .where(eq(bisMeasurements.evaluationId, args.evaluationId))
    .limit(1);
  if (!curMeas?.d) return null;
  const currentDate = new Date(curMeas.d).toISOString();

  // Previas VIGENTES del paciente con EB sellada (del snapshot de su reporte) + su fecha de medicion.
  const rows = await tx
    .select({
      evaluationId: evaluations.id,
      date: bisMeasurements.measurementDate,
      ebText: sql<string | null>`(${reports.snapshot} #>> '{indicators,eb}')`,
    })
    .from(evaluations)
    .innerJoin(reports, eq(reports.evaluationId, evaluations.id))
    .innerJoin(bisMeasurements, eq(bisMeasurements.evaluationId, evaluations.id))
    .where(
      and(
        eq(evaluations.patientId, args.patientId),
        isNull(evaluations.supersededAt),
        ne(evaluations.id, args.evaluationId),
      ),
    );

  const priors: PriorEvaluation[] = rows
    .map((r) => ({
      evaluationId: r.evaluationId,
      date: new Date(r.date as unknown as string).toISOString(),
      eb: r.ebText == null || r.ebText === "" ? null : Number(r.ebText),
    }))
    // Mas reciente primero (measurement_date desc): lo que pickComparablePrior espera.
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const result = resolveTrajectory(currentDate, args.currentEb, priors);
  return result.kind === "band" ? result.trajectory : null;
}
