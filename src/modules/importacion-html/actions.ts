"use server";

import { reportServerError } from "@/lib/observability/report-error";
import { requireUser } from "@/modules/auth/session";

import { canImportFromHtml } from "./policies/can-import-from-html";
import { revisarArchivo, type ResultadoDeRevision } from "./services/revisar-archivo";

// La revision de un archivo exportado del HTML (sesion 3). Orden: auth -> policy -> servicio. Solo lee.
export type RevisionState = { error: string | null; resultado: ResultadoDeRevision | null };

export async function revisarArchivoAction(_prev: RevisionState, form: FormData): Promise<RevisionState> {
  const user = await requireUser();
  if (!canImportFromHtml(user)) return { error: "No autorizado.", resultado: null };
  const archivo = form.get("archivo");
  if (!(archivo instanceof File)) return { error: "Adjunta el archivo que exportó el profesional.", resultado: null };
  try {
    const r = await revisarArchivo(archivo);
    return r.ok ? { error: null, resultado: r.value } : { error: r.error.message, resultado: null };
  } catch (e) {
    reportServerError("revisarArchivoAction", e);
    return { error: "No se pudo revisar el archivo. Intenta de nuevo.", resultado: null };
  }
}
