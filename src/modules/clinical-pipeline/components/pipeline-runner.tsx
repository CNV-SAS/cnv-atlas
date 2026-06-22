"use client";

import { useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { runPipelineAction, type RunPipelineState } from "../actions";

export type DiagnosisCandidateView = {
  evaluationId: string;
  type: "inicial" | "seguimiento";
  createdAt: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  hasDiagnosis: boolean;
};

const initialState: RunPipelineState = {
  error: null,
  success: null,
  warning: null,
  done: false,
};

export function PipelineRunner({ evaluation }: { evaluation: DiagnosisCandidateView }) {
  const [state, action, pending] = useActionState(runPipelineAction, initialState);
  useFormToast(state);

  // Ya generado (en la carga o tras un envio exitoso): no se re-propaga.
  const done = evaluation.hasDiagnosis || state.done;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {evaluation.firstName} {evaluation.lastName}
          </CardTitle>
          <Badge variant="outline">
            {evaluation.type === "seguimiento" ? "Seguimiento" : "Inicial"}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {evaluation.documentType} {evaluation.documentNumber} · BIS importado
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {done ? (
          <Badge variant="outline" className="w-fit bg-clinical-optimal-bg text-clinical-optimal">
            Diagnostico generado
          </Badge>
        ) : (
          <form action={action} className="flex flex-col gap-2">
            <input type="hidden" name="evaluationId" value={evaluation.evaluationId} />
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <Button type="submit" disabled={pending} className="w-fit">
              {pending ? "Generando..." : "Generar diagnostico"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Genera indicadores, diagnostico, tratamiento y reporte con el motor stub.
              El diagnostico queda sin confirmar (la confirmacion y el reporte final son
              un paso posterior).
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
