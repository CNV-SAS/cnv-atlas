import Link from "next/link";
import { Panel } from "@/components/shared/panel";
import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { VolverA } from "@/components/shared/volver-a";
import { conOrigen } from "@/components/shared/volver-a-destino";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/modules/auth/session";
import { canRegistrarEncuestaDelPaciente } from "@/modules/evaluations/policies/can-manage-evaluations";
import { getCorrectionAvailability } from "@/modules/corrections/data/correction-availability-reader";
import { getEvaluationHeaderForSession, getEvaluationResults } from "@/modules/diagnoses/data/results-reader";
import { formatDate } from "@/lib/format/date";
import { alertasDisponibles, encDesdeRespuestas } from "@/clinical-engine/alertas-disponibles";
import { AlertasClinicas } from "@/modules/diagnoses/components/alertas-clinicas";
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

  // ═══ Y UN TERCER CASO, QUE FALTABA (Santiago, 2026-10-22) ═══
  //
  // `awaiting_survey` = el paciente firmo y su enlace sigue abierto. Caia en "pre-diagnostico", asi que
  // esta pantalla ofrecia "Editar respuestas"... hacia un formulario cuyo writer rechaza ese estado a
  // proposito (el paciente podria estar respondiendo al mismo tiempo, y editar ahi NO sacaria la
  // evaluacion de la espera: quedaria con respuestas y sin poder diagnosticarse). O sea que la pantalla
  // ofrecia un camino que no llega: se llenaba el formulario y al guardar salia "esta evaluacion no se
  // puede editar (revisa su estado)", con el trabajo perdido.
  //
  // LA PUERTA BUENA YA EXISTIA desde el 2026-09-24: "Responder la encuesta con el paciente", que
  // CONTINUA el mismo borrador y al enviar la pasa a `draft`. Lo que faltaba era que esta pantalla la
  // ofreciera. Estaba enlazada solo desde la ficha del paciente, que no es por donde se trabaja.
  const esperandoLaEncuesta = header.status === "awaiting_survey";
  // Y EL ENLACE SOLO A QUIEN LO PUEDE ABRIR. Esta pantalla la ve tambien admin (`canManageReports`), y
  // responder la encuesta es un acto de la consulta: la policy es solo del profesional que atiende. Un
  // boton que lleva a "no autorizado" es peor que no tenerlo, asi que a admin se le dice quien lo hace.
  const puedeResponderla = canRegistrarEncuestaDelPaciente(user);

  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4">
      {/* AL REVES QUE EN /ani-bis-e/[id], y a proposito: alli el titulo es el PACIENTE porque se llega
          desde el roster y lo primero que hay que confirmar es de quien es. Aqui se llega DESDE la
          evaluacion, con eso ya resuelto, asi que el titulo es lo que estas haciendo y el paciente baja a
          la descripcion, como confirmacion. */}
      <TituloPantalla
        volver={<VolverA padre={`/ani-bis-e/${id}`} />}
        titulo="Encuesta del paciente"
        descripcion={`${header.patientName} · ${header.documentLabel} · ${formatDate(header.evaluationDate)}`}
      />
      <Panel>
        {esperandoLaEncuesta ? (
          // TODAVIA ESPERANDO: la encuesta se continua, no se edita. Y se dice que el enlace del paciente
          // sigue vivo, porque explica por que hay respuestas a medias y por que esta es la via.
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              El paciente firmó y todavía tiene su enlace abierto, así que la encuesta no se edita: se{" "}
              <span className="font-medium text-foreground">continúa</span>.{" "}
              {puedeResponderla
                ? "Si está contigo en consulta, respóndela con él desde aquí y se envía al terminar."
                : "Quien lo atiende puede continuarla con él desde la consulta; al enviarla, la evaluación queda lista para confirmar y diagnosticar."}
            </p>
            {puedeResponderla ? (
              <Link
                href={`/ani-bis-e/${id}/responder-encuesta`}
                className="inline-flex w-fit items-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
              >
                Responder la encuesta con el paciente
              </Link>
            ) : null}
          </div>
        ) : preDiagnosis ? (
          // SIN diagnostico: edicion DIRECTA (nada sellado, sin version nueva).
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Aún sin diagnóstico: puedes editar las respuestas directamente (si el paciente dejó algo sin
              responder, complétalo en consulta).
            </p>
            <Link
              href={`/ani-bis-e/${id}/encuesta/editar`}
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
                <Link href={conOrigen(`/ani-bis-e/${id}/corregir`, `/ani-bis-e/${id}/encuesta`)}>
                  Corregir la evaluación
                </Link>
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

      {/* AQUI ES DONDE GILDARDO LAS QUERIA (2026-08-28, 11a), precisado por Santiago el 2026-09-10.
          Textual suyo: "Esas alertas aparecen al inicio, cuando el profesional abre la informacion de la
          encuesta del paciente. Son lo que le dice que mirar ANTES de evaluar". Esta pantalla es "abrir la
          informacion de la encuesta"; la pestaña Encuesta no lo era.

          VAN ARRIBA DE LAS RESPUESTAS: una bandera de conducta alimentaria manda derivar antes de seguir
          revisando, no despues. Se computan sobre las respuestas YA leidas, sin consulta nueva. */}
      <AlertasClinicas
        alertas={alertasDisponibles(
          encDesdeRespuestas((domains ?? []).flatMap((d) => d.questions)),
        )}
      />

      <SurveyReadonly domains={domains ?? []} />
    </div>
  );
}
