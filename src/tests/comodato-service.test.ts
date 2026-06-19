import { beforeEach, describe, expect, it, vi } from "vitest";

// El servicio importa el repo por ruta relativa; aqui lo mockeamos para probar la
// LOGICA real del servicio (la regla de doble comodato) sin tocar Supabase ni el
// codigo server-only. vitest no resuelve el alias @, asi que todo va por rutas
// relativas (igual que el resto de tests de integracion).
vi.mock("../modules/comodato/data/comodato-repository", () => ({
  getDeviceById: vi.fn(),
  getActiveAssignmentForDevice: vi.fn(),
  createAssignment: vi.fn(),
  // Re-exportados por el servicio en el modulo (se leen al importar):
  listDevices: vi.fn(),
  listAssignments: vi.fn(),
  listAssignmentsByDevice: vi.fn(),
  listAssignableProfessionals: vi.fn(),
  listExpiringAssignments: vi.fn(),
  createDevice: vi.fn(),
  updateDeviceStatus: vi.fn(),
  returnAssignment: vi.fn(),
}));

import * as repo from "../modules/comodato/data/comodato-repository";
import {
  assignComodato,
  changeDeviceStatus,
  DeviceAlreadyAssignedError,
  DeviceHasActiveComodatoError,
  DeviceNotFoundError,
} from "../modules/comodato/services/comodato-service";

const input = {
  deviceId: "11111111-1111-1111-1111-111111111111",
  professionalId: "22222222-2222-2222-2222-222222222222",
  startDate: "2026-01-01",
  expectedEndDate: "2026-06-01",
};

describe("B4: regla de asignacion de comodato (servicio)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rechaza un segundo comodato activo sobre el mismo equipo", async () => {
    vi.mocked(repo.getDeviceById).mockResolvedValue({ id: input.deviceId } as never);
    // Ya existe una asignacion activa para el equipo.
    vi.mocked(repo.getActiveAssignmentForDevice).mockResolvedValue({ id: "a-activa" } as never);

    await expect(assignComodato(input)).rejects.toBeInstanceOf(DeviceAlreadyAssignedError);
    expect(repo.createAssignment).not.toHaveBeenCalled();
  });

  it("falla si el equipo no existe", async () => {
    vi.mocked(repo.getDeviceById).mockResolvedValue(null);
    await expect(assignComodato(input)).rejects.toBeInstanceOf(DeviceNotFoundError);
    expect(repo.getActiveAssignmentForDevice).not.toHaveBeenCalled();
  });

  it("asigna cuando el equipo existe y no tiene comodato activo", async () => {
    vi.mocked(repo.getDeviceById).mockResolvedValue({ id: input.deviceId } as never);
    vi.mocked(repo.getActiveAssignmentForDevice).mockResolvedValue(null);
    vi.mocked(repo.createAssignment).mockResolvedValue({ id: "a-nueva" } as never);

    const created = await assignComodato(input);
    expect(created.id).toBe("a-nueva");
    expect(repo.createAssignment).toHaveBeenCalledOnce();
  });
});

describe("B4: regla de cambio de estado del equipo (servicio)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bloquea pasar a 'available' si hay comodato activo", async () => {
    vi.mocked(repo.getActiveAssignmentForDevice).mockResolvedValue({ id: "a-activa" } as never);
    await expect(changeDeviceStatus("d1", "available")).rejects.toBeInstanceOf(
      DeviceHasActiveComodatoError,
    );
    expect(repo.updateDeviceStatus).not.toHaveBeenCalled();
  });

  it("permite estados de no-uso con comodato activo, pero devuelve warning", async () => {
    vi.mocked(repo.getActiveAssignmentForDevice).mockResolvedValue({ id: "a-activa" } as never);
    vi.mocked(repo.updateDeviceStatus).mockResolvedValue({ id: "d1", status: "maintenance" } as never);
    const res = await changeDeviceStatus("d1", "maintenance");
    expect(res.warning).not.toBeNull();
    expect(repo.updateDeviceStatus).toHaveBeenCalledOnce();
  });

  it("sin comodato activo, cambia sin warning", async () => {
    vi.mocked(repo.getActiveAssignmentForDevice).mockResolvedValue(null);
    vi.mocked(repo.updateDeviceStatus).mockResolvedValue({ id: "d1", status: "available" } as never);
    const res = await changeDeviceStatus("d1", "available");
    expect(res.warning).toBeNull();
    expect(repo.updateDeviceStatus).toHaveBeenCalledOnce();
  });
});
