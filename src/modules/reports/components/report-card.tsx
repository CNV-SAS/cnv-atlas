"use client";

import { useActionState, useState } from "react";

import { useFormToast, useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { formatDate, formatDateOnly } from "@/lib/format/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  emitirVersionNuevaAction,
  type ReportActionState,
  resendReportAction,
  sendReportAction,
} from "../actions";
import type { TrajectoryConfirmation } from "../data/reports-view-types";
import { ejecutarAccion, enviarSinReset } from "@/components/shared/enviar-sin-reset";

export type ReportCardView = {
  reportId: string;
  evaluationId: string;
  evaluationType: "inicial" | "seguimiento";
  status: "draft" | "approved" | "sent";
  // Cuantas veces salio el MISMO documento despues del primer envio (0 = solo el original).
  resentCount?: number;
  documentLabel: string;
  patientName: string;
  createdAt: string;
  // Banda de EB-BIS sellada, con la proxima cita cuando la banda es 'empeoro'. La puebla el detalle de la
  // evaluacion (getReportCardForEvaluation); las LISTAS la dejan undefined. Aqui ya NO se confirma nada:
  // sirve para ADELANTAR el freno de la entrega, que vive en el servicio.
  trajectory?: TrajectoryConfirmation | null;
  // La ultima vez que este reporte salio hacia el paciente, del registro de entregas (0148). undefined =
  // no se consulto (las listas no lo traen).
  ultimaEntrega?: { fecha: string; enviadaA: string } | null;
};

const initialState: ReportActionState = { error: null, success: null, warning: null };

