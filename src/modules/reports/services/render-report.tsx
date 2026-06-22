import { renderToBuffer } from "@react-pdf/renderer";

import type { EngineOutput } from "@/clinical-engine";

import { ReportDocument, type ReportMeta } from "../pdf/report-document";

// Renderiza el reporte a un Buffer PDF en el servidor (Node). Puro respecto a BD y
// secretos: recibe el snapshot (inmutable) y los metadatos, devuelve los bytes. Se usa
// tanto para el preview on-the-fly como para el adjunto del envio.
export function renderReportPdf(snapshot: EngineOutput, meta: ReportMeta): Promise<Buffer> {
  return renderToBuffer(<ReportDocument snapshot={snapshot} meta={meta} />);
}
