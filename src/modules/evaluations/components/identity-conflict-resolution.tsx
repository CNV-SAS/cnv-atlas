"use client";

import { startTransition, useActionState, useState } from "react";

import { Button } from "@/components/ui/button";

import { resolveIdentityConflictAction } from "../actions";
import type { ResolveConflictState } from "../validations";

// Resolucion de un conflicto de identidad (documento coincide, nombre difiere), en el panel del
// profesional. Muestra AMBOS nombres (registrado vs declarado) y dos salidas:
//   - "Es la misma persona": limpia el conflicto; la evaluacion sigue el flujo normal (confirmar identidad).
//   - "No es la misma persona": CIERRA la evaluacion. Como eso archiva lo que el paciente firmo y
//     respondio, va con confirmacion y dice que hay que pedirle que la haga de nuevo con su documento correcto.
// Las acciones se invocan imperativamente (sin <form>), asi no hay auto-reset ni el hazard de los botones.

const initial: ResolveConflictState = { error: null, resolved: false };

export function IdentityConflictResolution({
  evaluationId,
  registeredName,
  declaredName,
}: {
  evaluationId: string;
  registeredName: string;
  declaredName: string;
}) {
  const [state, action, pending] = useActionState(resolveIdentityConflictAction, initial);
  const [confirmingDifferent, setConfirmingDifferent] = useState(false);

  const resolve = (decision: "same" | "different") => {
    const fd = new FormData();
    fd.set("evaluationId", evaluationId);
    fd.set("decision", decision);
    startTransition(() => action(fd));
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">Conflicto de identidad</h3>
        <p className="text-xs text-muted-foreground">
          El documento coincide con un paciente registrado, pero el nombre no. Confirma si es la misma
          persona antes de continuar.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col rounded-md border border-border bg-background p-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Registrado</span>
          <span className="text-sm font-medium text-foreground">{registeredName || "-"}</span>
        </div>
        <div className="flex flex-col rounded-md border border-border bg-background p-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Declaró en la encuesta</span>
          <span className="text-sm font-medium text-foreground">{declaredName || "-"}</span>
        </div>
      </div>

      {state.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </p>
      ) : null}

      {!confirmingDifferent ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => resolve("same")} disabled={pending}>
            {pending ? "Resolviendo..." : "Es la misma persona"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmingDifferent(true)}
            disabled={pending}
          >
            No es la misma persona
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">
            Esto cierra la evaluación. El paciente firmó y respondió, pero se archiva y no se usa. Pídele
            que la haga de nuevo con su documento correcto.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmingDifferent(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={() => resolve("different")} disabled={pending}>
              {pending ? "Cerrando..." : "Sí, cerrarla"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
