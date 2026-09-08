"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import type { SignIdentityPrefill } from "../types";
import type { SurveyQuestionView } from "../data/survey-view-types";
import { FollowupStartScreen } from "./followup-start-screen";
import { SignPhaseForm } from "./sign-phase-form";
import { SurveyPhaseForm } from "./survey-phase-form";

// Orquestador del intake del paciente (reorganizacion 2026-08-10). Caminos:
//   INICIAL: FIRMAR (SignPhaseForm: consentimiento + identidad + codigo) -> ENCUESTA (SurveyPhaseForm).
//   SEGUIMIENTO NORMAL (dictamen legal 2026-08-20 §3): SIN FIRMA. FollowupStartScreen verifica la vigencia y
//     crea el shell sin codigo -> ENCUESTA. El numeral 4 del consentimiento ya cubre "continuidad y seguimiento".
//   SEGUIMIENTO con BUMP SUSTANTIVO o EXCEPCION (cambiar autorizaciones/contacto): camino CON firma.
// Se firma ANTES de recolectar porque la Ley 1581 exige autorizacion previa (dictamen de borrador).

export type SurveyIntakeFormProps = {
  token: string;
  isFollowup: boolean;
  prefill: SignIdentityPrefill | null;
  questions: SurveyQuestionView[];
  consentText: string;
  professional: { fullName: string; profession: string; license: string | null };
  // Seguimiento: "nosign" = camino sin firma (normal); "sign" = requiere firma (bump sustantivo). Inicial: ignora.
  followupMode?: "nosign" | "sign";
  // El documento de consentimiento cambio de forma sustantiva desde que el paciente firmo: se avisa por que
  // se le pide firmar de nuevo (si no, extrana que esta vez si le pidan).
  substantiveBump?: boolean;
};

export function SurveyIntakeForm({
  token,
  isFollowup,
  prefill,
  questions,
  consentText,
  professional,
  followupMode = "sign",
  substantiveBump = false,
}: SurveyIntakeFormProps) {
  // resume_token null = aun antes de la encuesta; con valor = shell creado (firmando o sin firma), en la encuesta.
  const [resumeToken, setResumeToken] = useState<string | null>(null);
  // Si otorgo investigacion, la fase 2 muestra el campo de etnia (consent v1.0). En seguimiento no aplica (el
  // perfil no se recaptura), asi que queda false.
  const [ethnicityAuthorized, setEthnicityAuthorized] = useState(false);
  // El paciente eligio el camino de EXCEPCION (cambiar autorizaciones/contacto): pasa al camino con firma.
  const [manualSign, setManualSign] = useState(false);

  const router = useRouter();

  // SI SE RETOMO una evaluacion que ya existia, el paciente NO puede caer en la encuesta de despues de
  // firmar: esa arranca en blanco, y el guardado manda el SNAPSHOT COMPLETO, asi que enviarla vacia
  // borraria lo que ya llevaba respondido. Se le lleva a la pagina de reanudacion, que es la que carga su
  // avance (y ya existe, con su manejo de revocacion y de token vencido).
  //
  // Es el defecto que Santiago vio como "la encuesta empieza desde cero": el reuso ocurria de verdad en la
  // base (el audit lo registro) y la PANTALLA no lo acompañaba. Reusar la evaluacion sin reusar sus
  // respuestas es peor que no reusarla.
  const continuar = useCallback(
    (tokenValue: string, reanudar: boolean) => {
      if (reanudar) router.replace(`/encuesta/reanudar/${tokenValue}`);
      else setResumeToken(tokenValue);
    },
    [router],
  );

  const handleStarted = useCallback(
    (tokenValue: string, reanudar: boolean) => continuar(tokenValue, reanudar),
    [continuar],
  );
  const handleSigned = useCallback(
    (tokenValue: string, ethAuth: boolean, reanudar: boolean) => {
      setEthnicityAuthorized(ethAuth);
      continuar(tokenValue, reanudar);
    },
    [continuar],
  );
  const handleException = useCallback(() => setManualSign(true), []);

  if (resumeToken) {
    return (
      <SurveyPhaseForm
        resumeToken={resumeToken}
        isFollowup={isFollowup}
        questions={questions}
        ethnicityAuthorized={ethnicityAuthorized}
      />
    );
  }

  // Seguimiento normal (sin bump sustantivo) y sin haber pedido la excepcion: camino SIN firma.
  if (isFollowup && followupMode === "nosign" && !manualSign) {
    return (
      <FollowupStartScreen token={token} onStarted={handleStarted} onException={handleException} />
    );
  }

  // Camino con firma: inicial, bump sustantivo, o excepcion elegida.
  return (
    <SignPhaseForm
      token={token}
      prefill={prefill}
      consentText={consentText}
      professional={professional}
      onSigned={handleSigned}
      substantiveBump={substantiveBump}
    />
  );
}
