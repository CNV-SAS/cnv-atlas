"use client";

import { useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { approveReportAction, type ReportActionState, sendReportAction } from "../actions";

export type ReportCardView = {
  reportId: string;
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
      <CardContent className="flex flex-wrap items-center gap-3">
        <a
          href={`/reportes/${report.reportId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {report.status === "sent" ? "Ver PDF enviado" : "Ver preview"}
        </a>

        {report.status === "draft" ? (
          <form action={approve}>
            <input type="hidden" name="reportId" value={report.reportId} />
            <Button type="submit" size="sm" disabled={approving}>
              {approving ? "Aprobando..." : "Aprobar"}
            </Button>
          </form>
        ) : null}

        {report.status === "approved" ? (
          <form action={send}>
            <input type="hidden" name="reportId" value={report.reportId} />
            <Button type="submit" size="sm" disabled={sending}>
              {sending ? "Enviando..." : "Enviar al paciente"}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
