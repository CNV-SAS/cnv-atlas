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
  modoReemplazo = false,
}: {
  evaluation: BisImportEvaluationView;
  /**
   * REEMPLAZAR la medicion existente en vez de importar la primera.
   *
   * POR QUE HACE FALTA (smoke de Santiago, 2026-09-05): el porton del reimport se movio a "¿ya hay
   * diagnostico?", pero este formulario se OCULTA en cuanto hay medicion, que era correcto cuando
   * reimportar era imposible. El guard quedo construido y sin superficie que llegara a el: la pieza sin
   * su ultimo cable, esta vez en lo recien hecho.
   *
   * Cambia los TEXTOS, no el camino: la accion es la misma y el writer decide si puede.
   */
  modoReemplazo?: boolean;
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
  const done = (evaluation.alreadyImported || state.imported) && !modoReemplazo;
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
            {/* NEUTRO, NO VERDE CLINICO (2026-09-05). Decia "importada" en `clinical-optimal`, y ese verde
                significa un veredicto OPTIMO SOBRE EL PACIENTE, no que un archivo se cargo. Es la misma
                confusion de capas que venimos cerrando en otras pantallas; aqui llevaba desde que se
                escribio y el candado de capa clinica no lo veia porque no barre `modules/bis`. */}
            <Badge variant="outline" className="w-fit">
              Medición BIS importada
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
            {modoReemplazo ? (
              /* QUE REEMPLAZA, DICHO ANTES DE ELEGIR EL ARCHIVO. Sin esto el profesional puede creer que
                 se suma una segunda medicion, que es justo lo que el writer impide: la anterior se borra
                 en la misma transaccion. */
              <p className="rounded-md border border-attention bg-attention-bg px-3 py-2 text-sm text-foreground">
                <span className="font-semibold text-attention">Esto reemplaza la medición actual.</span>{" "}
                La anterior se elimina y el diagnóstico se calculará sobre el archivo nuevo. Solo se puede
                mientras la evaluación no tenga diagnóstico generado.
              </p>
            ) : null}
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
                <p className="text-sm text-muted-foreground">
                  Archivo seleccionado:{" "}
                  <span className="font-semibold text-foreground">{archivo}</span>
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
              {pending
                ? modoReemplazo
                  ? "Reemplazando..."
                  : "Importando..."
                : modoReemplazo
                  ? "Reemplazar la medición"
                  : "Importar medición BIS"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
