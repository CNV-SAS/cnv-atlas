"use client";

import { useCallback, useState } from "react";

import type { SurveyQuestionView } from "../data/survey-view-types";
import { SignPhaseForm } from "./sign-phase-form";
import { SignedScreen } from "./signed-screen";
import { SurveyPhaseForm } from "./survey-phase-form";

// Orquestador del intake del paciente (reorganizacion 2026-08-10). Tres fases en secuencia:
//   1. FIRMAR  (SignPhaseForm): consentimiento + identidad + codigo -> crea el shell y da el resume_token.
//   2. FIRMADO (SignedScreen): confirma, entrega el enlace de reanudacion, ofrece empezar la encuesta.
//   3. ENCUESTA (SurveyPhaseForm): respuestas con guardado a medida y envio.
// La reanudacion por enlace entra directo en la fase 3 (otra pagina monta SurveyPhaseForm con prefill).
// Se firma ANTES de recolectar porque la Ley 1581 exige autorizacion previa (dictamen de borrador).

export type SurveyIntakeFormProps = {
  token: string;
  isFollowup: boolean;
  prefill: { city?: string | null; phone?: string | null } | null;
  questions: SurveyQuestionView[];
  consentText: string;
  professional: { fullName: string; profession: string; license: string | null };
};

export function SurveyIntakeForm({
  token,
  isFollowup,
  prefill,
  questions,
  consentText,
  professional,
}: SurveyIntakeFormProps) {
  const [phase, setPhase] = useState<"sign" | "signed" | "survey">("sign");
  const [resumeToken, setResumeToken] = useState<string | null>(null);

  const handleSigned = useCallback((tokenValue: string) => {
    setResumeToken(tokenValue);
    setPhase("signed");
  }, []);

  if (phase === "sign") {
    return (
      <SignPhaseForm
        token={token}
        prefill={prefill}
        consentText={consentText}
        professional={professional}
        onSigned={handleSigned}
      />
    );
  }

  // Tras firmar siempre hay resume_token; el guard es defensivo (nunca deberia faltar).
  if (!resumeToken) {
    return (
      <p className="text-sm text-muted-foreground">
        Ocurrió un problema al continuar. Recarga la página e intenta de nuevo.
      </p>
    );
  }

  if (phase === "signed") {
    return <SignedScreen resumeToken={resumeToken} onStart={() => setPhase("survey")} />;
  }

  return <SurveyPhaseForm resumeToken={resumeToken} isFollowup={isFollowup} questions={questions} />;
}
