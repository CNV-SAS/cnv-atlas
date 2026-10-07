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
}) {
  const [state, action, pending] = useActionState(importBisAction, initialState);
  /** Nombre del archivo elegido, solo para confirmarlo en pantalla. El que viaja es el del FormData. */
  const [archivo, setArchivo] = useState<string | null>(null);
  // Toast de exito/error (el detalle por variable se sigue mostrando inline).
  useFormToast(state);

  /** Cual medicion importar cuando el archivo trae varias. Vacio = la mas reciente. */
  const [otraFecha, setOtraFecha] = useState("");

  // ═══ EL ARCHIVO TRAIA VARIAS MEDICIONES: EL FORMULARIO NO SE DESMONTA (2026-10-06) ═══
  //
  // Se importo la mas reciente, y en una consulta RETROACTIVA la que corresponde es la de la fecha de esa
  // consulta. Si el bloque se cerrara, cambiarla obligaria a volver a empezar con el archivo editado a mano,
  // que es justo lo que este cambio vino a quitar.
  //
  // Y EL ARCHIVO SIGUE EN EL CAMPO: `enviarSinReset` no lo limpia, asi que re-enviar con otra fecha no le
  // pide al profesional volver a buscarlo. El writer reemplaza la medicion anterior en la misma transaccion,
  // y solo se puede mientras no haya diagnostico, que es el porton que de verdad protege.
  const variasMediciones = (state.fechasDisponibles?.length ?? 0) > 1;

  // Ya importado (en la carga de la pagina o tras un envio exitoso): no se reimporta.
  const done = (evaluation.alreadyImported || state.imported) && !modoReemplazo && !variasMediciones;

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
            {/* CUAL MEDICION ENTRO, Y COMO CAMBIARLA. Sale solo cuando el archivo traía varias: en el caso
                normal no hay nada que decir ni que elegir. */}
            {variasMediciones ? (
              <div className="flex flex-col gap-2 rounded-md border border-attention bg-attention-bg px-3 py-2">
                {/* ═══ "LA MÁS RECIENTE" SOLO CUANDO DE VERDAD LO ES (Santiago, 2026-10-06) ═══

                    Lo decía siempre, así que tras elegir la más antigua la pantalla afirmaba que esa era la
                    última. Es la clase de frase que hace dudar de si el selector funcionó: el dato era
                    correcto y el rótulo lo contradecía.

                    SE DERIVA, no se guarda: la más reciente es la primera de la lista, que ya viene ordenada.
                    Una bandera aparte sería un segundo sitio donde decir lo mismo. */}
                <p className="text-sm text-foreground">
                  El archivo traía{" "}
                  <span className="font-semibold">{state.fechasDisponibles!.length} mediciones</span> y se
                  importó la del <span className="font-semibold">{state.fechaImportada}</span>
                  {state.fechaImportada === state.fechasDisponibles![0]
                    ? ", la más reciente."
                    : " (la más reciente es la del " + state.fechasDisponibles![0] + ")."}
                </p>
                {/* SI LA CONSULTA ES DE OTRA FECHA, la más reciente no es la que corresponde. Se dice el caso
                    en vez de dejar un selector sin explicación. */}
                <p className="text-xs text-muted-foreground">
                  Si esta consulta es de otra fecha, elige la medición que corresponde y vuelve a importar. El
                  archivo que elegiste sigue puesto, y la medición anterior se reemplaza.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor={`fecha-${evaluation.evaluationId}`} className="text-xs font-medium">
                    Medición
                  </label>
                  <select
                    id={`fecha-${evaluation.evaluationId}`}
                    name="fechaDeLaMedicion"
                    value={otraFecha}
                    onChange={(e) => setOtraFecha(e.target.value)}
                    disabled={pending}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {/* LA MÁS RECIENTE ES LA PRIMERA DE LA LISTA, no la importada: tras elegir otra, decir
                        aquí la importada haría que la opción "la más reciente" nombrara una fecha que no lo
                        es. */}
                    <option value="">La más reciente ({state.fechasDisponibles![0]})</option>
                    {state.fechasDisponibles!.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
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
                disabled={pending}
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

            {/* YA NO HAY ESTADO DESHABILITADO (2026-09-22): lo que falte lo dice el boton al pulsarlo, en el
                recuadro de error de abajo, y el archivo elegido se conserva (`enviarSinReset`). */}
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

            {/* `key` DISTINTA según el estado del bloque (hazard 1 de CLAUDE.md): cuando el aviso de varias
                mediciones aparece, este botón pasa de importar a importar la elegida, y React reutilizaría el
                mismo nodo del DOM. Con la clave, el viejo se desmonta y el nuevo se monta. */}
            <Button
              key={variasMediciones ? "reimportar-otra-medicion" : "importar-medicion"}
              type="submit"
              disabled={pending}
              className="w-fit"
            >
              {pending
                ? modoReemplazo
                  ? "Reemplazando..."
                  : "Importando..."
                : variasMediciones
                  ? "Importar la medición elegida"
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
