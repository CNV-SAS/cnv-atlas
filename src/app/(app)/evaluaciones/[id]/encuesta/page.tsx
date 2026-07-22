import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { getEvaluationHeaderForSession } from "@/modules/diagnoses/data/results-reader";
import { SurveyReadonly } from "@/modules/evaluations/components/survey-readonly";
import { getSurveyAnswersForEvaluation } from "@/modules/evaluations/data/survey-answers-reader";
import { canManageReports } from "@/modules/reports/policies/can-manage-reports";

export const metadata = { title: "Encuesta - Atlas" };

// Pantalla aparte de la encuesta del paciente en SOLO LECTURA (reusa el reader y los widgets de A;
// solo cambia donde se renderizan). Se llega desde el resumen de la pestana Evaluacion. Editar una
// respuesta que alimenta el modelo dispara recomputo (flujo de correccion, bloque futuro): por eso
// aqui solo se ve. La policy gobierna el rol; la RLS del reader impone que sea su paciente (404).
export default async function EncuestaEvaluacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!canManageReports(user)) redirect("/no-autorizado");

  const [header, domains] = await Promise.all([
    getEvaluationHeaderForSession(id),
    getSurveyAnswersForEvaluation(id),
  ]);
  if (!header) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href={`/evaluaciones/${id}`}
          className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Volver a la evaluación
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Encuesta del paciente
        </h1>
        <p className="text-muted-foreground">
          {header.patientName} · {header.documentLabel} ·{" "}
          {new Date(header.evaluationDate).toLocaleDateString("es-CO")}
        </p>
        <p className="text-sm text-muted-foreground">
          Solo lectura. Editar una respuesta que alimenta el modelo dispara un recálculo del
          diagnóstico (flujo de corrección, disponible próximamente).
        </p>
      </header>

      <SurveyReadonly domains={domains ?? []} />
    </div>
  );
}
