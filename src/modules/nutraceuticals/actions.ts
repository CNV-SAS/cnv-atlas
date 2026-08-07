"use server";

import { revalidatePath } from "next/cache";

import { appError, err, ok, type AppError, type Result } from "@/core/errors";
import { getCurrentUser } from "@/modules/auth/session";

import { canLoadOwnStock } from "./policies/can-load-own-stock";
import { canManageCatalog } from "./policies/can-manage-catalog";
import { canRegisterUsage } from "./policies/can-register-usage";
import { canClassifyFaltante, canConfirmFaltante, canResolveSobrante } from "./policies/can-review-faltante";
import * as faltanteService from "./services/faltante-service";
import * as inventoryService from "./services/inventory-service";
import * as service from "./services/nutraceuticals-service";
import {
  classifyFaltanteSchema,
  confirmFaltanteSchema,
  resolveSobranteSchema,
  createNutraceuticalSchema,
  despachoSchema,
  receptionSchema,
  recordCountSchema,
  registerUsageSchema,
  submitJustificationSchema,
  updateNutraceuticalSchema,
  type CreateNutraceuticalInput,
  type NutraceuticalFormState,
  type RegisterUsageInput,
  type UpdateNutraceuticalInput,
} from "./validations";

// Autorizacion comun por capacidad (regla 3). Catalogo = admin; inventario =
// admin/soporte; uso = professional (la RLS acota al profesional del paciente).
async function requireCatalogManager() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: appError("unauthorized", "Inicia sesión.") };
  if (!canManageCatalog(user)) {
    return { user: null, error: appError("forbidden", "No tienes permiso sobre el catalogo.") };
  }
  return { user, error: null as null };
}

async function requireUsageRegistrar() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: appError("unauthorized", "Inicia sesión.") };
  if (!canRegisterUsage(user)) {
    return { user: null, error: appError("forbidden", "No tienes permiso para registrar uso.") };
  }
  return { user, error: null as null };
}

export async function createNutraceuticalAction(
  input: CreateNutraceuticalInput,
): Promise<Result<{ id: string }, AppError>> {
  const { user, error: authzError } = await requireCatalogManager();
  if (authzError) return err(authzError);

  const parsed = createNutraceuticalSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Datos del nutracéutico inválidos."));

  try {
    const created = await service.createNutraceutical(parsed.data, user.organizationId);
    revalidatePath("/nutraceuticos");
    return ok({ id: created.id });
  } catch {
    return err(appError("internal", "No se pudo crear el nutracéutico."));
  }
}

export async function updateNutraceuticalAction(
  input: UpdateNutraceuticalInput,
): Promise<Result<null, AppError>> {
  const { error: authzError } = await requireCatalogManager();
  if (authzError) return err(authzError);

  const parsed = updateNutraceuticalSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Datos del nutracéutico inválidos."));

  try {
    await service.updateNutraceutical(parsed.data);
    revalidatePath("/nutraceuticos");
    return ok(null);
  } catch {
    return err(appError("internal", "No se pudo actualizar el nutracéutico."));
  }
}

// Registro de uso (sin UI en B5; lo consume el flujo de tratamiento en B12).
export async function registerUsageAction(
  input: RegisterUsageInput,
): Promise<Result<{ usageId: string }, AppError>> {
  const { error: authzError } = await requireUsageRegistrar();
  if (authzError) return err(authzError);

  const parsed = registerUsageSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Datos de uso inválidos."));

  try {
    const usage = await service.registerUsage(parsed.data);
    return ok({ usageId: usage.id });
  } catch {
    // La RLS rechaza si el actor no es el profesional del paciente del tratamiento.
    return err(appError("forbidden", "No se pudo registrar el uso para este tratamiento."));
  }
}

// ----- Adaptadores de formulario (useActionState) para la UI de B5.3 -----

// Helpers de FormData: string opcional (vacio -> undefined) y numero opcional.
function optStr(formData: FormData, k: string): string | undefined {
  const v = String(formData.get(k) ?? "").trim();
  return v === "" ? undefined : v;
}
function optNum(formData: FormData, k: string): number | undefined {
  const v = optStr(formData, k);
  return v === undefined ? undefined : Number(v);
}

export async function createNutraceuticalFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const result = await createNutraceuticalAction({
    name: optStr(formData, "name") ?? "",
    description: optStr(formData, "description"),
    unit: optStr(formData, "unit"),
    unitPrice: optNum(formData, "unitPrice"),
  });
  if (!result.ok) return { error: result.error.message, success: null, warning: null };
  return { error: null, success: "Nutracéutico creado.", warning: null };
}

