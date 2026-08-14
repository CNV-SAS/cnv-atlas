import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { getEvaluationHeaderForSession, getEvaluationResults } from "@/modules/diagnoses/data/results-reader";
import { formatDate } from "@/lib/format/date";
import { SurveyEditForm } from "@/modules/evaluations/components/survey-edit-form";
import { getSurveyAnswersForEvaluation } from "@/modules/evaluations/data/survey-answers-reader";
import { canManageReports } from "@/modules/reports/policies/can-manage-reports";

export const metadata = { title: "Completar encuesta - Atlas" };

// (a) Edicion/completado de la encuesta por el profesional, ANTES del diagnostico. Se llega desde el
// boton "Completar respuestas" de la vista de solo lectura (entrar a editar es DELIBERADO). Si la
// evaluacion YA tiene diagnostico, editar una respuesta sellada es el flujo de CORRECCION (versionado):
// se redirige alli, no se edita directo. La RLS del reader impone que sea su paciente (404).
export default async function EditarEncuestaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canManageReports(user)) redirect("/no-autorizado");

  const [header, results, domains] = await Promise.all([
    getEvaluationHeaderForSession(id),
    getEvaluationResults(id),
    getSurveyAnswersForEvaluation(id),
  ]);
  if (!header) notFound();
  // Ya diagnosticada: no se edita directo, se corrige (version nueva).
  if (results) redirect(`/evaluaciones/${id}/corregir`);

  const backHref = `/evaluaciones/${id}/encuesta`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href={backHref}
          className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Volver a la encuesta
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Completar la encuesta</h1>
        <p className="text-muted-foreground">
          {header.patientName} · {header.documentLabel} ·{" "}
          {formatDate(header.evaluationDate)}
        </p>
      </header>

      <SurveyEditForm evaluationId={id} domains={domains ?? []} backHref={backHref} />
    </div>
  );
}
