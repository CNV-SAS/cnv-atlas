"use client";

import { startTransition, useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";

import { revokeAccessAction, type AccessActionState } from "../actions";

const initial: AccessActionState = { error: null, success: null, warning: null };

// Boton para que el solicitante revoque (cancele o corte) su propio grant.
export function RevokeControl({ grantId }: { grantId: string }) {
  const [state, action, pending] = useActionState(revokeAccessAction, initial);
  useFormToast(state);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("grantId", grantId);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={handleSubmit}>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-input px-3 py-1.5 text-xs text-muted-foreground disabled:opacity-60"
      >
        Revocar
      </button>
    </form>
  );
}
