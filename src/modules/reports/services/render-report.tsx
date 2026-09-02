import { renderToBuffer } from "@react-pdf/renderer";

import type { EngineOutput } from "@/clinical-engine";

import type { HistoriaClinicaDoc, PlanPaciente } from "../data/reports-view-types";
import { HistoriaClinicaDocument } from "../pdf/hc-document";
import { ReportDocument, type ReportMeta, type SendMode } from "../pdf/report-document";

export type RenderReportOptions = {
  mode?: SendMode; // que incluye el PDF (default 'atlas')
  professionalNotes?: string | null;
  bandText?: string | null; // P0 Parte 2 (P5): texto de la banda de cambio para el paciente, o null
  bandAppointmentDate?: string | null;
  /** El plan del paciente (Gildardo §7.1). null = la evaluacion no tiene tratamiento con protocolo. */
  plan?: PlanPaciente | null; // §6: fecha de la próxima cita (solo para el "empeoró" confirmado)
};

// Renderiza el reporte a un Buffer PDF en el servidor (Node). Puro respecto a BD y
// secretos: recibe el snapshot (inmutable), los metadatos y el modo/notas, devuelve los
// bytes. Se usa tanto para el preview on-the-fly como para el adjunto del envio.
export function renderReportPdf(
  snapshot: EngineOutput,
  meta: ReportMeta,
  options: RenderReportOptions = {},
): Promise<Buffer> {
  return renderToBuffer(
    <ReportDocument
      snapshot={snapshot}
      meta={meta}
      mode={options.mode}
      professionalNotes={options.professionalNotes}
      bandText={options.bandText}
      bandAppointmentDate={options.bandAppointmentDate}
      plan={options.plan}
    />,
  );
}

// LA HISTORIA CLINICA A PDF. Mismo patron que el reporte y por la misma razon: puro respecto a BD y
// secretos, recibe el documento ya armado y devuelve los bytes.
//
// EL DOCUMENTO LLEGA COMPUESTO, no se compone aqui: lo arma `getHistoriaClinicaDoc`, que llama a los
// MISMOS lectores que la pantalla y a la MISMA composicion. Es la condicion que hizo aceptable portarla a
// `@react-pdf` en vez de renderizar la pantalla con un navegador sin interfaz.
export function renderHistoriaClinicaPdf(hc: HistoriaClinicaDoc): Promise<Buffer> {
  return renderToBuffer(<HistoriaClinicaDocument hc={hc} />);
}
