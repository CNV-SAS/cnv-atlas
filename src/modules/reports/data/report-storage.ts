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

// URL firmada de corta vida para ver el PDF internamente (el route handler valida
// ownership antes de pedirla). El PDF se sirve como adjunto/visor, nunca como HTML.
export async function createSignedReportUrl(
  path: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
