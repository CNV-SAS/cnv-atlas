"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { cerrarDevolucionFormAction } from "../actions";
import type { NutraceuticalFormState } from "../validations";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

// CNV CIERRA con lo que de verdad recibio.
//
// EL CAMPO VIENE VACIO Y NO PRELLENADO CON LO DECLARADO, a proposito: prellenarlo invita a confirmar sin
// contar, y lo unico que este formulario aporta sobre no tenerlo es que alguien cuente.
export function CerrarDevolucionForm({ returnId, declaradas }: { returnId: string; declaradas: number }) {
  const [state, action, pending] = useActionState(cerrarDevolucionFormAction, initial);
  useFormToastAndRefresh(state);

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="returnId" value={returnId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`rec-${returnId}`} className="text-xs">
          Unidades recibidas
        </Label>
        <Input id={`rec-${returnId}`} name="recibido" type="number" min={0} max={declaradas} required className="w-28" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`nota-${returnId}`} className="text-xs">
          Nota (opcional)
        </Label>
        <Input id={`nota-${returnId}`} name="nota" maxLength={300} placeholder="Estado del producto, guía..." className="w-64" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Cerrando..." : "Confirmar lo recibido"}
      </Button>
    </form>
  );
}
