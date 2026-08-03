import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { CorrectEvaluationForm } from "@/modules/corrections/components/correct-evaluation-form";
import { getCorrectionWarnings } from "@/modules/corrections/data/correction-warnings-reader";
import { getEvaluationHeaderForSession } from "@/modules/diagnoses/data/results-reader";
import { getSurveyAnswersForEvaluation } from "@/modules/evaluations/data/survey-answers-reader";
import { canManageReports } from "@/modules/reports/policies/can-manage-reports";

export const metadata = { title: "Corregir evaluación - Atlas" };

// Página del flujo de corrección (S2, checkpoint 1). El botón "Corregir la evaluación" (CorrectionEntry)
// trae aquí desde las pestañas. El guard de rol es el coarse (canManageReports, regla 3); la autoridad
// fina (profesional ASIGNADO, evaluación vigente, versión de encuesta) la impone el servicio en la
// server action. La RLS del reader ya limita el alcance a los pacientes del profesional (si no es suyo,
// header null -> 404).
export default async function CorregirEvaluacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!canManageReports(user)) redirect("/no-autorizado");

  const header = await getEvaluationHeaderForSession(id);
  if (!header) notFound(); // no existe o no es suya (RLS)

  const [domains, warnings] = await Promise.all([
    getSurveyAnswersForEvaluation(id),
    getCorrectionWarnings(id),
  ]);

  const backHref = `/evaluaciones/${id}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6">
      <header className="flex flex-col gap-2">
        <Link
          href={backHref}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          ← Volver a la evaluación
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Corregir la evaluación</h1>
        <p className="text-sm text-muted-foreground">
          {header.patientName} · {header.documentLabel} ·{" "}
          {new Date(header.evaluationDate).toLocaleDateString("es-CO")}
        </p>
      </header>

      {domains ? (
        <CorrectEvaluationForm
          evaluationId={id}
          domains={domains}
          warnings={warnings}
          backHref={backHref}
        />
      ) : (
        <p className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
          Esta evaluación aún no tiene una encuesta registrada, así que no hay respuestas que corregir.
        </p>
      )}
    </div>
  );
}
