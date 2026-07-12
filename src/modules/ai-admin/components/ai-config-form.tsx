"use client";

import { useActionState, useState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";

import { saveAiConfigAction, type AiAdminActionState } from "../actions";
import type { AiConfigView } from "../data/ai-config-reader";

const initial: AiAdminActionState = { error: null, success: null, warning: null };

export function AiConfigForm({ view }: { view: AiConfigView }) {
  const [state, action, pending] = useActionState(saveAiConfigAction, initial);
  useFormToast(state);

  // Proveedor inicial: el guardado, o el primero con key en el entorno.
  const firstWithKey = view.providers.find((p) => p.hasKey)?.id;
  const initialProvider = view.current?.activeProvider ?? firstWithKey ?? "groq";

  const [provider, setProvider] = useState<string>(initialProvider);

  const modelsOf = (id: string) => view.providers.find((p) => p.id === id)?.models ?? [];
  const currentModels = modelsOf(provider);

  // Modelo inicial: el guardado si pertenece al proveedor actual; si no, el primero valido.
  const savedModel = view.current?.activeModel ?? "";
  const [model, setModel] = useState<string>(
    currentModels.includes(savedModel) ? savedModel : (currentModels[0] ?? ""),
  );

  // Al cambiar el proveedor, refresca el modelo a una opcion valida del nuevo proveedor (evita
  // dejar un modelo del proveedor anterior, que el servidor rechazaria por inconsistente).
  function onProviderChange(next: string) {
    setProvider(next);
    const nextModels = modelsOf(next);
    setModel((cur) => (nextModels.includes(cur) ? cur : (nextModels[0] ?? "")));
  }

  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground">Proveedor activo</span>
        <select
          name="activeProvider"
          value={provider}
          onChange={(e) => onProviderChange(e.target.value)}
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
        <select
          name="activeModel"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          required
          className="rounded-lg border border-input bg-background p-2"
        >
          {currentModels.length === 0 ? (
            <option value="">(sin modelos configurados)</option>
          ) : (
            currentModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))
          )}
        </select>
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
