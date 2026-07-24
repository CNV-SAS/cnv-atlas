"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { appError, err, ok, type Result } from "@/core/errors";
import { getClientIp } from "@/core/http/client-ip";
import { requireUser } from "@/modules/auth/session";
import { getEvaluationOwnership } from "@/modules/evaluations/data/evaluations-repository";

import {
  getActiveBisConditionCatalog,
  getEvaluationPatientSex,
} from "./data/bis-conditions-reader";
import { writeBisConditionsIntake } from "./data/bis-intake-writer";
import { canCaptureBisConditions } from "./policies/can-capture-bis-conditions";
import { saveBisConditionsSchema, validateBisConditionsCapture } from "./validations";

// Resultado de la captura para la UI: si quedo contraindicada (bloquea el import), que
// advertencias se reconocieron, y si habia una medicion previa pese a la contraindicacion.
export type SaveBisConditionsResult = {
  contraindicated: boolean;
  warnings: string[];
  existingBisWarning: boolean;
};

function zodFields(e: ZodError): Record<string, string> {
  const f: Record<string, string> = {};
  for (const issue of e.issues) f[issue.path.join(".") || "_"] = issue.message;
  return f;
}

// Server action de la captura de condiciones BIS. Orden: auth -> policy (rol) -> Zod (forma) ->
// ownership bajo RLS -> catalogo activo -> validacion semantica -> escritura transaccional + audit.
// No hace throw para errores esperables (Result). La autorizacion fina la impone la RLS.
export async function saveBisConditionsAction(
  rawInput: unknown,
): Promise<Result<SaveBisConditionsResult>> {
  const user = await requireUser();
  if (!canCaptureBisConditions(user)) return err(appError("forbidden", "No autorizado."));

  const parsed = saveBisConditionsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(appError("validation", "Datos invalidos.", zodFields(parsed.error)));
  }
  const input = parsed.data;

  // Ownership bajo RLS: la sesion debe poder leer la evaluacion (su paciente o admin).
  const ownership = await getEvaluationOwnership(input.evaluationId);
  if (!ownership) return err(appError("not_found", "Evaluacion no encontrada."));
  // Las condiciones se llenan en consulta, con la identidad ya confirmada (draft -> in_progress).
  if (ownership.status !== "in_progress") {
    return err(appError("conflict", "Confirma la identidad del paciente antes de capturar las condiciones."));
  }

  const [catalog, sex] = await Promise.all([
    getActiveBisConditionCatalog(),
    getEvaluationPatientSex(input.evaluationId),
  ]);
  if (!catalog) return err(appError("internal", "No hay un catalogo de condiciones BIS activo."));

  // La obligatoriedad de las condiciones femeninas depende del sexo (autoritativo en el server).
  const validated = validateBisConditionsCapture(
    catalog,
    input,
    new Date().toISOString(),
    sex === "F",
  );
  if (!validated.ok) return validated;

  const ip = await getClientIp();
  const written = await writeBisConditionsIntake({
    evaluationId: input.evaluationId,
    versionId: catalog.versionId,
    answers: validated.value.answers,
    contraindicated: validated.value.contraindicated,
    weightGoalKg: input.weightGoalKg ?? null,
    gripStrengthKg: input.gripStrengthKg ?? null,
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });

  // La composicion y el gate del import viven en la vista de la evaluacion: refrescar.
  revalidatePath("/evaluaciones/[id]", "page");
  return ok({
    contraindicated: validated.value.contraindicated,
    warnings: validated.value.warnings,
    existingBisWarning: written.existingMeasurementDespiteContraindication,
  });
}
