"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { returnComodatoFormAction } from "../actions";
import type { ComodatoFormState } from "../validations";
import { selectClass } from "./field-styles";

const initial: ComodatoFormState = { error: null, success: null };

// Registrar devolucion de un comodato activo: fecha real + cierre del contrato.
export function ReturnComodatoForm({ assignmentId }: { assignmentId: string }) {
  const [state, action, pending] = useActionState(returnComodatoFormAction, initial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`return-${assignmentId}`} className="text-xs">
          Devolucion
        </Label>
        <Input
          id={`return-${assignmentId}`}
          name="actualReturnDate"
          type="date"
          required
          className="h-8"
        />
      </div>
      <select name="status" defaultValue="completed" aria-label="Cierre" className={`${selectClass} h-8`}>
        <option value="completed">Completado</option>
        <option value="breach">Incumplimiento</option>
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "..." : "Registrar devolucion"}
      </Button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}
