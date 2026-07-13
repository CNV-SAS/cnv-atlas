"use client";

import { startTransition, useActionState, useState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";

import { requestAccessAction, type AccessActionState } from "../actions";

const initial: AccessActionState = { error: null, success: null, warning: null };

// Formulario de solicitud de acceso a las notas. Despacha por onSubmit + startTransition
// (no por el prop `action`) para evitar el auto-reset de <form action> en React 19. El
// nivel identificado muestra los campos de documento del paciente.
export function RequestAccessForm() {
  const [state, action, pending] = useActionState(requestAccessAction, initial);
  useFormToast(state);

  const [grantType, setGrantType] = useState("notes_pseudonymous");
  const identified = grantType === "notes_identified";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Nivel de acceso</span>
        <select
          name="grantType"
          value={grantType}
          onChange={(e) => setGrantType(e.target.value)}
          className="rounded-lg border border-input bg-background p-2"
        >
          <option value="notes_pseudonymous">Seudonimizado (sin identidad del paciente)</option>
          <option value="notes_identified">Identificado (un paciente puntual)</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Categoria del motivo</span>
        <select
          name="reasonCategory"
          defaultValue="auditoria_calidad"
          className="rounded-lg border border-input bg-background p-2"
        >
          <option value="auditoria_calidad">Auditoria de calidad</option>
          <option value="soporte_tecnico">Soporte tecnico</option>
        </select>
      </label>

      {identified ? (
        <div className="flex gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Tipo doc.</span>
            <select
              name="documentType"
              defaultValue="CC"
              className="rounded-lg border border-input bg-background p-2"
            >
              <option value="CC">CC</option>
              <option value="CE">CE</option>
              <option value="TI">TI</option>
              <option value="PA">PA</option>
              <option value="NIT">NIT</option>
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Documento del paciente</span>
            <input
              name="documentNumber"
              className="rounded-lg border border-input bg-background p-2"
              placeholder="Numero de documento"
            />
          </label>
        </div>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Motivo</span>
        <textarea
          name="reason"
          rows={3}
          className="rounded-lg border border-input bg-background p-2"
          placeholder="Explica la causa del acceso (queja, verificacion de una posible desviacion, etc.)."
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Enviando..." : "Solicitar acceso"}
      </button>
    </form>
  );
}
