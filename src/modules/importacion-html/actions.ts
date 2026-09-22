"use server";

import { revalidatePath } from "next/cache";

import { getClientIp } from "@/core/http/client-ip";
import { reportServerError } from "@/lib/observability/report-error";
import { requireUser } from "@/modules/auth/session";

import { canImportFromHtml } from "./policies/can-import-from-html";
import { LoteNoReversibleError, revertirLote } from "./data/importar-lote-writer";
import { importarArchivo } from "./services/importar-archivo";
import { revisarArchivo, type ResultadoDeRevision } from "./services/revisar-archivo";

// La revision de un archivo exportado del HTML (sesion 3). Orden: auth -> policy -> servicio. Solo lee.
export type RevisionState = {
  error: string | null;
  resultado: ResultadoDeRevision | null;
  resumen: ImportacionResumen | null;
};

export type ImportacionResumen = {
  batchId: string;
  pacientesCreados: number;
  pacientesExistentes: number;
  consultasImportadas: number;
  consultasOmitidas: { documento: string; fecha: string }[];
};

/**
 * UN SOLO ACTION PARA EL FORMULARIO, que despacha por el boton pulsado. El archivo vive en un unico
 * formulario (un campo de archivo no se puede compartir entre dos), asi que "Revisar" e "Importar" son dos
 * botones del mismo. El `name`/`value` del boton viaja porque `enviarSinReset` pasa el submitter.
 */
export async function revisarOImportarAction(prev: RevisionState, form: FormData): Promise<RevisionState> {
  return String(form.get("intencion") ?? "revisar") === "importar"
    ? importarArchivoAction(prev, form)
    : revisarArchivoAction(prev, form);
}

export async function revisarArchivoAction(_prev: RevisionState, form: FormData): Promise<RevisionState> {
  const user = await requireUser();
  if (!canImportFromHtml(user)) return { error: "No autorizado.", resultado: null, resumen: null };
  const archivo = form.get("archivo");
  if (!(archivo instanceof File)) {
    return { error: "Adjunta el archivo que exportó el profesional.", resultado: null, resumen: null };
  }
  try {
    const r = await revisarArchivo(archivo);
    return r.ok
      ? { error: null, resultado: r.value, resumen: null }
      : { error: r.error.message, resultado: null, resumen: null };
  } catch (e) {
    reportServerError("revisarArchivoAction", e);
    return { error: "No se pudo revisar el archivo. Intenta de nuevo.", resultado: null, resumen: null };
  }
}

// ── LA IMPORTACION (sesion 4) ─────────────────────────────────────────────────────────────────────────
// Escribe datos clinicos, asi que la cuenta de destino la elige el admin y queda auditada por lote.
export async function importarArchivoAction(_prev: RevisionState, form: FormData): Promise<RevisionState> {
  const user = await requireUser();
  if (!canImportFromHtml(user)) return { error: "No autorizado.", resultado: null, resumen: null };
  const archivo = form.get("archivo");
  const professionalId = String(form.get("professionalId") ?? "");
  if (!(archivo instanceof File)) return { error: "Adjunta el archivo que exportó el profesional.", resultado: null, resumen: null };
  if (!professionalId) return { error: "Elige la cuenta del profesional a la que se importa.", resultado: null, resumen: null };
  try {
    const ip = await getClientIp();
    const r = await importarArchivo({
      archivo,
      professionalId,
      actorId: user.id,
      actorEmail: user.email,
      ip: ip === "unknown" ? null : ip,
    });
    if (!r.ok) return { error: r.error.message, resultado: null, resumen: null };
    revalidatePath("/pacientes");
    return { error: null, resultado: null, resumen: r.value };
  } catch (e) {
    reportServerError("importarArchivoAction", e);
    return { error: "No se pudo importar el archivo. No se guardó nada.", resultado: null, resumen: null };
  }
}

/** Deshacer un lote: retira lo que escribio. No se puede si alguna consulta ya tiene diagnostico. */
export type DeshacerState = { error: string | null; mensaje: string | null };

export async function deshacerLoteAction(_prev: DeshacerState, form: FormData): Promise<DeshacerState> {
  const user = await requireUser();
  if (!canImportFromHtml(user)) return { error: "No autorizado.", mensaje: null };
  const batchId = String(form.get("batchId") ?? "");
  if (!batchId) return { error: "Falta el lote.", mensaje: null };
  try {
    const ip = await getClientIp();
    const r = await revertirLote({
      batchId,
      actorId: user.id,
      actorEmail: user.email,
      ip: ip === "unknown" ? null : ip,
    });
    revalidatePath("/pacientes");
    return {
      error: null,
      mensaje: `Lote deshecho: se retiraron ${r.consultasRetiradas} consultas y ${r.pacientesBorrados} pacientes que había creado.`,
    };
  } catch (e) {
    if (e instanceof LoteNoReversibleError) return { error: e.message, mensaje: null };
    reportServerError("deshacerLoteAction", e);
    return { error: "No se pudo deshacer el lote.", mensaje: null };
  }
}
