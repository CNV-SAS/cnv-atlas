"use client";

import { useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";

import { savePromptAction, type AiAdminActionState } from "../actions";
import type { PromptView } from "../data/ai-prompt-reader";

const initial: AiAdminActionState = { error: null, success: null, warning: null };

export function AiPromptForm({ view }: { view: PromptView }) {
  const [state, action, pending] = useActionState(savePromptAction, initial);
  useFormToast(state);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="promptKey" value={view.promptKey} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">
            Instrucciones del sistema
            {view.activeVersion != null ? ` (activa: v${view.activeVersion})` : ""}
          </span>
          <textarea
            name="content"
            defaultValue={view.activeContent ?? ""}
            rows={8}
            required
            className="rounded-lg border border-input bg-background p-3 font-mono text-xs leading-relaxed"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Solo el bloque de instrucciones es editable. El mensaje con los objetivos del
          paciente (calorias, proteina, restricciones, fenotipo) se arma en codigo y no viaja
          por aqui, para que sea imposible enviar datos personales al modelo. Guardar crea una
          version nueva; la anterior queda en el historial.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar version nueva"}
        </button>
      </form>

      {view.versions.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-foreground">Historial de versiones</h3>
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {view.versions.map((v) => (
              <li key={v.version}>
                v{v.version} · {v.status === "active" ? "activa" : "retirada"} ·{" "}
                {new Date(v.createdAt).toLocaleDateString("es-CO")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
