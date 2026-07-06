import Image from "next/image";

import { SurveyIntakeForm } from "@/modules/evaluations/components/survey-intake-form";
import { getActiveSurvey } from "@/modules/evaluations/data/survey-reader";
import { resolveSurveyLinkByToken } from "@/modules/evaluations/data/survey-links-reader";
import { CONSENT_TEXT_V1_5 } from "@/modules/consent/text/consent-v1.5";

export const metadata = { title: "Encuesta - Atlas" };

// Contenedor de la superficie publica de la encuesta (sin shell de la app). Mas
// ancho que el checkout y alineado arriba: es un formulario largo.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh justify-center bg-muted/30 px-4 py-10">
      <div className="flex w-full max-w-2xl flex-col gap-8 rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
        <Image
          src="/brand/logo-horizontal.svg"
          alt="Atlas"
          width={140}
          height={28}
          priority
          unoptimized
          className="h-7 w-auto"
        />
        {children}
      </div>
    </main>
  );
}

// Pagina publica (sin sesion): el paciente abre el link/QR y llena la encuesta. El
// token es opaco; se resuelve en servidor a (profesional, organizacion). Recoleccion
// pura: no hay scoring ni logica condicional aqui.
export default async function EncuestaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await resolveSurveyLinkByToken(token);

  if (!link) {
    return (
      <Shell>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Link no disponible
          </h1>
          <p className="text-sm text-muted-foreground">
            Este link de encuesta no existe, ya fue usado o vencio. Pide uno nuevo a tu
            profesional.
          </p>
        </div>
      </Shell>
    );
  }

  const survey = await getActiveSurvey();
  if (!survey) {
    return (
      <Shell>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Encuesta no disponible
          </h1>
          <p className="text-sm text-muted-foreground">
            La encuesta no esta disponible en este momento. Intenta mas tarde.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {link.type === "seguimiento" ? "Encuesta de seguimiento" : "Evaluacion inicial"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Tus respuestas son confidenciales. Completa el formulario para tu profesional
          de salud.
        </p>
      </div>
      <SurveyIntakeForm
        token={token}
        isFollowup={link.type === "seguimiento"}
        prefill={link.prefill}
        questions={survey.questions}
        consentText={CONSENT_TEXT_V1_5}
      />
    </Shell>
  );
}