export async function updateNutraceuticalFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const result = await updateNutraceuticalAction({
    id: String(formData.get("id") ?? ""),
    name: optStr(formData, "name") ?? "",
    description: optStr(formData, "description"),
    unit: optStr(formData, "unit"),
    unitPrice: optNum(formData, "unitPrice"),
  });
  if (!result.ok) return { error: result.error.message, success: null, warning: null };
  return { error: null, success: "Nutracéutico actualizado.", warning: null };
}

// Registrar una RECEPCION en el inventario del profesional (Mi inventario, consignacion). Solo el
// profesional (canLoadOwnStock); la RLS acota a que sea su propio inventario.
export async function recordReceptionFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canLoadOwnStock(user)) {
    return { error: "Solo el profesional registra recepciones en su inventario.", success: null, warning: null };
  }
  const parsed = receptionSchema.safeParse({
    nutraceuticalId: String(formData.get("nutraceuticalId") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    lote: optStr(formData, "lote"),
  });
  if (!parsed.success) return { error: "Datos de recepción inválidos.", success: null, warning: null };

  const res = await inventoryService.recordReception({
    userId: user.id,
    nutraceuticalId: parsed.data.nutraceuticalId,
    quantity: parsed.data.quantity,
    lote: parsed.data.lote ?? null,
  });
  if (!res.ok) return { error: res.message ?? "No se pudo registrar la recepción.", success: null, warning: null };
  revalidatePath("/mi-inventario");
  return { error: null, success: "Recepción registrada.", warning: null };
}

// Registrar un DESPACHO (entrega al paciente) desde el panel de tratamiento. Solo el profesional
// (canLoadOwnStock); el service verifica ademas que el tratamiento sea suyo y que el producto sea
// en_consultorio. Si el saldo queda negativo NO se bloquea: se avisa (warning) y la diferencia queda
// visible en Mi inventario. Requiere el evaluationId (hidden) para revalidar la pagina de la evaluacion.
export async function recordDespachoFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canLoadOwnStock(user)) {
    return { error: "Solo el profesional entrega nutracéuticos al paciente.", success: null, warning: null };
  }
  const parsed = despachoSchema.safeParse({
    treatmentId: String(formData.get("treatmentId") ?? ""),
    nutraceuticalId: String(formData.get("nutraceuticalId") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
  });
  if (!parsed.success) return { error: "Datos de la entrega inválidos.", success: null, warning: null };

  const res = await inventoryService.recordDespacho({
    userId: user.id,
    treatmentId: parsed.data.treatmentId,
    nutraceuticalId: parsed.data.nutraceuticalId,
    quantity: parsed.data.quantity,
  });
  if (!res.ok) return { error: res.message ?? "No se pudo registrar la entrega.", success: null, warning: null };

  const evaluationId = optStr(formData, "evaluationId");
  if (evaluationId) revalidatePath(`/evaluaciones/${evaluationId}`);
  revalidatePath("/mi-inventario");

  // Saldo negativo = discrepancia visible: nunca se calla. El aviso confirma la entrega Y la diferencia.
  const stock = res.resultingStock ?? 0;
  if (stock < 0) {
    return {
      error: null,
      success: null,
      warning: `Entrega registrada. Tu inventario de este producto quedo en ${stock}: entregaste mas de lo que tienes cargado. Revisa la diferencia (registra la recepcion que falte o repórtalo en el conteo).`,
    };
  }
  return { error: null, success: `Entrega registrada. Te quedan ${stock} unidades.`, warning: null };
}


// Registrar un CONTEO fisico (T3b-3 ST2, Mi inventario). Solo el profesional (canLoadOwnStock). El conteo
// se registra SIEMPRE (evidencia); si hay faltantes, abre casos. El aviso resume que paso.
export async function recordCountFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canLoadOwnStock(user)) {
    return { error: "Solo el profesional registra el conteo de su inventario.", success: null, warning: null };
  }
  let parsedLines: unknown;
  try {
    parsedLines = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    parsedLines = undefined;
  }
  const parsed = recordCountSchema.safeParse({
    note: optStr(formData, "note"),
    lines: parsedLines,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos del conteo invalidos.", success: null, warning: null };
  }

  const res = await inventoryService.recordOwnCount(
    user.id,
    parsed.data.lines.map((l) => ({ nutraceuticalId: l.nutraceuticalId, lote: l.lote ?? null, physicalQty: l.physicalQty })),
    parsed.data.note ?? null,
  );
  if (!res) return { error: "No tienes un perfil profesional.", success: null, warning: null };

  revalidatePath("/mi-inventario");
  // Si abrio casos, es un aviso (hay faltantes que atender); si no, confirmacion simple.
  if (res.opened.length > 0) {
    const sob = res.sobrantes.length > 0 ? ` Y ${res.sobrantes.length} sobrante(s) por revisar.` : "";
    return {
      error: null,
      success: null,
      warning: `Conteo registrado. Se abrieron ${res.opened.length} caso(s) de faltante (esperan justificación).${sob}`,
    };
  }
  const sob = res.sobrantes.length > 0 ? ` ${res.sobrantes.length} sobrante(s) por revisar.` : "";
  return { error: null, success: `Conteo registrado: todo cuadró.${sob}`, warning: null };
}

