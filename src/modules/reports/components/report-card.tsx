"use client";

import { useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { approveReportAction, type ReportActionState, sendReportAction } from "../actions";

export type ReportCardView = {
  reportId: string;
  evaluationId: string;
  evaluationType: "inicial" | "seguimiento";
  status: "draft" | "approved" | "sent";
  documentLabel: string;
  patientName: string;
  createdAt: string;
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
  useFormToast(approveState);
  useFormToast(sendState);

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
          {report.documentLabel} · {new Date(report.createdAt).toLocaleDateString("es-CO")}
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

        {report.status === "draft" ? (
          <form action={approve} className="flex w-full flex-col gap-2">
            <input type="hidden" name="reportId" value={report.reportId} />
            <label htmlFor={`notes-${report.reportId}`} className="text-xs text-muted-foreground">
              Notas de interpretacion (opcional). Se congelan al aprobar.
            </label>
            <textarea
              id={`notes-${report.reportId}`}
              name="professionalNotes"
              rows={3}
              className="w-full rounded-md border border-input bg-background p-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              placeholder="Tus notas para el paciente (opcional)."
            />
            <Button type="submit" size="sm" disabled={approving} className="self-start">
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
      </CardContent>
    </Card>
  );
}
