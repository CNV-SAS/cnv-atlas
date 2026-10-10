"use client";

import Link from "next/link";
import { useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { runPipelineAction, type RunPipelineState } from "../actions";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

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
  salida: null,
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
          <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-2">
            <input type="hidden" name="evaluationId" value={evaluation.evaluationId} />
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            {/* No queda bloqueado a ciegas: la puerta que lo freno trae a donde se arregla, con su
                etiqueta. Gildardo 2026-08-13 §1 para la encuesta; la ficha del paciente se sumo el
                2026-10-10 (faltaba el sexo y esto mandaba a la encuesta, que no lo tiene). */}
            {state.salida ? (
              <Link
                href={state.salida.href}
                className="w-fit text-sm font-medium text-primary underline underline-offset-4"
              >
                {state.salida.etiqueta}
              </Link>
            ) : null}
            <Button type="submit" disabled={pending} className="w-fit">
              {pending ? "Generando..." : "Generar diagnóstico"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Genera los indicadores, el diagnóstico, el tratamiento y el reporte con el motor clínico.
              El diagnóstico queda sin confirmar (la confirmación y el reporte final son un paso
              posterior).
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
