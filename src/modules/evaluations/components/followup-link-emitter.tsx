"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";

import { emitFollowupLinkAction } from "../actions";
import type { FollowupLinkState } from "../validations";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

const followupInitial: FollowupLinkState = { error: null, linkPath: null };

// Emisor del link de seguimiento (un solo uso, vence 30 dias). Vive en un sitio FIJO (el perfil del paciente),
// no atado a la tarjeta de confirmar identidad, que desaparece al confirmar la identidad (Santiago 2026-08-20
// §5a). El emit action resuelve el profesional asignado y gatea la autorizacion en el servidor.
export function FollowupLinkEmitter({ patientId }: { patientId: string }) {
  const [state, action, emitting] = useActionState(emitFollowupLinkAction, followupInitial);
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={enviarSinReset(action)} className="flex items-center gap-2">
        <input type="hidden" name="patientId" value={patientId} />
        <Button type="submit" variant="outline" disabled={emitting}>
          {emitting ? "Generando..." : "Emitir link de seguimiento"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        El link de seguimiento es de un solo uso y vence 30 días después de emitirlo (colchón por defecto).
      </p>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.linkPath ? (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <span className="font-medium text-foreground">
            Link de seguimiento (un solo uso, vence en 30 días)
          </span>
          <span className="break-all text-primary">
            {origin}
            {state.linkPath}
          </span>
        </div>
      ) : null}
    </div>
  );
}
