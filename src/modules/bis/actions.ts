"use server";

import { revalidatePath } from "next/cache";

import { getClientIp } from "@/core/http/client-ip";
import { limitImportByUser } from "@/core/rate-limit";
import { getEvaluationOwnership } from "@/modules/evaluations/data/evaluations-repository";
import { requireUser } from "@/modules/auth/session";

import { canImportBis } from "./policies/can-import-bis";
import { importBisMeasurement } from "./services/bis-import";

// Estado del formulario de import (useActionState). Incluye la forma de
// FormToastState (error/success/warning) para que el componente dispare el toast con
// useFormToast; ademas lleva el detalle por variable y el resultado del import.
export type ImportBisState = {
  error: string | null;
  success: string | null;
  warning: string | null;
  fields: Record<string, string> | null;
  imported: boolean;
  valueCount: number | null;
};

// Tope de tamano y MIME aceptados (SECURITY.md: allowlist + tope). El export real
// pesa pocos KB; 5 MB es muy holgado. La frontera de confianza real es el parser.
const MAX_BYTES = 5 * 1024 * 1024;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function isAllowedXlsx(file: File): boolean {
  const okName = file.name.toLowerCase().endsWith(".xlsx");
  // Algunos navegadores no envian el MIME del xlsx; aceptamos el oficial, el generico
  // y vacio, apoyandonos en la extension y, sobre todo, en el parser.
  const okType = file.type === XLSX_MIME || file.type === "application/octet-stream" || file.type === "";
  return okName && okType;
}

// Server action del import BIS. Orden: auth -> policy (rol) -> rate limit por usuario
// -> ownership bajo RLS -> estado in_progress -> validacion de archivo -> orquestacion.
// La autorizacion fina (que la evaluacion sea de su paciente) la impone la RLS.
export async function importBisAction(
  _prev: ImportBisState,
  form: FormData,
): Promise<ImportBisState> {
  const fail = (error: string, fields: Record<string, string> | null = null): ImportBisState => ({
    error,
    success: null,
    warning: null,
    fields,
    imported: false,
    valueCount: null,
  });

  const user = await requireUser();
  if (!canImportBis(user)) return fail("No autorizado.");

  const evaluationId = (form.get("evaluationId") as string | null)?.trim() ?? "";
  if (!evaluationId) return fail("Evaluacion invalida.");

  // Rate limit por usuario (acotado por hora) antes de leer el archivo.
  const rl = await limitImportByUser(user.id);
  if (!rl.success) return fail("Has hecho demasiados imports. Espera unos minutos.");

  // Ownership bajo RLS: la sesion debe poder leer la evaluacion (su paciente o admin).
  const ownership = await getEvaluationOwnership(evaluationId);
  if (!ownership) return fail("Evaluacion no encontrada.");
  // El BIS se importa despues de confirmar la identidad (draft -> in_progress).
  if (ownership.status !== "in_progress") {
    return fail("La evaluacion no esta lista para importar BIS. Confirma la identidad primero.");
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Adjunta el archivo XLSX exportado de Biody Manager.");
  }
  if (file.size > MAX_BYTES) {
    return fail("El archivo supera el tamano maximo permitido (5 MB).");
  }
  if (!isAllowedXlsx(file)) {
    return fail("El archivo debe ser un XLSX exportado de Biody Manager.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ip = await getClientIp();
  const result = await importBisMeasurement({
    buffer,
    evaluationId,
    deviceId: null, // enlace de equipo diferido (B8 minimo)
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });

  if (!result.ok) return fail(result.error.message, result.error.fields ?? null);

  revalidatePath("/evaluaciones");
  return {
    error: null,
    success: `Medicion BIS importada (${result.value.valueCount} variables).`,
    warning: null,
    fields: null,
    imported: true,
    valueCount: result.value.valueCount,
  };
}
