"use client";

import { startTransition, useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";

import { decideAccessAction, type AccessActionState } from "../actions";

const initial: AccessActionState = { error: null, success: null, warning: null };

// Controles de decision de una solicitud (aprobar/negar). Un solo form con dos botones;
// el boton pulsado fija la decision (via submitter). Al aprobar, la duracion es opcional:
// vacia usa el default del nivel; el service la acota por el tope duro. Se despacha por
// onSubmit + startTransition (patron React 19).
export function DecisionControls({ grantId, defaultHours }: { grantId: string; defaultHours: number }) {
  const [state, action, pending] = useActionState(decideAccessAction, initial);
  useFormToast(state);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const formData = new FormData(e.currentTarget);
    formData.set("grantId", grantId);
    formData.set("decision", submitter?.value === "approve" ? "approve" : "deny");
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        name="durationHours"
        type="number"
        min={1}
        placeholder={`${defaultHours} h`}
        title="Duracion en horas (vacio = default del nivel)"
        className="w-24 rounded-lg border border-input bg-background p-1.5 text-sm"
      />
      <button
        type="submit"
        value="approve"
        disabled={pending}
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        Aprobar
      </button>
      <button
        type="submit"
        value="deny"
        disabled={pending}
        className="rounded-lg border border-input px-3 py-1.5 text-sm text-foreground disabled:opacity-60"
      >
        Negar
      </button>
    </form>
  );
}
