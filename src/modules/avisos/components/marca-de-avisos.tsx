"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastRefreshOnSuccess } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { cambiarMarcaFormAction } from "../actions";
import type { AvisoFormState } from "../validations";

const initial: AvisoFormState = { error: null, success: null, warning: null };

const ETIQUETA = {
  pendientes_ventas: "Pendientes de ventas",
  escalamiento_ventas: "Escalamiento",
} as const;

// UNA MARCA DE AVISOS de un usuario interno (Bloque A): la pone o la quita el administrador. Cambiar de responsable
// es esto, sin tocar codigo ni variables.
export function MarcaDeAvisos({
  profileId,
  tipo,
  activa,
}: {
  profileId: string;
  tipo: keyof typeof ETIQUETA;
  activa: boolean;
}) {
  const [state, action, pending] = useActionState(cambiarMarcaFormAction, initial);
  useFormToastRefreshOnSuccess(state);
  return (
    <form onSubmit={enviarSinReset(action)}>
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="poner" value={activa ? "no" : "si"} />
      <Button type="submit" size="sm" variant={activa ? "default" : "outline"} disabled={pending} aria-pressed={activa}>
        {ETIQUETA[tipo]}: {activa ? "sí" : "no"}
      </Button>
    </form>
  );
}
