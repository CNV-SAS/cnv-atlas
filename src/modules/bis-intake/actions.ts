"use server";

import { revalidatePath } from "next/cache";
import { z, type ZodError } from "zod";

import { appError, err, ok, type Result } from "@/core/errors";
import { getClientIp } from "@/core/http/client-ip";
import { requireUser } from "@/modules/auth/session";
import { getEvaluationOwnership } from "@/modules/evaluations/data/evaluations-repository";

import {
  getActiveBisConditionCatalog,
  getEvaluationPatientSex,
} from "./data/bis-conditions-reader";
import {
  BisCorrectionError,
  clearBisCorrection,
  correctBisValue,
} from "./data/bis-correction-writer";
import { CORREGIBLES } from "./services/medidas-corregibles";
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
    return err(appError("validation", "Datos inválidos.", zodFields(parsed.error)));
  }
  const input = parsed.data;

  // Ownership bajo RLS: la sesion debe poder leer la evaluacion (su paciente o admin).
  const ownership = await getEvaluationOwnership(input.evaluationId);
  if (!ownership) return err(appError("not_found", "Evaluación no encontrada."));
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

// CORRECCION DE UNA MEDIDA ANTROPOMETRICA (2026-08-27). Ver bis-correction-writer y la migracion 0089.
//
// Estado de formulario, no `Result`: lo consume un formulario del panel, como el resto de la pantalla de
// evaluacion. El gate de "antes del diagnostico" NO vive aqui: vive dentro de la transaccion del writer,
// porque un boton oculto no es un candado.
export type BisCorrectionState = { error: string | null; success: string | null; warning: string | null };

const correctionSchema = z.object({
  evaluationId: z.guid(),
  variableName: z.enum(CORREGIBLES),
  // Se acepta coma decimal, que es como se escribe aqui. Tope alto y bajo para atrapar el dedo gordo:
  // una talla de 1770 o un peso de 8 no son correcciones, son errores de tecleo.
  value: z.coerce.number().positive().max(400),
});

export async function correctBisValueAction(
  _prev: BisCorrectionState,
  form: FormData,
): Promise<BisCorrectionState> {
  const user = await requireUser();
  if (!canCaptureBisConditions(user)) return { error: "No autorizado.", success: null, warning: null };

  const parsed = correctionSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    variableName: form.get("variableName"),
    value: String(form.get("value") ?? "").replace(",", "."),
  });
  if (!parsed.success) return { error: "Valor inválido.", success: null, warning: null };

  const ownership = await getEvaluationOwnership(parsed.data.evaluationId);
  if (!ownership) return { error: "Evaluación no encontrada.", success: null, warning: null };

  try {
    // El mensaje DERIVA de lo que el writer hizo. Decir "corregida" cuando no se escribio nada seria
    // afirmar un estado sin derivarlo, y ademas le haria creer al profesional que dejo un registro.
    const hecho = await correctBisValue({
      ...parsed.data,
      actorId: user.id,
      actorEmail: user.email,
      ip: await getClientIp(),
    });
    revalidatePath(`/evaluaciones/${parsed.data.evaluationId}`);
    return {
      error: null,
      success:
        hecho === "corregida"
          ? "Medida corregida. Queda registrado."
          : hecho === "restaurada"
            ? "Se restauró el valor del equipo."
            : "No había nada que cambiar: el valor ya era ese.",
      warning: null,
    };
  } catch (e) {
    if (e instanceof BisCorrectionError) return { error: e.message, success: null, warning: null };
    throw e;
  }
}

export async function clearBisCorrectionAction(
  _prev: BisCorrectionState,
  form: FormData,
): Promise<BisCorrectionState> {
  const user = await requireUser();
  if (!canCaptureBisConditions(user)) return { error: "No autorizado.", success: null, warning: null };

  const parsed = z
    .object({ evaluationId: z.guid(), variableName: z.enum(CORREGIBLES) })
    .safeParse({
      evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
      variableName: form.get("variableName"),
    });
  if (!parsed.success) return { error: "Datos inválidos.", success: null, warning: null };

  try {
    await clearBisCorrection({
      ...parsed.data,
      actorId: user.id,
      actorEmail: user.email,
      ip: await getClientIp(),
    });
  } catch (e) {
    if (e instanceof BisCorrectionError) return { error: e.message, success: null, warning: null };
    throw e;
  }
  revalidatePath(`/evaluaciones/${parsed.data.evaluationId}`);
  return { error: null, success: "Se restauró el valor del equipo.", warning: null };
}
