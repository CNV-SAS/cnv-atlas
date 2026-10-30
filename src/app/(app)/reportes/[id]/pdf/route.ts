import { NextResponse } from "next/server";

import { requireUser } from "@/modules/auth/session";
import { getReportDispatch } from "@/modules/reports/data/reports-repository";
import { formatDate } from "@/lib/format/date";
import { downloadPlanPdf, downloadReportPdf } from "@/modules/reports/data/report-storage";
import { canManageReports } from "@/modules/reports/policies/can-manage-reports";
import { ultimaObservacionDeLaConsulta } from "@/modules/reports/data/freno-de-trayectoria";
import { getInformeDelPaciente } from "@/modules/reports/data/informe-paciente-reader";
import { getSerieDelPaciente } from "@/modules/reports/data/serie-del-paciente";
import { getPlanPaciente } from "@/modules/reports/data/plan-paciente-reader";
import { metaDelPlan, renderPlanPdf, renderReportPdf } from "@/modules/reports/services/render-report";

// Acceso interno al PDF del reporte. Valida ownership (sesion + RLS via
// getReportDispatch) y entrega el PDF nunca como HTML (adjunto/visor, SECURITY.md):
//   - reporte enviado (con storage_path): redirige a una URL firmada de corta vida.
//   - sin enviar: render on-the-fly para el preview (no se almacena).
// @react-pdf/renderer necesita el runtime de Node.
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // ═══ ?doc=plan: LA HOJA DEL PLAN, QUE ES EL SEGUNDO DOCUMENTO QUE RECIBE EL PACIENTE ═══
  //
  // Desde el 2026-10-30 el informe NO lleva nada del plan (es transversal a las disciplinas), y desde el
  // 28 el correo adjunta la hoja del plan cuando hay prescripcion. O sea que el paciente recibe DOS
  // documentos, y hasta aqui este preview solo ensenaba uno.
  //
  // ESO ROMPE LA GARANTIA QUE ESTA RUTA AFIRMA de si misma mas abajo ("es el mismo documento que sale"):
  // el profesional aprueba mirando esto. Un preview que ensena la mitad de lo que se envia es peor que
  // ninguno, porque parece completo. Asi que la ruta sirve los dos, y la tarjeta del reporte ofrece los
  // dos enlaces.
  const quierePlan = new URL(request.url).searchParams.get("doc") === "plan";
  const user = await requireUser();
  if (!canManageReports(user)) {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const dispatch = await getReportDispatch(id);
  if (!dispatch) return new NextResponse("Reporte no encontrado", { status: 404 });

  // ═══ LA RAMA DEL PLAN VA ANTES QUE LA DEL INFORME ENVIADO, Y ESTO ERA UN DEFECTO ═══
  //
  // Escrita despues del redirect de abajo, un `?doc=plan` sobre un reporte YA ENVIADO nunca llegaba aqui:
  // salia por la rama de Storage y devolvia el INFORME. O sea que el enlace que dice "Ver la hoja del plan
  // enviada" habria abierto el otro documento, que es la peor forma de fallar porque el PDF se abre y
  // parece correcto. El orden de las dos ramas es lo unico que lo separa.
  if (quierePlan) {
    // LOS BYTES QUE SALIERON, cuando existen, por la misma razon que el informe: la prescripcion esta
    // siempre abierta, asi que re-renderizar el plan de un reporte enviado mostraria OTRO documento
    // afirmando que es el que recibio el paciente. Es la misma eleccion que hace el reenvio.
    const guardado = await downloadPlanPdf(dispatch.patientId, dispatch.reportId);
    let planPdf = guardado;
    if (!planPdf) {
      // SIN COPIA GUARDADA se reconstruye del estado de hoy, que es lo que pasa con los reportes
      // anteriores a que se guardara el adjunto. Entre ensenarle una reconstruccion y no ensenarle nada,
      // el profesional prefiere verla.
      const plan = await getPlanPaciente(dispatch.evaluationId, dispatch.snapshot);
      // SIN PRESCRIPCION NO HAY PLAN, y se dice con un 404 y no con un PDF vacio: el correo tampoco
      // adjunta nada en ese caso, asi que la ausencia coincide con lo que recibe el paciente.
      if (!plan) {
        return new NextResponse("Esta consulta no tiene prescripción emitida", { status: 404 });
      }
      planPdf = await renderPlanPdf(
        plan,
        metaDelPlan({
          patientName: dispatch.patientName,
          documentLabel: dispatch.documentLabel,
          consultationDate: dispatch.consultationDate,
          profesional: dispatch.profesional,
        }),
      );
    }
    return new NextResponse(new Uint8Array(planPdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="plan-${dispatch.reportId}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

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
      profesional: dispatch.profesional,
      reportId: dispatch.reportId,
    },
    {
      mode: "ambos",
      professionalNotes: await ultimaObservacionDeLaConsulta(dispatch.evaluationId),
      bandText: dispatch.patientBandText,
      bandAppointmentDate: dispatch.patientBandAppointmentDate,
      // EL RESTO DEL INFORME, porque el preview tiene que ser el documento que
      // sale. Un preview al que le falta la mitad ensena un documento que el paciente no va a recibir.
      informe: await getInformeDelPaciente(dispatch.evaluationId, dispatch.snapshot),
      serie: await getSerieDelPaciente(dispatch.evaluationId),
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
