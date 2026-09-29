"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { marcarVencimientoVistoFormAction } from "../actions";
import type { NutraceuticalFormState } from "../validations";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

// "Ya lo vi" sobre una alerta de vencimiento. Un boton y nada mas: no hay nada que el Integrante elija, y la
// fecha la pone el servidor (no viaja del navegador, que es lo que la haria discutible).
export function MarcarVencimientoVistoForm({ alertaId }: { alertaId: string }) {
  const [state, action, pending] = useActionState(marcarVencimientoVistoFormAction, initial);
  useFormToastAndRefresh(state);

  return (
    <form onSubmit={enviarSinReset(action)}>
      <input type="hidden" name="alertaId" value={alertaId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Registrando..." : "Ya lo vi"}
      </Button>
    </form>
  );
}
