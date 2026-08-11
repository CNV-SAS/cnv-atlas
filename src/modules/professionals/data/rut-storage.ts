import "server-only";

import { randomUUID } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Storage del RUT del integrante en el bucket privado professional-documents. SERVICE ROLE a proposito
// (mismo diseno que report-storage): el bucket no da policy a authenticated; el acceso se controla en el
// route handler (valida pertenencia o rol verificador) y se sirve por URL firmada de corta vida. La ruta
// lleva el professional_id + un id aleatorio, asi no se adivina y cada subida es un objeto NUEVO.

const BUCKET = "professional-documents";

// Un RUD actualizado NO pisa al anterior: la ruta lleva un uuid unico por subida, asi el viejo se conserva
// (la clasificacion vieja se hizo sobre ese documento: es rastro). rut_path apunta al vigente; los viejos
// quedan en el bucket. upsert:false refuerza que nunca se sobreescribe.
function rutPath(professionalId: string): string {
  return `${professionalId}/${randomUUID()}.pdf`;
}

// Valida que el archivo sea un PDF DE VERDAD (magic bytes %PDF-), no solo la extension: alguien va a subir
// una foto/captura. Decision: PDF unicamente (el RUT de la DIAN es un PDF); una imagen no es el documento.
export function isPdfBuffer(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-";
}

export async function uploadRutPdf(
  professionalId: string,
  pdf: Buffer,
): Promise<{ path: string } | null> {
  const supabase = createSupabaseAdminClient();
  const path = rutPath(professionalId);
  const { error } = await supabase.storage.from(BUCKET).upload(path, pdf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) return null;
  return { path };
}

// Descarga los BYTES del RUT (service role). El route handler los TRANSMITE por nuestra propia ruta (que
// exige sesion), en vez de redirigir a una URL firmada de Storage: una URL firmada es un token al portador
// (funciona sin sesion durante su TTL), y si se comparte queda expuesta. Transmitiendo, el cliente solo ve
// /rut/[id], que siempre pasa por el proxy + requireUser; la URL de Storage nunca sale del servidor.
export async function downloadRutPdf(path: string): Promise<Buffer | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

// Ruta vigente del RUT de un profesional (para el route handler). Service role: el acceso ya se valido
// app-side. null si no tiene RUT subido.
export async function getRutPath(professionalId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("professional_profiles")
    .select("rut_path")
    .eq("id", professionalId)
    .maybeSingle();
  if (error) throw new Error(`rut-storage: getRutPath: ${error.message}`);
  return data?.rut_path ?? null;
}
