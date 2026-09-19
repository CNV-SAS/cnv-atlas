import { NextResponse } from "next/server";

import { requireUser } from "@/modules/auth/session";
import { getReportDispatch } from "@/modules/reports/data/reports-repository";
import { formatDate } from "@/lib/format/date";
import { downloadReportPdf } from "@/modules/reports/data/report-storage";
import { canManageReports } from "@/modules/reports/policies/can-manage-reports";
import { ultimaObservacionDeLaConsulta } from "@/modules/reports/data/freno-de-trayectoria";
import { getInformeDelPaciente } from "@/modules/reports/data/informe-paciente-reader";
import { getPlanPaciente } from "@/modules/reports/data/plan-paciente-reader";
import { renderReportPdf } from "@/modules/reports/services/render-report";

// Acceso interno al PDF del reporte. Valida ownership (sesion + RLS via
// getReportDispatch) y entrega el PDF nunca como HTML (adjunto/visor, SECURITY.md):
//   - reporte enviado (con storage_path): redirige a una URL firmada de corta vida.
//   - sin enviar: render on-the-fly para el preview (no se almacena).
// @react-pdf/renderer necesita el runtime de Node.
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireUser();
  if (!canManageReports(user)) {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const dispatch = await getReportDispatch(id);
  if (!dispatch) return new NextResponse("Reporte no encontrado", { status: 404 });

  // Enviado: el PDF vive en Storage; se TRANSMITE por esta ruta (nunca la URL firmada, que seria un token
  // al portador si se comparte). El acceso ya se valido arriba (ownership via RLS).
  if (dispatch.storagePath) {
    const pdf = await downloadReportPdf(dispatch.storagePath);
    if (!pdf) return new NextResponse("PDF no disponible", { status: 500 });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="reporte-${dispatch.reportId}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  // Preview: render del snapshot inmutable, en linea (visor del navegador). ES EL MISMO DOCUMENTO QUE
  // SALE, y de la misma fuente: la observacion de la consulta (Seguimiento), no las notas del reporte, que
  // se retiraron con la ceremonia (2026-09-18). Un preview que lea otra cosa le enseña al profesional un
  // documento que el paciente no va a recibir.
  const pdf = await renderReportPdf(
    dispatch.snapshot,
    {
      patientName: dispatch.patientName || "Paciente",
      documentLabel: dispatch.documentLabel,
      evaluationDate: formatDate(dispatch.evaluationDate),
      consultationDate: formatDate(dispatch.consultationDate),
      reportId: dispatch.reportId,
    },
    {
      mode: "ambos",
      professionalNotes: await ultimaObservacionDeLaConsulta(dispatch.evaluationId),
      bandText: dispatch.patientBandText,
      bandAppointmentDate: dispatch.patientBandAppointmentDate,
      // EL PLAN TAMBIEN EN EL PREVIEW, y es la mitad que se olvida: el profesional aprueba mirando ESTO.
      // Un preview sin el plan le haria aprobar un documento que no es el que se envia.
      plan: await getPlanPaciente(dispatch.evaluationId, dispatch.snapshot),
      // Y EL RESTO DEL INFORME, por la misma razon que el plan: el preview tiene que ser el documento que
      // sale. Un preview al que le falta la mitad ensena un documento que el paciente no va a recibir.
      informe: await getInformeDelPaciente(dispatch.evaluationId, dispatch.snapshot),
    },
  );
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="reporte-${dispatch.reportId}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
