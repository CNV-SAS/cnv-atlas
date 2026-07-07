import { NextResponse } from "next/server";

import { requireUser } from "@/modules/auth/session";
import { getReportDispatch } from "@/modules/reports/data/reports-repository";
import { createSignedReportUrl } from "@/modules/reports/data/report-storage";
import { canManageReports } from "@/modules/reports/policies/can-manage-reports";
import { renderReportPdf } from "@/modules/reports/services/render-report";

// Acceso interno al PDF del reporte. Valida ownership (sesion + RLS via
// getReportDispatch) y entrega el PDF nunca como HTML (adjunto/visor, SECURITY.md):
//   - reporte enviado (con storage_path): redirige a una URL firmada de corta vida.
//   - draft/approved: render on-the-fly para el preview (no se almacena).
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

  // Enviado: el PDF vive en Storage; se sirve por URL firmada.
  if (dispatch.storagePath) {
    const signed = await createSignedReportUrl(dispatch.storagePath);
    if (!signed) return new NextResponse("PDF no disponible", { status: 500 });
    return NextResponse.redirect(signed);
  }

  // Preview: render del snapshot inmutable, en linea (visor del navegador). Se muestra
  // TODO lo disponible (modo 'ambos': reporte + notas si las hay) para que el profesional
  // vea el contenido completo antes de elegir el modo de envio.
  const pdf = await renderReportPdf(
    dispatch.snapshot,
    {
      patientName: dispatch.patientName || "Paciente",
      documentLabel: dispatch.documentLabel,
      evaluationDate: new Date(dispatch.evaluationDate).toLocaleDateString("es-CO"),
      reportId: dispatch.reportId,
    },
    { mode: "ambos", professionalNotes: dispatch.professionalNotes },
  );
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="reporte-${dispatch.reportId}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
