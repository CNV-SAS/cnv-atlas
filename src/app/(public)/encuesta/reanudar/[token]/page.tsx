import Image from "next/image";

import { SurveyPhaseForm } from "@/modules/evaluations/components/survey-phase-form";
import { getActiveSurvey } from "@/modules/evaluations/data/survey-reader";
import {
  readResumeTokenStatus,
  readSurveyProgress,
} from "@/modules/evaluations/services/survey-intake";

export const metadata = { title: "Retomar encuesta - Atlas" };

// Contenedor de la superficie publica (sin shell de la app), igual que la pagina de la encuesta.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh justify-center bg-muted/30 px-4 py-10">
      <div className="flex w-full max-w-2xl flex-col gap-8 rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2 self-start">
          <Image
            src="/brand/logo-horizontal.svg"
            alt="Atlas"
            width={140}
            height={28}
            priority
            unoptimized
            className="h-7 w-auto"
          />
          <span className="text-lg font-semibold tracking-tight text-muted-foreground">Pacientes</span>
        </div>
        {children}
      </div>
    </main>
  );
}

// Pagina de REANUDACION (reorganizacion del intake). El paciente vuelve por el enlace tras firmar y
// (quizas) responder parte de la encuesta. El resume_token de la URL autentica: solo abre si la
// evaluacion sigue 'awaiting_survey'. Entra directo en la fase 2 (SurveyPhaseForm) con las respuestas ya
// guardadas y en la ultima seccion con avance, para continuar donde iba.
export default async function ReanudarEncuestaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const progress = await readSurveyProgress(token);

  // El token ya no abre la encuesta: son TRES situaciones distintas y tres acciones del paciente
  // distintas (cerrada -> hablar con su profesional; completada -> no hacer nada; invalido -> revisar el
  // enlace). Se distingue por el estado actual de la evaluacion (el token se conserva tras cerrar/completar).
  if (!progress) {
    const status = await readResumeTokenStatus(token);
    const msg =
      status === "abandoned"
        ? {
            title: "Evaluación cerrada",
            body: "Tu profesional cerró esta evaluación sin completar. Si quieres retomarla, habla con tu profesional para empezar una nueva.",
          }
        : status !== null
          ? {
              title: "Encuesta completada",
              body: "Ya completaste esta encuesta. No necesitas hacer nada más; tu profesional continúa con tu evaluación.",
            }
          : {
              title: "Enlace no válido",
              body: "Este enlace no es válido. Revisa que lo hayas copiado completo, o pídele uno nuevo a tu profesional.",
            };
    return (
      <Shell>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{msg.title}</h1>
          <p className="text-sm text-muted-foreground">{msg.body}</p>
        </div>
      </Shell>
    );
  }

  const survey = await getActiveSurvey();
  if (!survey) {
    return (
      <Shell>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Encuesta no disponible</h1>
          <p className="text-sm text-muted-foreground">
            La encuesta no esta disponible en este momento. Intenta mas tarde.
          </p>
        </div>
      </Shell>
    );
  }

  // Prefill: questionId -> valor guardado. El widget lo usa para arrancar con el valor previo.
  const prefill: Record<string, string> = {};
  for (const a of progress.answers) prefill[a.questionId] = a.answerValue;

  // Paso inicial: la ULTIMA seccion (dominio) que tenga alguna respuesta, para dejarlo donde iba. Se
  // agrupan las preguntas por section en el mismo orden que el formulario y se busca el ultimo grupo con
  // al menos una respondida. Sin respuestas aun -> seccion 0.
  const answered = new Set(progress.answers.map((a) => a.questionId));
  const sectionTitles: string[] = [];
  const sectionHasAnswer: boolean[] = [];
  for (const q of survey.questions) {
    const title = q.section ?? "Otras";
    if (sectionTitles[sectionTitles.length - 1] !== title) {
      sectionTitles.push(title);
      sectionHasAnswer.push(false);
    }
    if (answered.has(q.id)) sectionHasAnswer[sectionHasAnswer.length - 1] = true;
  }
  let initialStep = 0;
  for (let i = 0; i < sectionHasAnswer.length; i++) {
    if (sectionHasAnswer[i]) initialStep = i;
  }

  return (
    <Shell>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {progress.mode === "seguimiento" ? "Encuesta de seguimiento" : "Evaluación inicial"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Retomamos tu encuesta donde la dejaste. Tus respuestas son confidenciales.
        </p>
      </div>
      <SurveyPhaseForm
        resumeToken={token}
        isFollowup={progress.mode === "seguimiento"}
        questions={survey.questions}
        prefill={prefill}
        initialStep={initialStep}
        characterizationPrefill={progress.characterization}
      />
    </Shell>
  );
}
