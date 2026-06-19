import * as repo from "../data/comodato-repository";
import type {
  AssignableProfessional,
  AssignmentStatus,
  Device,
  DeviceAssignment,
  DeviceStatus,
} from "../types";
import type {
  AssignComodatoInput,
  CreateDeviceInput,
  ReturnComodatoInput,
} from "../validations";

// Servicio del comodato (la logica vive aqui; las actions son thin). Asume que el
// caller ya autorizo via policy. Lanza errores de dominio que la action traduce.

export class DeviceNotFoundError extends Error {}
export class DeviceAlreadyAssignedError extends Error {}
export class DeviceHasActiveComodatoError extends Error {}

// ----- Lecturas (superficie unica para la UI) -----
export const listDevices = repo.listDevices;
export const listAssignments = repo.listAssignments;
export const listAssignmentsByDevice = repo.listAssignmentsByDevice;

export function listAssignableProfessionals(): Promise<AssignableProfessional[]> {
  return repo.listAssignableProfessionals();
}

// Comodatos por vencer: por defecto 30 dias (criterio MVP). El corte es hoy + N.
export function listExpiringComodatos(withinDays = 30): Promise<DeviceAssignment[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return repo.listExpiringAssignments(cutoffIso);
}

// ----- Escrituras -----

export function createDevice(input: CreateDeviceInput, organizationId: string): Promise<Device> {
  return repo.createDevice(
    {
      asset_code: input.assetCode,
      manufacturer_serial: input.manufacturerSerial,
      system_email: input.systemEmail,
      brand: input.brand ?? null,
      model: input.model,
      supplier: input.supplier ?? null,
      purchase_date: input.purchaseDate ?? null,
      last_calibration_date: input.lastCalibrationDate ?? null,
    },
    organizationId,
  );
}

// Estados de no-uso: con comodato activo se permiten, pero se avisa (warning).
const NON_USE_STATES: DeviceStatus[] = ["maintenance", "out_of_service", "lost", "retired"];

// Cambio de estado del equipo (separado del contrato), con una salvaguarda: no se
// puede marcar 'available' si hay un comodato activo (primero la devolucion).
// Devuelve un warning cuando el cambio es valido pero conviene avisar.
export async function changeDeviceStatus(
  deviceId: string,
  status: DeviceStatus,
): Promise<{ device: Device; warning: string | null }> {
  const active = await repo.getActiveAssignmentForDevice(deviceId);

  if (active && status === "available") {
    throw new DeviceHasActiveComodatoError();
  }

  const device = await repo.updateDeviceStatus(deviceId, status);
  const warning =
    active && NON_USE_STATES.includes(status)
      ? "El equipo tiene un comodato activo; revisa si debe registrarse la devolucion."
      : null;
  return { device, warning };
}

export async function assignComodato(input: AssignComodatoInput): Promise<DeviceAssignment> {
  const device = await repo.getDeviceById(input.deviceId);
  if (!device) throw new DeviceNotFoundError();

  // Regla operativa: un equipo no puede tener dos comodatos activos a la vez.
  // (El estado del equipo NO se toca aqui: equipo y contrato van separados.)
  const active = await repo.getActiveAssignmentForDevice(input.deviceId);
  if (active) throw new DeviceAlreadyAssignedError();

  return repo.createAssignment({
    deviceId: input.deviceId,
    professionalId: input.professionalId,
    startDate: input.startDate,
    expectedEndDate: input.expectedEndDate,
  });
}

export function returnComodato(input: ReturnComodatoInput): Promise<DeviceAssignment> {
  return repo.returnAssignment(
    input.assignmentId,
    input.actualReturnDate,
    input.status as AssignmentStatus,
  );
}
