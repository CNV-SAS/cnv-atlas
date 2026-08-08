"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { markReturnFormAction } from "../actions";
import type { ReferralFormState } from "../validations";

const initial: ReferralFormState = { error: null, success: null };

// Marca "el paciente volvió" (segundo acto, write-once). Colapsado hasta que el profesional lo abre, para
// no llenar la lista de formularios. La fecha por defecto es hoy (editable); la nota es opcional.
export function MarkReturnForm({
  referralId,
  patientId,
  today,
}: {
  referralId: string;
  patientId: string;
  today: string; // yyyy-mm-dd calculado en el server (el tiempo no va en el render del cliente)
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(markReturnFormAction, initial);
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success(state.success);
  }, [state]);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Marcar retorno
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="referralId" value={referralId} />
      <input type="hidden" name="patientId" value={patientId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`ret-${referralId}`} className="text-xs">
          Fecha en que volvió
        </Label>
        <Input
          id={`ret-${referralId}`}
          name="returnedAt"
          type="date"
          defaultValue={today}
          max={today}
          required
          className="h-9 w-40"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`note-${referralId}`} className="text-xs">
          Nota (opcional)
        </Label>
        <Input id={`note-${referralId}`} name="returnNotes" type="text" className="h-9 w-64" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Guardando..." : "Confirmar retorno"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </form>
  );
}
