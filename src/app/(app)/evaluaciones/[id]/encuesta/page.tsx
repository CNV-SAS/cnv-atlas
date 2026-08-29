import Link from "next/link";
import { Panel } from "@/components/shared/panel";
import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { VolverA } from "@/components/shared/volver-a";
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
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4">
      {/* AL REVES QUE EN /evaluaciones/[id], y a proposito: alli el titulo es el PACIENTE porque se llega
          desde el roster y lo primero que hay que confirmar es de quien es. Aqui se llega DESDE la
          evaluacion, con eso ya resuelto, asi que el titulo es lo que estas haciendo y el paciente baja a
          la descripcion, como confirmacion. */}
      <TituloPantalla
        volver={<VolverA href={`/evaluaciones/${id}`}>Volver a la evaluación</VolverA>}
        titulo="Encuesta del paciente"
        descripcion={`${header.patientName} · ${header.documentLabel} · ${formatDate(header.evaluationDate)}`}
      />
      <Panel>
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
      </Panel>

      <SurveyReadonly domains={domains ?? []} />
    </div>
  );
}
