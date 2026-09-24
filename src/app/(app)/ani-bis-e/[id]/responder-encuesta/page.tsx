import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { SurveyPhaseForm } from "@/modules/evaluations/components/survey-phase-form";
import { getResumeTokenDeMiEvaluacion } from "@/modules/evaluations/data/evaluations-repository";
import { getActiveSurvey } from "@/modules/evaluations/data/survey-reader";
import { canRegistrarEncuestaDelPaciente } from "@/modules/evaluations/policies/can-manage-evaluations";
import { readSurveyProgress } from "@/modules/evaluations/services/survey-intake";

export const metadata = { title: "Responder la encuesta - Atlas" };

// ═══ LA ENCUESTA, RESPONDIDA EN CONSULTA (2026-09-24) ═══
//
// SE LLAMA `responder-encuesta` Y NO `encuesta` porque `encuesta` YA EXISTE: es la pantalla de ver y editar
// la encuesta de una evaluación que ya la tiene (con sus alertas clínicas). Esta es la otra mitad: una que
// TODAVÍA no la tiene. Al escribir esto pisé ese archivo y su candado lo atrapó; queda dicho aquí para que
// nadie lo vuelva a intentar.
//
// LA NECESIDAD ES DE UNA INTEGRANTE: hay pacientes que firman y dejan la encuesta sin responder, porque no
// hay conexión o porque la llenan con ella en consulta. La evaluación quedaba esperando y la única acción
// disponible era CERRARLA, o sea archivar un consentimiento ya firmado y empezar de cero.
//
// ES EL MISMO FORMULARIO Y EL MISMO BORRADOR que el del paciente: la evaluación tiene UNA fila de
// respuestas, así que esto continúa lo que él hubiera dejado a medias, no empieza en blanco.
//
// Y NO SE VUELVE A PEDIR EL CONSENTIMIENTO: ya lo firmó, y esto entra directo en la fase 2, que es
// exactamente lo que hace su enlace de reanudación.
export default async function ResponderEncuestaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canRegistrarEncuestaDelPaciente(user)) redirect("/no-autorizado");

  // LA RLS ES EL ALCANCE FINO: si la evaluación no es de su paciente, esto devuelve null.
  const resumeToken = await getResumeTokenDeMiEvaluacion(id);
  if (!resumeToken) notFound();

  const [progress, survey] = await Promise.all([readSurveyProgress(resumeToken), getActiveSurvey()]);
  if (!progress || !survey) notFound();

  const prefill: Record<string, string> = {};
  for (const a of progress.answers) prefill[a.questionId] = a.answerValue;

  // El paso inicial es la última sección CON alguna respuesta: si el paciente avanzó en casa, ella sigue
  // donde él quedó en vez de recorrer otra vez lo ya contestado.
  const answered = new Set(progress.answers.map((a) => a.questionId));
  const titulos: string[] = [];
  const conRespuesta: boolean[] = [];
  for (const q of survey.questions) {
    const titulo = q.section ?? "Otras";
    if (titulos[titulos.length - 1] !== titulo) {
      titulos.push(titulo);
      conRespuesta.push(false);
    }
    if (answered.has(q.id)) conRespuesta[conRespuesta.length - 1] = true;
  }
  let initialStep = 0;
  for (let i = 0; i < conRespuesta.length; i++) if (conRespuesta[i]) initialStep = i;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Responder la encuesta con el paciente
        </h1>
        <p className="text-sm text-muted-foreground">
          Es la misma encuesta que él tiene en su enlace, y continúa donde la haya dejado. Queda registrado
          que la respondiste tú, porque no es lo mismo que la conteste él por su cuenta: escribe lo que él te
          diga, con sus palabras.
        </p>
      </div>
      <SurveyPhaseForm
        resumeToken={resumeToken}
        isFollowup={progress.mode === "seguimiento"}
        questions={survey.questions}
        prefill={prefill}
        initialStep={initialStep}
        characterizationPrefill={progress.characterization}
        ethnicityAuthorized={progress.ethnicityAuthorized}
        modo="profesional"
      />
    </div>
  );
}
