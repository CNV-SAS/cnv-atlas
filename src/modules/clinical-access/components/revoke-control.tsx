"use client";

import { ejecutarAccion } from "@/components/shared/enviar-sin-reset";
import { useActionState } from "react";

import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";

import { revokeAccessAction, type AccessActionState } from "../actions";

const initial: AccessActionState = { error: null, success: null, warning: null };

// Boton para que el solicitante revoque (cancele o corte) su propio grant.
// EL GUARD DEL SCROLL VIENE POR `ejecutarAccion` (2026-09-10). Estos formularios escribian a mano lo que
// el helper ya hace (`preventDefault` + FormData + `startTransition`), y al hacerlo se quedaban fuera del
// unico sitio donde se arma el guard. Invocar una server action navega con ScrollBehavior.Default: sin
// guard, la pagina salta al inicio.
export function RevokeControl({ grantId }: { grantId: string }) {
  const [state, action, pending] = useActionState(revokeAccessAction, initial);
  useFormToastAndRefresh(state);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("grantId", grantId);
    ejecutarAccion(action, formData);
  }

  return (
    <form onSubmit={handleSubmit}>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-input px-3 py-1.5 text-xs text-muted-foreground disabled:opacity-60"
      >
        Revocar
      </button>
    </form>
  );
}
