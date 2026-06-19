"use server";

import { revalidatePath } from "next/cache";

import { appError, err, ok, type AppError, type Result } from "@/core/errors";
import { getCurrentUser } from "@/modules/auth/session";

import { canManageComodato } from "./policies/can-manage-comodato";
import * as service from "./services/comodato-service";
import {
  assignComodatoSchema,
  createDeviceSchema,
  returnComodatoSchema,
  updateDeviceStatusSchema,
  type AssignComodatoInput,
  type ComodatoFormState,
  type CreateDeviceInput,
  type ReturnComodatoInput,
  type UpdateDeviceStatusInput,
} from "./validations";

// Autorizacion comun: sesion + policy (regla 3). La gestion de comodato es admin.
async function requireManager() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: appError("unauthorized", "Inicia sesion.") };
  if (!canManageComodato(user)) {
    return { user: null, error: appError("forbidden", "No tienes permiso para gestionar comodato.") };
  }
  return { user, error: null as null };
}

// Postgres lanza violacion de unicidad si asset_code/serial/system_email se repiten.
function isUniqueViolation(e: unknown): boolean {
  const m = e instanceof Error ? e.message.toLowerCase() : "";
  return m.includes("duplicate") || m.includes("unique");
}

export async function createDeviceAction(
  input: CreateDeviceInput,
): Promise<Result<{ deviceId: string }, AppError>> {
  const { user, error: authzError } = await requireManager();
  if (authzError) return err(authzError);

  const parsed = createDeviceSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Datos del equipo invalidos."));

  try {
    const device = await service.createDevice(parsed.data, user.organizationId);
    revalidatePath("/comodato");
    return ok({ deviceId: device.id });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return err(
        appError("conflict", "Ya existe un equipo con ese codigo, serial o correo de sistema."),
      );
    }
    return err(appError("internal", "No se pudo crear el equipo."));
  }
}

export async function updateDeviceStatusAction(
  input: UpdateDeviceStatusInput,
): Promise<Result<null, AppError>> {
  const { error: authzError } = await requireManager();
  if (authzError) return err(authzError);

  const parsed = updateDeviceStatusSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Estado invalido."));

  try {
    await service.changeDeviceStatus(parsed.data.deviceId, parsed.data.status);
    revalidatePath("/comodato");
    return ok(null);
  } catch {
    return err(appError("internal", "No se pudo actualizar el estado del equipo."));
  }
}

export async function assignComodatoAction(
  input: AssignComodatoInput,
): Promise<Result<{ assignmentId: string }, AppError>> {
  const { error: authzError } = await requireManager();
  if (authzError) return err(authzError);

  const parsed = assignComodatoSchema.safeParse(input);
  if (!parsed.success) {
    return err(appError("validation", parsed.error.issues[0]?.message ?? "Datos invalidos."));
  }

  try {
    const assignment = await service.assignComodato(parsed.data);
    revalidatePath("/comodato");
    return ok({ assignmentId: assignment.id });
  } catch (e) {
    if (e instanceof service.DeviceNotFoundError) {
      return err(appError("not_found", "El equipo no existe."));
    }
    if (e instanceof service.DeviceAlreadyAssignedError) {
      return err(appError("conflict", "El equipo ya tiene un comodato activo."));
    }
    return err(appError("internal", "No se pudo asignar el comodato."));
  }
}

export async function returnComodatoAction(
  input: ReturnComodatoInput,
): Promise<Result<null, AppError>> {
  const { error: authzError } = await requireManager();
  if (authzError) return err(authzError);

  const parsed = returnComodatoSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Datos de devolucion invalidos."));

  try {
    await service.returnComodato(parsed.data);
    revalidatePath("/comodato");
    return ok(null);
  } catch {
    return err(appError("internal", "No se pudo registrar la devolucion."));
  }
}

// ----- Adaptadores de formulario (useActionState) para la UI de B4.3 -----

export async function createDeviceFormAction(
  _prev: ComodatoFormState,
  formData: FormData,
): Promise<ComodatoFormState> {
  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? undefined : v;
  };
  const result = await createDeviceAction({
    assetCode: str("assetCode") ?? "",
    manufacturerSerial: str("manufacturerSerial") ?? "",
    systemEmail: str("systemEmail") ?? "",
    brand: str("brand"),
    model: str("model") ?? "",
    supplier: str("supplier"),
    purchaseDate: str("purchaseDate"),
    lastCalibrationDate: str("lastCalibrationDate"),
  });
  if (!result.ok) return { error: result.error.message, success: null };
  return { error: null, success: "Equipo creado." };
}

export async function assignComodatoFormAction(
  _prev: ComodatoFormState,
  formData: FormData,
): Promise<ComodatoFormState> {
  const result = await assignComodatoAction({
    deviceId: String(formData.get("deviceId") ?? ""),
    professionalId: String(formData.get("professionalId") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    expectedEndDate: String(formData.get("expectedEndDate") ?? ""),
  });
  if (!result.ok) return { error: result.error.message, success: null };
  return { error: null, success: "Comodato asignado." };
}

export async function updateDeviceStatusFormAction(
  _prev: ComodatoFormState,
  formData: FormData,
): Promise<ComodatoFormState> {
  const result = await updateDeviceStatusAction({
    deviceId: String(formData.get("deviceId") ?? ""),
    status: String(formData.get("status") ?? "") as UpdateDeviceStatusInput["status"],
  });
  if (!result.ok) return { error: result.error.message, success: null };
  return { error: null, success: "Estado actualizado." };
}

export async function returnComodatoFormAction(
  _prev: ComodatoFormState,
  formData: FormData,
): Promise<ComodatoFormState> {
  const result = await returnComodatoAction({
    assignmentId: String(formData.get("assignmentId") ?? ""),
    actualReturnDate: String(formData.get("actualReturnDate") ?? ""),
    status: (String(formData.get("status") ?? "completed") || "completed") as
      | "completed"
      | "breach",
  });
  if (!result.ok) return { error: result.error.message, success: null };
  return { error: null, success: "Devolucion registrada." };
}
