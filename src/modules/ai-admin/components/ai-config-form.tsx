"use client";

import { startTransition, useActionState, useState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";

import { saveAiConfigAction, type AiAdminActionState } from "../actions";
import type { AiConfigView } from "../data/ai-config-reader";

const initial: AiAdminActionState = { error: null, success: null, warning: null };

export function AiConfigForm({ view }: { view: AiConfigView }) {
  const [state, action, pending] = useActionState(saveAiConfigAction, initial);
  useFormToast(state);

  // Proveedor inicial: el guardado, o el primero utilizable (con key y modelo en el entorno).
  const firstUsable = view.providers.find((p) => p.hasKey && p.models.length > 0)?.id;
  const initialProvider =
    view.current?.activeProvider ?? firstUsable ?? view.providers[0]?.id ?? "groq";

  // UNICA fuente de verdad de la seleccion: el proveedor. El modelo NO es un segundo estado
  // editable (ops lo fija por entorno, un modelo por proveedor): se DERIVA del proveedor.
  const [provider, setProvider] = useState<string>(initialProvider);
  const model = view.providers.find((p) => p.id === provider)?.models[0] ?? "";

  // Confirmacion "Activo": lo que esta REALMENTE guardado. Deriva (sin estado ni efecto) del
  // resultado de la accion si acaba de guardar; si no, del snapshot del servidor. Asi refleja
  // el guardado al INSTANTE, sin el lag del round-trip de revalidacion.
  const saved = state.saved
    ? state.saved
    : view.current
      ? { provider: view.current.activeProvider, model: view.current.activeModel }
      : null;

  // Se despacha la accion por onSubmit + startTransition (no por el prop `action` del form):
  // React 19 auto-resetea un <form action={...}> al completar la accion, y ese form.reset()
  // nativo repinta el <select> controlado a su opcion por defecto (rebote visual a Groq).
  // Despachando manualmente se evita ese reset; el estado controlado no se toca.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Proveedor activo</span>
        <select
          name="activeProvider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="rounded-lg border border-input bg-background p-2"
        >
          {view.providers.map((p) => {
            const usable = p.hasKey && p.models.length > 0;
            const reason = !p.hasKey
              ? " (sin API key en el entorno)"
              : p.models.length === 0
                ? " (sin modelo en el entorno)"
                : "";
            return (
              <option key={p.id} value={p.id} disabled={!usable}>
                {p.id}
                {reason}
              </option>
            );
          })}
        </select>
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Modelo</span>
        {/* Solo display: el modelo NO se envia. El servidor lo deriva del proveedor recibido,
            asi no puede llegar un par proveedor/modelo inconsistente desde el cliente. */}
        <p className="rounded-lg border border-input bg-muted/40 p-2 font-mono text-xs text-foreground">
          {model || "(sin modelo en el entorno)"}
        </p>
        <span className="text-xs text-muted-foreground">
          El modelo lo fija el entorno para cada proveedor (garantizado que funciona). Eliges el
          proveedor.
        </span>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar configuracion"}
      </button>

      {saved ? (
        <p className="text-xs text-muted-foreground">
          Activo: {saved.provider} / {saved.model}.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sin configuracion en base de datos: hoy se usa el proveedor definido en el entorno.
        </p>
      )}
    </form>
  );
}
