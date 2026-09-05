"use client";

import { useActionState, useState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { formatDate } from "@/lib/format/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { importBisAction, type ImportBisState } from "../actions";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

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

export function BisImportForm({
  evaluation,
  disabledReason = null,
}: {
  evaluation: BisImportEvaluationView;
  // Motivo por el que el import esta deshabilitado (p. ej. condiciones sin responder). Si no es
  // null, el boton y el archivo quedan deshabilitados con la explicacion en gris (ensena que falta,
  // en vez de esconder la seccion). null = habilitado.
  disabledReason?: string | null;
}) {
  const [state, action, pending] = useActionState(importBisAction, initialState);
  /** Nombre del archivo elegido, solo para confirmarlo en pantalla. El que viaja es el del FormData. */
  const [archivo, setArchivo] = useState<string | null>(null);
  // Toast de exito/error (el detalle por variable se sigue mostrando inline).
  useFormToast(state);

  // Ya importado (en la carga de la pagina o tras un envio exitoso): no se reimporta.
  const done = evaluation.alreadyImported || state.imported;
  const blocked = Boolean(disabledReason);

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
          {formatDate(evaluation.createdAt)}
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
          <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-3">
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
                disabled={pending || blocked}
                onChange={(e) => setArchivo(e.target.files?.[0]?.name ?? null)}
              />
              {/* CONFIRMACION DE LO ELEGIDO (cotejo 2026-09-05, punto 7). El control nativo pone el nombre
                  del archivo pegado al boton y con el mismo peso, asi que no se distingue de la etiqueta.
                  Esta linea dice, aparte y con todas las letras, QUE archivo se va a importar. Importa mas
                  que en un formulario cualquiera: importar el archivo del paciente equivocado no se corrige,
                  obliga a cerrar la evaluacion y rehacerla. */}
              {archivo ? (
                <p className="text-sm text-clinical-optimal">
                  Archivo seleccionado: <span className="font-semibold">{archivo}</span>
                </p>
              ) : null}
            </div>

            {disabledReason ? (
              <p className="text-xs text-muted-foreground">{disabledReason}</p>
            ) : null}

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

            <Button type="submit" disabled={pending || blocked} className="w-fit">
              {pending ? "Importando..." : "Importar medición BIS"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