// Enviar la JUSTIFICACION de un faltante (T3b-3 ST3). Solo el profesional; el service verifica ademas que
// el caso sea suyo, que este en reportado y dentro del plazo. La referencia es obligatoria (schema).
export async function submitJustificationFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canLoadOwnStock(user)) {
    return { error: "Solo el profesional justifica sus faltantes.", success: null, warning: null };
  }
  const parsed = submitJustificationSchema.safeParse({
    caseId: String(formData.get("caseId") ?? ""),
    category: String(formData.get("category") ?? ""),
    reference: String(formData.get("reference") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos de la justificación invalidos.", success: null, warning: null };
  }
  const res = await faltanteService.submitJustification({
    userId: user.id,
    caseId: parsed.data.caseId,
    category: parsed.data.category,
    reference: parsed.data.reference,
  });
  if (!res.ok) return { error: res.message ?? "No se pudo enviar la justificación.", success: null, warning: null };
  revalidatePath("/mi-inventario");
  return { error: null, success: "Justificación enviada. CNV la revisará.", warning: null };
}

// CNV clasifica un faltante (T3b-3 ST4). Solo admin (canClassifyFaltante). "injustificado" PROPONE, no cobra.
export async function classifyFaltanteFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canClassifyFaltante(user)) {
    return { error: "Solo un administrador clasifica los faltantes.", success: null, warning: null };
  }
  const parsed = classifyFaltanteSchema.safeParse({
    caseId: String(formData.get("caseId") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    reason: optStr(formData, "reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos invalidos.", success: null, warning: null };

  const res = await faltanteService.classifyFaltante({
    userId: user.id,
    caseId: parsed.data.caseId,
    decision: parsed.data.decision,
    reason: parsed.data.reason ?? null,
  });
  if (!res.ok) return { error: res.message ?? "No se pudo clasificar.", success: null, warning: null };
  revalidatePath("/faltantes");
  const msg =
    parsed.data.decision === "injustificado"
      ? "Propuesto como injustificado. Espera la confirmación de dirección para que el cargo aplique."
      : "Caso cerrado sin cargo.";
  return { error: null, success: msg, warning: null };
}

// Direccion confirma o rechaza la propuesta de injustificado (T3b-3 ST4). Solo direccion. Confirmar
// materializa el cargo; rechazar lo cierra sin cargo.
export async function confirmFaltanteFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canConfirmFaltante(user)) {
    return { error: "Solo dirección confirma un cargo por faltante.", success: null, warning: null };
  }
  const parsed = confirmFaltanteSchema.safeParse({
    caseId: String(formData.get("caseId") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    reason: optStr(formData, "reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos invalidos.", success: null, warning: null };

  const res = await faltanteService.confirmFaltante({
    userId: user.id,
    caseId: parsed.data.caseId,
    decision: parsed.data.decision,
    reason: parsed.data.reason ?? null,
  });
  if (!res.ok) return { error: res.message ?? "No se pudo confirmar.", success: null, warning: null };
  revalidatePath("/faltantes");
  return {
    error: null,
    success: parsed.data.decision === "confirmar" ? "Cargo confirmado: entra en la liquidación del período." : "Propuesta rechazada: el caso queda sin cargo.",
    warning: null,
  };
}

// Resolver un SOBRANTE (T3b-3 ST5). Solo admin. Motivo obligatorio; sube el saldo con una conciliacion.
export async function resolveSobranteFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canResolveSobrante(user)) {
    return { error: "Solo un administrador resuelve los sobrantes.", success: null, warning: null };
  }
  const parsed = resolveSobranteSchema.safeParse({
    countLineId: String(formData.get("countLineId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos invalidos.", success: null, warning: null };

  const res = await faltanteService.resolveSobrante({ userId: user.id, countLineId: parsed.data.countLineId, reason: parsed.data.reason });
  if (!res.ok) return { error: res.message ?? "No se pudo resolver el sobrante.", success: null, warning: null };
  revalidatePath("/faltantes");
  return { error: null, success: "Sobrante resuelto: el saldo se ajustó con el motivo registrado.", warning: null };
}
