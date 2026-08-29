import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { VolverA } from "@/components/shared/volver-a";
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
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4">
      <TituloPantalla
        volver={<VolverA href={backHref}>Volver a la encuesta</VolverA>}
        titulo="Completar la encuesta"
        descripcion={`${header.patientName} · ${header.documentLabel} · ${formatDate(header.evaluationDate)}`}
      />

      <SurveyEditForm evaluationId={id} domains={domains ?? []} backHref={backHref} />
    </div>
  );
}
