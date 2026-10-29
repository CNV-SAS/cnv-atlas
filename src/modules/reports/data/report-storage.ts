import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Subida del PDF y URL firmada en el bucket privado patient-reports. Se usa SERVICE
// ROLE a proposito: el diseno de Storage (migracion 0004) no da policy de escritura a
// authenticated (los PDFs los genera el sistema), y el acceso del profesional es por
// URL firmada validando ownership antes. El path lleva el patient_id, que es donde se
// valida is_patient_professional en el route handler de descarga.

const BUCKET = "patient-reports";

function reportPath(patientId: string, reportId: string): string {
  return `${patientId}/${reportId}.pdf`;
}

// ═══ EL PLAN VIAJA EN SU PROPIO OBJETO, al lado del informe (Santiago, 2026-10-28) ═══
//
// Desde que el correo adjunta tambien la hoja del plan, el reenvio tiene el mismo problema que ya resolvio
// el informe: la prescripcion esta SIEMPRE ABIERTA (2026-09-09), asi que entre el envio y el reenvio el
// plan puede haber cambiado, y "te reenviamos el mismo documento" habria dejado de ser cierto para el
// segundo adjunto. Se guardan los bytes que salieron, igual que los del informe.
//
// SIN MIGRACION: mismo bucket, mismo prefijo de paciente (que es donde el route handler valida ownership),
// con el sufijo del documento. Si manana hay un tercer documento, sigue el mismo patron.
function planPath(patientId: string, reportId: string): string {
  return `${patientId}/${reportId}-plan.pdf`;
}

export async function uploadPlanPdf(
  patientId: string,
  reportId: string,
  pdf: Buffer,
): Promise<{ path: string } | null> {
  const supabase = createSupabaseAdminClient();
  const path = planPath(patientId, reportId);
  const { error } = await supabase.storage.from(BUCKET).upload(path, pdf, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) return null;
  return { path };
}

/** Los bytes del plan que SE ENVIO, o null si ese reporte es anterior a que se guardara. */
export async function downloadPlanPdf(patientId: string, reportId: string): Promise<Buffer | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(planPath(patientId, reportId));
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

// Sube (o reemplaza) el PDF del reporte. upsert es seguro: el snapshot es inmutable, asi
// que el PDF de un reporte es deterministico; reenviar regenera el mismo objeto.
export async function uploadReportPdf(
  patientId: string,
  reportId: string,
  pdf: Buffer,
): Promise<{ path: string } | null> {
  const supabase = createSupabaseAdminClient();
  const path = reportPath(patientId, reportId);
  const { error } = await supabase.storage.from(BUCKET).upload(path, pdf, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) return null;
  return { path };
}

// Descarga los BYTES del PDF (service role). El route handler los TRANSMITE por nuestra ruta (que valida
// ownership), en vez de redirigir a una URL firmada de Storage: una URL firmada es un token al portador
// (funciona sin sesion durante su TTL) y, si se comparte, expone el reporte. Transmitiendo, el cliente solo
// ve /reportes/[id]/pdf, siempre protegido; la URL de Storage nunca sale del servidor.
export async function downloadReportPdf(path: string): Promise<Buffer | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
