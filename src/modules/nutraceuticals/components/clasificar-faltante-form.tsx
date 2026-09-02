"use client";

import { useActionState } from "react";

import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { classifyFaltanteFormAction } from "../actions";
import type { NutraceuticalFormState } from "../validations";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

// Clasificacion de admin. En un caso en revision (con justificacion) puede aceptarla (justificado / venta) o
// proponer injustificado; en un caso vencido sin justificar, solo proponer injustificado. "injustificado"
// PROPONE: el cargo no aplica hasta que direccion lo confirme.
export function ClasificarFaltanteForm({ caseId, mode }: { caseId: string; mode: "revision" | "vencido" }) {
  const [state, action, pending] = useActionState(classifyFaltanteFormAction, initial);
  useFormToastAndRefresh(state);

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="caseId" value={caseId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`dec-${caseId}`}>Decisión</Label>
        <select
          id={`dec-${caseId}`}
          name="decision"
          required
          defaultValue={mode === "vencido" ? "injustificado" : ""}
          className="flex h-9 w-72 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {mode === "revision" ? (
            <>
              <option value="">Selecciona la decisión</option>
              <option value="justificado">Justificado (sin cargo)</option>
              <option value="venta_no_registrada">Fue una venta no registrada (sin cargo)</option>
              <option value="injustificado">Injustificado (dirección confirma el cargo)</option>
            </>
          ) : (
            <option value="injustificado">Injustificado (dirección confirma el cargo)</option>
          )}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`reason-${caseId}`}>Motivo (opcional)</Label>
        <Input id={`reason-${caseId}`} name="reason" className="w-64" placeholder="Nota de la decisión" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Clasificar"}
      </Button>
    </form>
  );
}
