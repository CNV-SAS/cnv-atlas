"use client";

import { useCallback, useState } from "react";

import type { SurveyQuestionView } from "../data/survey-view-types";
import { SignPhaseForm } from "./sign-phase-form";
import { SurveyPhaseForm } from "./survey-phase-form";

// Orquestador del intake del paciente (reorganizacion 2026-08-10). Dos fases en secuencia:
//   1. FIRMAR   (SignPhaseForm): consentimiento + identidad + codigo -> crea el shell y da el resume_token.
//   2. ENCUESTA (SurveyPhaseForm): respuestas con guardado a medida y envio; muestra el enlace de
//      reanudacion arriba (copiable). Se elimino la pantalla intermedia "firmado": el enlace ya llega por
//      correo y vive en la fase 2, asi el intake tiene una parada menos.
// La reanudacion por enlace entra directo en la fase 2 (otra pagina monta SurveyPhaseForm con prefill).
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
  // resume_token null = aun en la fase de firma; con valor = ya firmo, esta en la encuesta.
  const [resumeToken, setResumeToken] = useState<string | null>(null);

  const handleSigned = useCallback((tokenValue: string) => {
    setResumeToken(tokenValue);
  }, []);

  if (!resumeToken) {
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

  return <SurveyPhaseForm resumeToken={resumeToken} isFollowup={isFollowup} questions={questions} />;
}
