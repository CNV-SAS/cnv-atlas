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

// El estado del equipo se gestiona aparte del contrato (no se acopla al asignar).
export function changeDeviceStatus(deviceId: string, status: DeviceStatus): Promise<Device> {
  return repo.updateDeviceStatus(deviceId, status);
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
