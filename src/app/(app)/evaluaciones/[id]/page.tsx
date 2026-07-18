import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { CompositionSection } from "@/modules/diagnoses/components/composition-section";
import { EvaluationResults } from "@/modules/diagnoses/components/evaluation-results";
import { EvaluationTabs } from "@/modules/diagnoses/components/evaluation-tabs";
import { getCompositionForEvaluation } from "@/modules/diagnoses/data/composition-reader";
import {
  getEvaluationHeaderForSession,
  getEvaluationResults,
} from "@/modules/diagnoses/data/results-reader";
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
  if (!results) {
    // Sin diagnostico todavia: si la evaluacion existe y es del profesional, estado vacio
    // elegante (no un 404 crudo). Si no existe o no es suya (RLS), sigue siendo 404.
    const header = await getEvaluationHeaderForSession(id);
    if (!header) notFound();
    return (
      <EvaluationTabs
        diagnostico={
          <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                Resultados de la evaluación
              </h1>
              <p className="text-muted-foreground">
                {header.patientName} · {header.documentLabel} ·{" "}
                {new Date(header.evaluationDate).toLocaleDateString("es-CO")}
              </p>
            </header>
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-foreground">
                Esta evaluación aún no tiene un diagnóstico generado.
              </p>
              <p className="max-w-prose text-sm text-muted-foreground">
                Confirma la identidad, importa la medición BIS y genera el diagnóstico desde el
                panel de Evaluaciones. Los resultados aparecerán aquí cuando el motor haya corrido.
              </p>
              <Link
                href="/evaluaciones"
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Ir a Evaluaciones
              </Link>
            </div>
          </div>
        }
      />
    );
  }

  // Protocolo de tratamiento (B13): el tratamiento ya existe (lo crea el pipeline al
  // generar el diagnostico); aqui se lee para que el profesional lo enriquezca.
  // La comparacion de seguimiento aparece solo si hay una evaluacion previa (null si es
  // la primera del paciente).
  const [protocol, comparison, composition] = await Promise.all([
    getTreatmentProtocol(id),
    getFollowupComparison(id),
    getCompositionForEvaluation(id),
  ]);

  const sexoM = (results.snapshot as { sexo?: string }).sexo !== "F";

  // Shell de pestañas: solo Diagnostico activa (ST2). Contenido de Diagnostico (ST3): resultados
  // del motor (indicadores + diagnostico funcional + Diana + DFI) + composicion corporal (Wang) y
  // clasificacion antropometrica. La comparacion y el tratamiento viven aqui de forma transitoria
  // (los reparten Seguimiento / Rutas en bloques posteriores). El orden final es ST7.
  return (
    <EvaluationTabs
      diagnostico={
        <div className="flex flex-col gap-8">
          <EvaluationResults results={results} />
          {composition ? <CompositionSection composition={composition} sexoM={sexoM} /> : null}
          {comparison ? <FollowupComparison comparison={comparison} /> : null}
          {protocol ? <TreatmentPanel evaluationId={id} protocol={protocol} /> : null}
        </div>
      }
    />
  );
}
