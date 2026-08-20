"use client";

import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";

import { startFollowupAction } from "../actions";
import type { StartFollowupState } from "../validations";

const initialState: StartFollowupState = { error: null, resumeToken: null, revoked: false };

// Pantalla de inicio del SEGUIMIENTO SIN FIRMA (dictamen legal 2026-08-20 §3): el paciente ya esta verificado
// y su consentimiento vigente cubre el seguimiento (numeral 4), asi que NO se re-firma ni se pide codigo. Un
// boton crea el shell (verificando la vigencia en el servidor) y pasa a la encuesta. Al pie, un enlace
// DISCRETO (no un boton) para las dos excepciones: cambiar autorizaciones o correo -> camino con firma.
export function FollowupStartScreen({
  token,
  onStarted,
  onException,
}: {
  token: string;
  onStarted: (resumeToken: string) => void;
  onException: () => void;
}) {
  const [state, action, pending] = useActionState(startFollowupAction, initialState);

  useEffect(() => {
    if (state.resumeToken) onStarted(state.resumeToken);
  }, [state.resumeToken, onStarted]);

  // Autorizacion necesaria no vigente (revocada): no se creo nada; se avisa sin culpar y se remite al
  // profesional (redaccion aprobada 2026-08-20).
  if (state.revoked) {
    return (
      <div className="rounded-lg border border-clinical-warning/40 bg-clinical-warning-bg px-4 py-3 text-sm text-clinical-warning">
        Para continuar necesitamos una autorización que hoy no está vigente. Comunícate con tu profesional
        para retomar tu evaluación.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-sm text-foreground">
          Tu identidad y tu consentimiento ya están registrados de tu evaluación anterior. Vas a continuar
          directamente con la encuesta de seguimiento.
        </p>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <form action={action}>
        <input type="hidden" name="token" value={token} />
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Un momento..." : "Comenzar la encuesta"}
        </Button>
      </form>

      {/* Excepciones (dictamen §3): discreto, al pie, que no invite. El que no necesita cambiar nada no entra
          por curiosidad a re-firmar sin motivo. */}
      <p className="text-xs text-muted-foreground">
        <button type="button" onClick={onException} className="underline underline-offset-2">
          ¿Necesitas cambiar tus autorizaciones o tu correo?
        </button>
      </p>
    </div>
  );
}
