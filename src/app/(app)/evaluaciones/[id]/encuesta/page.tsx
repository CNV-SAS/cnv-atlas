import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { getEvaluationHeaderForSession, getEvaluationResults } from "@/modules/diagnoses/data/results-reader";
import { formatDate } from "@/lib/format/date";
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

  const [header, domains, results] = await Promise.all([
    getEvaluationHeaderForSession(id),
    getSurveyAnswersForEvaluation(id),
    getEvaluationResults(id),
  ]);
  if (!header) notFound();

  // Pre-diagnostico: se puede COMPLETAR/EDITAR directo (nada sellado). Con diagnostico, cambiar una
  // respuesta es el flujo de correccion (versionado), que vive en la propia evaluacion, no aqui.
  const preDiagnosis = results == null;

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
          {formatDate(header.evaluationDate)}
        </p>
        {preDiagnosis ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Vista de las respuestas del paciente. Antes de diagnosticar puedes completarlas o corregirlas
              (si el paciente dejó algo sin responder, complétalo en consulta).
            </p>
            <Link
              href={`/evaluaciones/${id}/encuesta/editar`}
              className="inline-flex w-fit items-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              Completar respuestas
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Solo lectura. La evaluación ya tiene diagnóstico; para cambiar una respuesta usa Corregir la
            evaluación (genera una versión nueva), desde la evaluación.
          </p>
        )}
      </header>

      <SurveyReadonly domains={domains ?? []} />
    </div>
  );
}
