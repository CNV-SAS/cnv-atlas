import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { EvaluationResults } from "@/modules/diagnoses/components/evaluation-results";
import { getEvaluationResults } from "@/modules/diagnoses/data/results-reader";
import { canManageReports } from "@/modules/reports/policies/can-manage-reports";

export const metadata = { title: "Resultados - Atlas" };

// Vista interna del profesional con los resultados clinicos de una evaluacion (B12).
// La policy gobierna el rol (regla 3); el alcance fino (que sea su paciente) lo impone la
// RLS en el reader: si no es suyo, getEvaluationResults devuelve null -> 404.
export default async function ResultadosEvaluacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!canManageReports(user)) redirect("/no-autorizado");

  const results = await getEvaluationResults(id);
  if (!results) notFound();

  return <EvaluationResults results={results} />;
}
