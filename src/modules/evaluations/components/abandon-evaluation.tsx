"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";

import { abandonEvaluationAction } from "../actions";
import type { AbandonEvaluationState } from "../validations";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

// Cerrar (archivar) un shell firmado sin responder, desde la ficha del paciente. Dos pasos: "Cerrar" abre
// una confirmacion que dice EXPLICITO que no se elimina el consentimiento y que el paciente puede empezar
// de nuevo (para que el profesional no dude si esta cerrando la puerta). No es reversible a proposito
// (reabrir reviviria el resume_token que queremos muerto); si el paciente vuelve, empieza una nueva.

const initial: AbandonEvaluationState = { error: null, closed: false };

export function AbandonEvaluation({ evaluationId }: { evaluationId: string }) {
  const [state, action, pending] = useActionState(abandonEvaluationAction, initial);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Cerrar evaluación
        </button>
        {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
      </div>
    );
  }

  return (
    <form onSubmit={enviarSinReset(action)} className="flex max-w-xs flex-col items-end gap-2 text-right">
      <input type="hidden" name="evaluationId" value={evaluationId} />
      <p className="text-xs text-muted-foreground">
        ¿Cerrar esta evaluación sin completar? El consentimiento firmado y su registro se conservan; no se
        elimina nada. Si el paciente vuelve, puede empezar una evaluación nueva.
      </p>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Cerrando..." : "Sí, cerrar"}
        </Button>
      </div>
    </form>
  );
}
