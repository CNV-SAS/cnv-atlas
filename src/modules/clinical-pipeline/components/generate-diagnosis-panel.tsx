"use client";

import Link from "next/link";
import { useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { runPipelineAction, type RunPipelineState } from "../actions";

const initialState: RunPipelineState = {
  error: null,
  success: null,
  warning: null,
  done: false,
  completeHref: null,
};

// Boton de generar diagnostico DENTRO de la pestana Diagnostico (el caso individual), ademas del panel de
// Evaluaciones (la lista, para trabajo de lote), como las otras colas. Gate de "listo": identidad confirmada
// + BIS importado. Antes la pestana mandaba una instruccion generica ("confirma la identidad, importa el BIS
// y genera desde el panel") aunque ya se hubieran hecho los dos primeros pasos; ahora dice QUE falta EXACTO.
export function GenerateDiagnosisPanel({
  evaluationId,
  identityConfirmed,
  bisImported,
}: {
  evaluationId: string;
  identityConfirmed: boolean;
  bisImported: boolean;
}) {
  const [state, action, pending] = useActionState(runPipelineAction, initialState);
  useFormToast(state);

  const ready = identityConfirmed && bisImported;

  if (!ready) {
    // Lo que falta, en el orden del flujo. Los dos pasos viven en la pestana Evaluacion de esta misma pagina
    // (visible arriba); se nombra, no se enlaza, porque las pestanas no son deep-linkables.
    const missing: string[] = [];
    if (!identityConfirmed) missing.push("confirmar la identidad del paciente");
    if (!bisImported) missing.push("importar la medición BIS");
    const falta = missing.length === 1 ? missing[0] : `${missing[0]} y ${missing[1]}`;
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-foreground">Esta evaluación aún no tiene un diagnóstico generado.</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          Para generarlo falta {falta}. {missing.length === 1 ? "Ese paso vive" : "Esos pasos viven"} en la
          pestaña <span className="font-medium text-foreground">Evaluación</span> de esta página.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
      <p className="text-sm text-foreground">
        Todo listo: identidad confirmada y medición BIS importada.
      </p>
      <form action={action} className="flex flex-col items-center gap-2">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        {/* Encuesta incompleta: no queda bloqueado a ciegas. Enlace a completarla (la pagina de editar
            resalta las preguntas que faltan). Gildardo 2026-08-13 §1. */}
        {state.completeHref ? (
          <Link
            href={state.completeHref}
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Completar la encuesta con el paciente
          </Link>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Generando..." : "Generar diagnóstico"}
        </Button>
        <p className="max-w-prose text-xs text-muted-foreground">
          Genera los indicadores, el diagnóstico, el tratamiento y el reporte con el motor clínico. El
          diagnóstico queda sin confirmar (la confirmación y el reporte final son un paso posterior).
        </p>
      </form>
    </div>
  );
}
