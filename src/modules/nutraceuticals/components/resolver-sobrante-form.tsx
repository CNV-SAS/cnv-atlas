"use client";

import { useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { resolveSobranteFormAction } from "../actions";
import type { NutraceuticalFormState } from "../validations";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

// Resolver un sobrante: el motivo es OBLIGATORIO (por que sobra: una recepcion o un despacho no
// registrado). Ajustar hacia arriba sin motivo cerraria el numero pero perderia la pregunta.
export function ResolverSobranteForm({ countLineId }: { countLineId: string }) {
  const [state, action, pending] = useActionState(resolveSobranteFormAction, initial);
  useFormToast(state);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="countLineId" value={countLineId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`sob-${countLineId}`}>Motivo (por qué sobra)</Label>
        <Input
          id={`sob-${countLineId}`}
          name="reason"
          required
          className="w-96 max-w-full"
          placeholder="Ej. recepción no registrada del 3 de agosto"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Ajustando..." : "Resolver (ajustar saldo)"}
      </Button>
    </form>
  );
}
