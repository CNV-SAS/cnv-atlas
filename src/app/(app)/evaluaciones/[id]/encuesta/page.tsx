import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/modules/auth/session";
import { getCorrectionAvailability } from "@/modules/corrections/data/correction-availability-reader";
import { getEvaluationHeaderForSession, getEvaluationResults } from "@/modules/diagnoses/data/results-reader";
import { formatDate } from "@/lib/format/date";
import { SurveyReadonly } from "@/modules/evaluations/components/survey-readonly";
import { getSurveyAnswersForEvaluation } from "@/modules/evaluations/data/survey-answers-reader";
import { canManageReports } from "@/modules/reports/policies/can-manage-reports";

export const metadata = { title: "Encuesta - Atlas" };

// Pantalla "Ver o editar encuesta" del paciente. Se llega desde el resumen de la pestana Evaluacion.
// Muestra las respuestas (SurveyReadonly) y, segun el estado, la via de EDICION: sin diagnostico se edita
// directo (nada sellado); con diagnostico es la CORRECCION versionada (genera una version nueva). Los dos
// casos se distinguen en un vistazo. La policy gobierna el rol; la RLS del reader impone que sea su paciente.
export default async function EncuestaEvaluacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!canManageReports(user)) redirect("/no-autorizado");

  const [header, domains, results, correctionAvailability] = await Promise.all([
    getEvaluationHeaderForSession(id),
    getSurveyAnswersForEvaluation(id),
    getEvaluationResults(id),
    getCorrectionAvailability(id),
  ]);
  if (!header) notFound();

  // Pre-diagnostico: se puede COMPLETAR/EDITAR directo (nada sellado). Con diagnostico, cambiar una
  // respuesta es el flujo de CORRECCION versionada, que ahora vive AQUI (Santiago 2026-08-15, b): antes
  // apuntaba de vuelta a la evaluacion, pero se saco de ahi. Los dos casos se distinguen en un vistazo.
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
          // SIN diagnostico: edicion DIRECTA (nada sellado, sin version nueva).
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Aún sin diagnóstico: puedes editar las respuestas directamente (si el paciente dejó algo sin
              responder, complétalo en consulta).
            </p>
            <Link
              href={`/evaluaciones/${id}/encuesta/editar`}
              className="inline-flex w-fit items-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              Editar respuestas
            </Link>
          </div>
        ) : (
          // CON diagnostico: la CORRECCION versionada. Texto corto (ya esta viendo la encuesta): editar aqui
          // genera una version nueva con su motivo, la actual queda como reemplazada.
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Ya hay diagnóstico: corregir una respuesta genera una{" "}
              <span className="font-medium text-foreground">versión nueva</span> (con su motivo); la actual
              queda registrada como reemplazada.
            </p>
            {correctionAvailability.available ? (
              <Button asChild variant="outline" size="sm" className="w-fit">
                <Link href={`/evaluaciones/${id}/corregir`}>Corregir la evaluación</Link>
              </Button>
            ) : (
              <div className="flex flex-col gap-1">
                <Button variant="outline" size="sm" disabled className="w-fit">
                  Corregir la evaluación
                </Button>
                {correctionAvailability.blockedReason ? (
                  <p className="text-xs text-muted-foreground">{correctionAvailability.blockedReason}</p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </header>

      <SurveyReadonly domains={domains ?? []} />
    </div>
  );
}
