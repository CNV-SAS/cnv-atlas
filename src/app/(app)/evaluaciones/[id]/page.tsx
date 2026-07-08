import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { EvaluationResults } from "@/modules/diagnoses/components/evaluation-results";
import { getEvaluationResults } from "@/modules/diagnoses/data/results-reader";
import { FollowupComparison } from "@/modules/followups/components/followup-comparison";
import { getFollowupComparison } from "@/modules/followups/data/comparison-reader";
import { canManageReports } from "@/modules/reports/policies/can-manage-reports";
import { TreatmentPanel } from "@/modules/treatment/components/treatment-panel";
import { getTreatmentProtocol } from "@/modules/treatment/data/treatment-reader";

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

  // Protocolo de tratamiento (B13): el tratamiento ya existe (lo crea el pipeline al
  // generar el diagnostico); aqui se lee para que el profesional lo enriquezca.
  // La comparacion de seguimiento aparece solo si hay una evaluacion previa (null si es
  // la primera del paciente).
  const [protocol, comparison] = await Promise.all([
    getTreatmentProtocol(id),
    getFollowupComparison(id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <EvaluationResults results={results} />
      {comparison ? <FollowupComparison comparison={comparison} /> : null}
      {protocol ? <TreatmentPanel evaluationId={id} protocol={protocol} /> : null}
    </div>
  );
}
