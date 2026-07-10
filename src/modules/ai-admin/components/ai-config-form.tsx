"use client";

import { useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";

import { saveAiConfigAction, type AiAdminActionState } from "../actions";
import type { AiConfigView } from "../data/ai-config-reader";

const initial: AiAdminActionState = { error: null, success: null, warning: null };

export function AiConfigForm({ view }: { view: AiConfigView }) {
  const [state, action, pending] = useActionState(saveAiConfigAction, initial);
  useFormToast(state);

  // Valor inicial: la config guardada, o el primer proveedor con key en el entorno.
  const defaultProvider =
    view.current?.activeProvider ?? view.providers.find((p) => p.hasKey)?.id ?? "groq";
  const defaultModel =
    view.current?.activeModel ??
    view.providers.find((p) => p.id === defaultProvider)?.envModel ??
    "";

  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Proveedor activo</span>
        <select
          name="activeProvider"
          defaultValue={defaultProvider}
          className="rounded-lg border border-input bg-background p-2"
        >
          {view.providers.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.hasKey}>
              {p.id}
              {p.hasKey ? "" : " (sin API key en el entorno)"}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Modelo</span>
        <input
          name="activeModel"
          type="text"
          defaultValue={defaultModel}
          placeholder="ej. llama-3.3-70b-versatile"
          required
          className="rounded-lg border border-input bg-background p-2"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar configuracion"}
      </button>
    </form>
  );
}
