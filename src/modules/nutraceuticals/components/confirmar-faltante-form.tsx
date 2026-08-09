"use client";

import { useActionState } from "react";

import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { confirmFaltanteFormAction } from "../actions";
import type { NutraceuticalFormState } from "../validations";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

// Confirmacion de direccion. Dos botones (confirmar / rechazar): el cargo NO se materializa hasta que
// direccion confirma. Rechazar cierra el caso sin cargo (direccion puede vetar el cobro).
export function ConfirmarFaltanteForm({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState(confirmFaltanteFormAction, initial);
  useFormToastAndRefresh(state);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="caseId" value={caseId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`creason-${caseId}`}>Motivo (opcional)</Label>
        <Input id={`creason-${caseId}`} name="reason" className="w-64" placeholder="Nota de la confirmación" />
      </div>
      <Button type="submit" name="decision" value="confirmar" disabled={pending}>
        Confirmar el cargo
      </Button>
      <Button type="submit" name="decision" value="rechazar" variant="outline" disabled={pending}>
        Rechazar (sin cargo)
      </Button>
    </form>
  );
}
