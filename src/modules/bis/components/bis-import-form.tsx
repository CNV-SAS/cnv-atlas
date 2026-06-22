"use client";

import { useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { importBisAction, type ImportBisState } from "../actions";

export type BisImportEvaluationView = {
  evaluationId: string;
  type: "inicial" | "seguimiento";
  createdAt: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  alreadyImported: boolean;
};

const initialState: ImportBisState = {
  error: null,
  success: null,
  warning: null,
  fields: null,
  imported: false,
  valueCount: null,
};

export function BisImportForm({ evaluation }: { evaluation: BisImportEvaluationView }) {
  const [state, action, pending] = useActionState(importBisAction, initialState);
  // Toast de exito/error (el detalle por variable se sigue mostrando inline).
  useFormToast(state);

  // Ya importado (en la carga de la pagina o tras un envio exitoso): no se reimporta.
  const done = evaluation.alreadyImported || state.imported;

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
          {evaluation.documentType} {evaluation.documentNumber} · identidad confirmada el{" "}
          {new Date(evaluation.createdAt).toLocaleDateString("es-CO")}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {done ? (
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="w-fit bg-clinical-optimal-bg text-clinical-optimal">
              Medicion BIS importada
            </Badge>
            {state.valueCount !== null ? (
              <span className="text-xs text-muted-foreground">
                Se guardaron {state.valueCount} variables de la medicion.
              </span>
            ) : null}
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-3">
            <input type="hidden" name="evaluationId" value={evaluation.evaluationId} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`file-${evaluation.evaluationId}`} className="text-sm font-medium">
                Archivo XLSX exportado de Biody Manager
              </label>
              <Input
                id={`file-${evaluation.evaluationId}`}
                name="file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
                disabled={pending}
              />
            </div>

            {state.error ? (
              <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <span className="text-sm font-medium text-destructive">{state.error}</span>
                {state.fields ? (
                  <ul className="flex flex-col gap-0.5">
                    {Object.entries(state.fields).map(([variable, message]) => (
                      <li key={variable} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{variable}:</span> {message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <Button type="submit" disabled={pending} className="w-fit">
              {pending ? "Importando..." : "Importar medicion BIS"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
