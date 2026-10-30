import { renderToBuffer } from "@react-pdf/renderer";

import type { EngineOutput } from "@/clinical-engine";

import type { PuntoDelPaciente } from "../data/serie-del-paciente";
import type { HistoriaClinicaDoc, InformeDelPaciente, PlanPaciente } from "../data/reports-view-types";
import { HistoriaClinicaDocument } from "../pdf/hc-document";
import { formatDate } from "@/lib/format/date";

import { PlanDocument, type PlanMeta } from "../pdf/plan-document";
import { ReportDocument, type ReportMeta, type SendMode } from "../pdf/report-document";

export type RenderReportOptions = {
  mode?: SendMode; // que incluye el PDF (default 'atlas')
  professionalNotes?: string | null;
  bandText?: string | null; // P0 Parte 2 (P5): texto de la banda de cambio para el paciente, o null
  bandAppointmentDate?: string | null;
  /** Rutas, suplementos, remisiones y seguimiento: lo que hace de esto un informe y no solo un plan. */
  informe?: InformeDelPaciente | null;
  /** La trayectoria del paciente, para la grafica. Vacia = no hay dos mediciones que comparar. */
  serie?: PuntoDelPaciente[];
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
      informe={options.informe}
      serie={options.serie}
    />,
  );
}

/**
 * LA CABECERA DEL PDF DEL PLAN, en un solo sitio.
 *
 * Vivia dentro de `send-report` cuando el envio era el unico que renderizaba el plan. Desde que el
 * preview tambien lo sirve (`/reportes/[id]/pdf?doc=plan`, 2026-10-30) son DOS llamadores, y dos copias
 * de una cabecera divergen por donde nadie mira: el profesional aprobaria un documento con otra fecha o
 * otro profesional en el encabezado que el que recibe el paciente. Es el mismo defecto que ya costo seis
 * desfases entre el informe y la hoja del plan.
 */
export type DatosDelPlan = {
  patientName: string;
  documentLabel: string;
  consultationDate: string;
  profesional: { nombre: string; profesion: string | null } | null;
};

export function metaDelPlan(d: DatosDelPlan): PlanMeta {
  return {
    patientName: d.patientName || "Paciente",
    documentLabel: d.documentLabel,
    consultationDate: formatDate(d.consultationDate),
    profesional: d.profesional,
  };
}

/**
 * EL PLAN A PDF, para adjuntarlo al correo del paciente (Santiago, 2026-10-28).
 *
 * Mismo patron que los otros dos: puro respecto a BD y secretos, recibe el plan ya armado por
 * `getPlanPaciente` (el MISMO lector que la hoja de pantalla) y devuelve los bytes.
 */
export function renderPlanPdf(plan: PlanPaciente, meta: PlanMeta): Promise<Buffer> {
  return renderToBuffer(<PlanDocument plan={plan} meta={meta} />);
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
