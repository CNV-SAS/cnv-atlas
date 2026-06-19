"use server";

import { revalidatePath } from "next/cache";

import { appError, err, ok, type AppError, type Result } from "@/core/errors";
import { getCurrentUser } from "@/modules/auth/session";

import { canManageCatalog } from "./policies/can-manage-catalog";
import { canManageInventory } from "./policies/can-manage-inventory";
import { canRegisterUsage } from "./policies/can-register-usage";
import * as service from "./services/nutraceuticals-service";
import {
  createNutraceuticalSchema,
  registerUsageSchema,
  setStockSchema,
  updateNutraceuticalSchema,
  type CreateNutraceuticalInput,
  type NutraceuticalFormState,
  type RegisterUsageInput,
  type SetStockInput,
  type UpdateNutraceuticalInput,
} from "./validations";

// Autorizacion comun por capacidad (regla 3). Catalogo = admin; inventario =
// admin/soporte; uso = professional (la RLS acota al profesional del paciente).
async function requireCatalogManager() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: appError("unauthorized", "Inicia sesion.") };
  if (!canManageCatalog(user)) {
    return { user: null, error: appError("forbidden", "No tienes permiso sobre el catalogo.") };
  }
  return { user, error: null as null };
}

async function requireInventoryManager() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: appError("unauthorized", "Inicia sesion.") };
  if (!canManageInventory(user)) {
    return { user: null, error: appError("forbidden", "No tienes permiso sobre el inventario.") };
  }
  return { user, error: null as null };
}

async function requireUsageRegistrar() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: appError("unauthorized", "Inicia sesion.") };
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
  if (!parsed.success) return err(appError("validation", "Datos del nutraceutico invalidos."));

  try {
    const created = await service.createNutraceutical(parsed.data, user.organizationId);
    revalidatePath("/nutraceuticos");
    return ok({ id: created.id });
  } catch {
    return err(appError("internal", "No se pudo crear el nutraceutico."));
  }
}

export async function updateNutraceuticalAction(
  input: UpdateNutraceuticalInput,
): Promise<Result<null, AppError>> {
  const { error: authzError } = await requireCatalogManager();
  if (authzError) return err(authzError);

  const parsed = updateNutraceuticalSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Datos del nutraceutico invalidos."));

  try {
    await service.updateNutraceutical(parsed.data);
    revalidatePath("/nutraceuticos");
    return ok(null);
  } catch {
    return err(appError("internal", "No se pudo actualizar el nutraceutico."));
  }
}

export async function setStockAction(input: SetStockInput): Promise<Result<null, AppError>> {
  const { error: authzError } = await requireInventoryManager();
  if (authzError) return err(authzError);

  const parsed = setStockSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Cantidad de stock invalida."));

  try {
    await service.setStock(parsed.data);
    revalidatePath("/nutraceuticos");
    return ok(null);
  } catch {
    return err(appError("internal", "No se pudo ajustar el stock."));
  }
}

// Registro de uso (sin UI en B5; lo consume el flujo de tratamiento en B12).
export async function registerUsageAction(
  input: RegisterUsageInput,
): Promise<Result<{ usageId: string }, AppError>> {
  const { error: authzError } = await requireUsageRegistrar();
  if (authzError) return err(authzError);

  const parsed = registerUsageSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Datos de uso invalidos."));

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
  return { error: null, success: "Nutraceutico creado.", warning: null };
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
  return { error: null, success: "Nutraceutico actualizado.", warning: null };
}

export async function setStockFormAction(
  _prev: NutraceuticalFormState,
  formData: FormData,
): Promise<NutraceuticalFormState> {
  const result = await setStockAction({
    nutraceuticalId: String(formData.get("nutraceuticalId") ?? ""),
    stockQuantity: Number(String(formData.get("stockQuantity") ?? "")),
  });
  if (!result.ok) return { error: result.error.message, success: null, warning: null };
  return { error: null, success: "Stock actualizado.", warning: null };
}
