"use client";

import { useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { formatDate, formatDateOnly } from "@/lib/format/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { type ReportActionState, resendReportAction, sendReportAction } from "../actions";
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
  useFormToast(sendState);
  useFormToast(resendState);

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
        <div className="flex flex-wrap items-center gap-4">
          <a
            href={`/ani-bis-e/${report.evaluationId}`}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver resultados
          </a>
          <a
            href={`/reportes/${report.reportId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {enviado ? "Ver el PDF enviado" : "Ver o imprimir el reporte"}
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

        {!enviado ? (
          <form onSubmit={enviarSinReset(send)} className="flex w-full flex-col gap-2">
            <input type="hidden" name="reportId" value={report.reportId} />
            <span className="text-xs text-muted-foreground">
              Se le envía por correo el reporte de esta consulta con su plan. Si escribiste una observación
              en Seguimiento, va con él. El envío queda registrado.
            </span>
            <Button type="submit" size="sm" disabled={sending || frenado} className="self-start">
              {sending ? "Enviando..." : "Enviar al paciente"}
            </Button>
          </form>
        ) : null}

        {/* REENVIO del MISMO documento. Separado del envio a proposito: el titulo, el texto y el boton
            dicen "el mismo" en los tres sitios, para que no se lea como emitir uno nuevo (que no existe;
            va con el mecanismo de sucesion de versiones).
            El envio va por onSubmit + startTransition y NO por la prop `action`: la prop resetea los
            inputs no controlados tras la accion, y un error borraria el motivo que el profesional escribio
            (hazard de React 19 registrado en CLAUDE.md). */}
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
              Vuelve a mandar por correo <strong>el mismo reporte</strong>, con el mismo contenido.{" "}
              No genera un reporte nuevo ni recalcula nada. Úsalo si el correo se perdió o si se corrigió
              la dirección del paciente.
              {resentCount > 0
                ? ` Ya se reenvió ${resentCount} ${resentCount === 1 ? "vez" : "veces"}.`
                : ""}
            </span>
            <label htmlFor={`motivo-${report.reportId}`} className="text-xs text-muted-foreground">
              Motivo del reenvío (obligatorio). Queda registrado en la auditoría.
            </label>
            <input
              id={`motivo-${report.reportId}`}
              name="reason"
              required
              maxLength={300}
              placeholder="Por ejemplo: el correo rebotó, o el paciente corrigió su dirección."
              className="w-full rounded-md border border-input bg-background p-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <Button type="submit" size="sm" variant="outline" disabled={resending} className="self-start">
              {resending ? "Reenviando…" : "Reenviar el mismo documento"}
            </Button>
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
            El documento que recibió el paciente queda guardado tal cual salió. Para cambiar su contenido
            se genera una corrección (una versión nueva del reporte).
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
