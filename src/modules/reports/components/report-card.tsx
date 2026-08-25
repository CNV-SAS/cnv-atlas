"use client";

import { startTransition, useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { formatDate, formatDateOnly } from "@/lib/format/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { BAND_TEXT } from "@/modules/followups/services/eb-trajectory";

import {
  approveReportAction,
  confirmTrajectoryCommunicationAction,
  type ReportActionState,
  resendReportAction,
  sendReportAction,
} from "../actions";
import type { TrajectoryConfirmation } from "../data/reports-view-types";

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
  // P0 Parte 2: banda de EB-BIS sellada (para la superficie de confirmacion de "empeoro"). La puebla el
  // detalle de la evaluacion (getReportCardForEvaluation); las LISTAS la dejan undefined (no muestran la
  // confirmacion: la comunicacion del cambio se decide en el detalle, con el reporte completo a la vista).
  trajectory?: TrajectoryConfirmation | null;
};

const initialState: ReportActionState = { error: null, success: null, warning: null };

const STATUS_LABEL: Record<ReportCardView["status"], string> = {
  draft: "Borrador",
  approved: "Aprobado",
  sent: "Enviado",
};

export function ReportCard({ report }: { report: ReportCardView }) {
  const [approveState, approve, approving] = useActionState(approveReportAction, initialState);
  const [sendState, send, sending] = useActionState(sendReportAction, initialState);
  const [confirmState, confirm, confirming] = useActionState(confirmTrajectoryCommunicationAction, initialState);
  const [resendState, resend, resending] = useActionState(resendReportAction, initialState);
  useFormToast(approveState);
  useFormToast(sendState);
  useFormToast(confirmState);
  useFormToast(resendState);

  // Superficie de confirmacion de "empeoro" (P0 Parte 2): solo cuando el reporte esta en draft, la
  // banda sellada es 'empeoro' y aun no se confirmo. Es un acto APARTE de aprobar: comunicar un
  // empeoramiento al paciente es una DECISION, no un automatismo. Orden de lectura deliberado: primero
  // el TEXTO que recibira el paciente (lo que autoriza), luego la cifra (respaldo tecnico), luego la
  // cita (obligatoria), luego el boton.
  const t = report.trajectory;
  const resentCount = report.resentCount ?? 0;
  const showConfirm = report.status === "draft" && t?.band === "empeoro" && !t.communicated;

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
              className={
                report.status === "sent"
                  ? "bg-clinical-optimal-bg text-clinical-optimal"
                  : undefined
              }
            >
              {STATUS_LABEL[report.status]}
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
            href={`/evaluaciones/${report.evaluationId}`}
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
            {report.status === "sent" ? "Ver PDF enviado" : "Ver preview"}
          </a>
        </div>

        {showConfirm && t ? (
          <form action={confirm} className="flex w-full flex-col gap-3 rounded-md border border-clinical-warning/40 bg-clinical-warning-bg p-3">
            <input type="hidden" name="reportId" value={report.reportId} />
            <span className="text-sm font-semibold text-clinical-warning">
              Comunicar un cambio desfavorable al paciente
            </span>
            {/* 1. El texto EXACTO que recibira el paciente: es lo que se autoriza. */}
            <p className="rounded border border-clinical-warning/30 bg-background/60 p-2 text-sm text-foreground">
              {BAND_TEXT.empeoro}
            </p>
            {/* 2. Respaldo tecnico de la decision: la cifra (para el profesional, con marca provisional). */}
            <span className="text-xs text-muted-foreground">
              Respaldo (no va al paciente): la edad bioeléctrica subió {t.ebDelta.toFixed(1)} años respecto
              de la medición anterior{t.provisional ? " · calibración provisional, no comunicable" : ""}.
            </span>
            {/* 3. La proxima cita: se MUESTRA, no se pide (2026-08-25). Se fija en Seguimiento, que es el
                unico sitio donde se decide; aqui es la CONDICION del acto. La regla de Gildardo se conserva
                entera: un "empeoro" no se comunica sin cita agendada. Lo que cambia es que este acto deja
                de ser tambien el de agendar, y queda limpio: confirmar que se le comunica al paciente. */}
            {t.proximaCita ? (
              <span className="rounded border border-clinical-warning/30 bg-background/60 px-2 py-1.5 text-xs text-foreground">
                Próxima cita agendada: <strong>{formatDateOnly(t.proximaCita)}</strong>. Para cambiarla, ve
                a Seguimiento.
              </span>
            ) : (
              <span className="rounded border border-clinical-warning/30 bg-background/60 px-2 py-1.5 text-xs text-foreground">
                Este paciente <strong>no tiene próxima cita agendada</strong>, y un cambio desfavorable no
                se comunica sin ella.{" "}
                <a
                  href={`/evaluaciones/${report.evaluationId}?etapa=seguimiento`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Agéndala en Seguimiento
                </a>{" "}
                y vuelve aquí.
              </span>
            )}
            {/* 4. El boton: nombra el acto (confirmar la comunicacion). Sin cita no se puede. */}
            <Button type="submit" size="sm" disabled={confirming || !t.proximaCita} className="self-start">
              {confirming ? "Confirmando…" : "Confirmar la comunicación"}
            </Button>
          </form>
        ) : null}

        {report.status === "draft" && t?.band === "empeoro" && t.communicated ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Comunicación del cambio confirmada y próxima cita agendada. El paciente recibirá esta sección
            en su reporte al aprobar.
          </p>
        ) : null}

        {report.status === "draft" ? (
          <form action={approve} className="flex w-full flex-col gap-2">
            <input type="hidden" name="reportId" value={report.reportId} />
            <label htmlFor={`notes-${report.reportId}`} className="text-xs text-muted-foreground">
              Notas del reporte (opcional). Se escriben aqui, se congelan al aprobar y pueden
              enviarse al paciente segun el modo de envio. Son la unica superficie de notas que
              llega al paciente: distintas del criterio del diagnostico y de las notas del
              tratamiento, que son internas.
            </label>
            <textarea
              id={`notes-${report.reportId}`}
              name="professionalNotes"
              rows={3}
              className="w-full rounded-md border border-input bg-background p-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              placeholder="Tus notas para el paciente (opcional)."
            />
            {/* El boton no queda MUERTO: dice por que no se puede todavia. Un control deshabilitado sin
                explicacion se lee como defecto de la pantalla, no como una condicion que falta cumplir.
                Solo aparece cuando la banda es 'empeoro' y falta confirmar (showConfirm): una trayectoria
                estable o mejor, y un reporte sin banda, no ven nada de esto. */}
            {showConfirm ? (
              <span className="text-xs text-clinical-warning">
                Falta confirmar la comunicación del cambio desfavorable y agendar la próxima cita. Es el
                bloque de arriba: sin eso, este reporte no se puede aprobar ni enviar.
              </span>
            ) : null}
            <Button type="submit" size="sm" disabled={approving || showConfirm} className="self-start">
              {approving ? "Aprobando..." : "Aprobar"}
            </Button>
          </form>
        ) : null}

        {report.status === "approved" ? (
          <form action={send} className="flex w-full flex-col gap-2">
            <input type="hidden" name="reportId" value={report.reportId} />
            <fieldset className="flex flex-col gap-1">
              <legend className="text-xs text-muted-foreground">Modo de envio al paciente</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="sendMode" value="atlas" defaultChecked className="accent-primary" />
                Reporte de Atlas
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="sendMode" value="notas" className="accent-primary" />
                Solo mis notas
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="sendMode" value="ambos" className="accent-primary" />
                Reporte de Atlas y mis notas
              </label>
            </fieldset>
            <span className="text-xs text-muted-foreground">
              Los modos con notas requieren que las hayas escrito al aprobar.
            </span>
            <Button type="submit" size="sm" disabled={sending} className="self-start">
              {sending ? "Enviando..." : "Enviar al paciente"}
            </Button>
          </form>
        ) : null}

        {/* REENVIO del MISMO documento. Separado del envio a proposito: el titulo, el texto y el boton
            dicen "el mismo" en los tres sitios, para que no se lea como emitir uno nuevo (que no existe;
            va con el mecanismo de sucesion de versiones). El modo de envio NO se ofrece: cambiarlo
            cambiaria lo que el paciente recibe, y eso ya seria otro documento.
            El envio va por onSubmit + startTransition y NO por la prop `action`: la prop resetea los
            inputs no controlados tras la accion, y un error borraria el motivo que el profesional escribio
            (hazard de React 19 registrado en CLAUDE.md). */}
        {report.status === "sent" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              startTransition(() => resend(data));
            }}
            className="flex w-full flex-col gap-2 rounded-md border border-border bg-muted/30 p-3"
          >
            <input type="hidden" name="reportId" value={report.reportId} />
            <span className="text-sm font-semibold">Reenviar el mismo documento</span>
            <span className="text-xs text-muted-foreground">
              Vuelve a mandar por correo <strong>el mismo reporte</strong>, con el mismo contenido y el
              mismo modo de envío. No genera un reporte nuevo ni recalcula nada. Úsalo si el correo se
              perdió o si se corrigió la dirección del paciente.
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

        {report.status === "approved" || report.status === "sent" ? (
          <p className="text-xs text-muted-foreground">
            Este reporte está aprobado y es inmutable
            {report.status === "sent" ? " y ya fue enviado al paciente" : ""}. Sus notas quedaron
            congeladas al aprobar; para cambiar el contenido o las notas se genera una corrección
            (una versión nueva del reporte).
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