// ═══ EL REPORTE ES UNA HOJA MAS (Santiago, 2026-09-18) ═══
//
// LO QUE HABIA AQUI: una ceremonia de tres actos. Confirmar la comunicacion del cambio desfavorable,
// escribir unas notas y aprobar, y solo entonces elegir entre tres modos de envio. El modelo de Gildardo
// no tiene nada de eso: cada pantalla se imprime o se manda, y ya.
//
// LO QUE QUEDA: ver el documento, mandarlo, y saber cuando salio. Las notas que acompañan al paciente son
// la OBSERVACION DE LA CONSULTA (Seguimiento), que es la que el profesional escribe de verdad.
//
// Y LA UNICA GARANTIA CLINICA QUE HABIA EN LA CEREMONIA NO SE PERDIO: un cambio desfavorable no sale sin
// la proxima cita agendada. Se mudo al servicio de entrega (`freno-de-trayectoria`), donde alcanza
// tambien a la impresion. Aqui se ANTICIPA, para que el profesional no descubra el freno al pulsar: un
// guard correcto mal expuesto se siente como un defecto de la pantalla.
export function ReportCard({ report }: { report: ReportCardView }) {
  const [sendState, send, sending] = useActionState(sendReportAction, initialState);
  const [resendState, resend, resending] = useActionState(resendReportAction, initialState);
  const [reemitirState, reemitir, reemitiendo] = useActionState(emitirVersionNuevaAction, initialState);
  useFormToast(sendState);
  useFormToast(resendState);
  // EMITIR CAMBIA EL DOCUMENTO QUE LA TARJETA MUESTRA (pasa a ser el nuevo, en borrador), asi que esta
  // accion SI refresca: sin refrescar, la tarjeta seguia diciendo "enviado" y ofrecia reenviar una
  // version que nunca habia salido. Las otras dos no lo necesitan (el revalidate de la accion basta).
  useFormToastAndRefresh(reemitirState);

  // LA CONFIRMACION VIVE EN LA TARJETA, un paso antes de cada salida hacia el paciente.
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [confirmandoReenvio, setConfirmandoReenvio] = useState(false);
  const [confirmandoVersion, setConfirmandoVersion] = useState(false);

  // AL ACTUAR SE CIERRAN LAS CONFIRMACIONES (smoke de Santiago, 2026-09-19). Al emitir una version nueva
  // la pagina traia el informe nuevo, pero los dos bloques seguian ABIERTOS con su "¿lo reenviamos?" y su
  // "¿emitimos una version nueva?" encima: preguntas de un acto que ya ocurrio, sobre un documento que ya
  // no es el mismo. Es el mismo defecto que "en gestion" y la ficha del paciente, resuelto igual:
  // ajustando el estado durante el render, no en un efecto.
  const [ultimoEstado, setUltimoEstado] = useState(initialState);
  const estadoVivo = reemitirState !== initialState ? reemitirState : resendState !== initialState ? resendState : sendState;
  if (estadoVivo !== ultimoEstado) {
    setUltimoEstado(estadoVivo);
    if (estadoVivo.success) {
      setConfirmandoEnvio(false);
      setConfirmandoReenvio(false);
      setConfirmandoVersion(false);
    }
  }

  const t = report.trajectory;
  const resentCount = report.resentCount ?? 0;
  const enviado = report.status === "sent";
  // El freno tal como lo evalua el servicio: banda 'empeoro' y sin proxima cita.
  const frenado = t?.band === "empeoro" && !t.proximaCita;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{report.patientName}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {report.evaluationType === "seguimiento" ? "Seguimiento" : "Inicial"}
            </Badge>
            <Badge
              variant="outline"
              className={enviado ? "bg-clinical-optimal-bg text-clinical-optimal" : undefined}
            >
              {enviado ? "Enviado" : "Sin enviar"}
            </Badge>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {report.documentLabel} · {formatDate(report.createdAt)}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        {/* SE RETIRO "Ver resultados" (Santiago, 2026-09-19): la tarjeta vive DENTRO de la evaluacion, asi
            que enlazaba a donde el profesional ya esta. Lo que hace falta aqui es el documento. */}
        <div className="flex flex-wrap items-center gap-4">
          <a
            href={`/reportes/${report.reportId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {enviado ? "Ver el informe enviado" : "Ver o imprimir el informe"}
          </a>
        </div>

        {/* EL FRENO, ADELANTADO. No es un aviso decorativo: el envio fallaria con este mismo motivo. Se
            dice ANTES de pulsar, con el enlace al unico sitio donde se agenda (Seguimiento). */}
        {frenado ? (
          <p className="w-full rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-xs text-foreground">
            Esta consulta informa un <strong>cambio desfavorable</strong> y el paciente no tiene la próxima
            cita agendada. Enterarse de que está peor sin saber cuándo lo vuelven a ver es la peor forma de
            recibirlo, así que el reporte no se le envía todavía.{" "}
            <a
              href={`/ani-bis-e/${report.evaluationId}?etapa=seguimiento`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Agéndala en Seguimiento
            </a>{" "}
            y vuelve aquí.
          </p>
        ) : null}

        {t?.band === "empeoro" && t.proximaCita && !enviado ? (
          <p className="w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Cambio desfavorable, con la próxima cita agendada para{" "}
            <strong>{formatDateOnly(t.proximaCita)}</strong>. El reporte se puede enviar.
          </p>
        ) : null}

        {/* ENVIAR PIDE CONFIRMACION (Santiago, 2026-09-19). Es un correo a un paciente con su documento
            clinico: sale una vez y no se recoge. El paso intermedio cuesta un clic y evita el envio por
            error, que no tiene deshacer.

            DOS PASOS EN LA MISMA TARJETA y no un dialogo del navegador: `confirm()` bloquea el hilo, se
            ve ajeno a la aplicacion y en algunos navegadores se puede silenciar. */}
        {!enviado ? (
          <form onSubmit={enviarSinReset(send)} className="flex w-full flex-col gap-2">
            <input type="hidden" name="reportId" value={report.reportId} />
            <span className="text-xs text-muted-foreground">
              Se le envía por correo su informe: el diagnóstico en lenguaje claro, su plan, lo que va a
              trabajar, sus suplementos y su próxima consulta. El envío queda registrado.
            </span>
            {confirmandoEnvio ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
                <span className="text-xs text-foreground">
                  Se le enviará a <strong>su correo registrado</strong>. ¿Lo mandamos?
                </span>
                <Button type="submit" size="sm" disabled={sending || frenado}>
                  {sending ? "Enviando..." : "Sí, enviar"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmandoEnvio(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={frenado}
                className="self-start"
                onClick={() => setConfirmandoEnvio(true)}
              >
                Enviar al paciente
              </Button>
            )}
          </form>
        ) : null}

        {/* REENVIO del MISMO documento. Separado del envio a proposito: el titulo, el texto y el boton
            dicen "el mismo" en los tres sitios, para que no se lea como emitir uno nuevo (que no existe;
            va con el mecanismo de sucesion de versiones).

            EL MOTIVO OBLIGATORIO SE RETIRO (Santiago, 2026-09-19): convertia un gesto de un clic ("el
            correo reboto") en un formulario, y lo que se escribia no lo leia nadie. LA CUENTA SE QUEDA,
            que es lo que el profesional si mira: cuantas veces ha salido ya.

            El envio va por onSubmit + startTransition y NO por la prop `action` (hazard de React 19
            registrado en CLAUDE.md). */}
        {enviado ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              ejecutarAccion(resend, data);
            }}
            className="flex w-full flex-col gap-2 rounded-md border border-border bg-muted/30 p-3"
          >
            <input type="hidden" name="reportId" value={report.reportId} />
            <span className="text-sm font-semibold">Reenviar el mismo documento</span>
            <span className="text-xs text-muted-foreground">
              Vuelve a mandar por correo <strong>el mismo informe</strong>, tal cual salió. No genera uno
              nuevo ni recalcula nada. Úsalo si el correo se perdió o si se corrigió la dirección del
              paciente.
              {resentCount > 0
                ? ` Ya se reenvió ${resentCount} ${resentCount === 1 ? "vez" : "veces"}.`
                : ""}
            </span>
            {confirmandoReenvio ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-foreground">¿Lo reenviamos?</span>
                <Button type="submit" size="sm" variant="outline" disabled={resending}>
                  {resending ? "Reenviando…" : "Sí, reenviar"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmandoReenvio(false)}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="self-start"
                onClick={() => setConfirmandoReenvio(true)}
              >
                Reenviar el mismo documento
              </Button>
            )}
          </form>
        ) : null}

        {/* ═══ ¿CAMBIÓ ALGO DESPUÉS DE ENVIARLO? (Santiago, 2026-09-19) ═══

            LA PREGUNTA QUE LO PIDIÓ, literal: *"que pasa si cambio algo del diagnostico o de las notas de
            seguimiento y quiero que vayan en el nuevo reporte? no hay forma, ya que solo puedo reenviar el
            anterior"*. Tenía razón, y es el caso normal de una consulta.

            LAS TRES SALIDAS, DICHAS DONDE SE ELIGEN: reenviar (el mismo, arriba), emitir una versión nueva
            (aquí) y corregir la evaluación (en Diagnóstico, cuando lo que está mal es un DATO). Se explica
            la diferencia en una línea porque las tres se parecen y confundirlas tiene consecuencias
            distintas: una manda lo mismo, otra manda lo nuevo y la tercera rehace la cadena. */}
        {enviado ? (
          <form onSubmit={enviarSinReset(reemitir)} className="flex w-full flex-col gap-2">
            <input type="hidden" name="reportId" value={report.reportId} />
            <span className="text-sm font-semibold">¿Cambió algo después de enviarlo?</span>
            <span className="text-xs text-muted-foreground">
              Emite una <strong>versión nueva</strong> con lo que cambió (tu observación de la consulta, el
              plan ajustado). El diagnóstico es el mismo: si lo que está mal es un dato, corrige la
              evaluación desde Diagnóstico. El informe que ya recibió el paciente se conserva tal cual.
            </span>
            {confirmandoVersion ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-foreground">¿Emitimos una versión nueva?</span>
                <Button type="submit" size="sm" variant="outline" disabled={reemitiendo}>
                  {reemitiendo ? "Emitiendo…" : "Sí, emitirla"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmandoVersion(false)}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="self-start"
                onClick={() => setConfirmandoVersion(true)}
              >
                Emitir una versión nueva
              </Button>
            )}
          </form>
        ) : null}

        {/* CUANDO SALIO Y A DONDE, del mismo registro que las demas hojas (0148): el profesional necesita
            poder MOSTRAR que lo entrego. Un registro que se escribe y no se ve nunca es medio registro. */}
        {report.ultimaEntrega ? (
          <p className="text-xs text-muted-foreground">
            Última entrega: {report.ultimaEntrega.fecha} a {report.ultimaEntrega.enviadaA}.
          </p>
        ) : null}

        {enviado ? (
          <p className="text-xs text-muted-foreground">
            El documento que recibió el paciente queda guardado tal cual salió.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
