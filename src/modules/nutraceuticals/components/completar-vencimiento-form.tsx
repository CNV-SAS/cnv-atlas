"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { completarVencimientoFormAction } from "../actions";
import type { NutraceuticalFormState } from "../validations";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

// CNV escribe el vencimiento REAL de un lote provisional. Un campo de fecha y un boton: no hay nada mas que
// decidir, y el dato sale del envase que CNV tiene delante.
export function CompletarVencimientoForm({ lotId }: { lotId: string }) {
  const [state, action, pending] = useActionState(completarVencimientoFormAction, initial);
  useFormToastAndRefresh(state);

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="lotId" value={lotId} />
      <div className="flex flex-col gap-1">
        <label htmlFor={`vence-${lotId}`} className="text-xs text-muted-foreground">
          Vence el
        </label>
        <Input id={`vence-${lotId}`} name="vence" type="date" required className="w-44" />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Guardando..." : "Registrar"}
      </Button>
    </form>
  );
}
