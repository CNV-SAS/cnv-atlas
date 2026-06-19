import { beforeEach, describe, expect, it, vi } from "vitest";

// Repo mockeado: prueba la LOGICA del servicio sin Supabase ni server-only.
vi.mock("../modules/nutraceuticals/data/nutraceuticals-repository", () => ({
  listNutraceuticals: vi.fn(),
  listInventory: vi.fn(),
  getNutraceuticalById: vi.fn(),
  createNutraceutical: vi.fn(),
  updateNutraceutical: vi.fn(),
  listUsageByTreatment: vi.fn(),
  getInventory: vi.fn(),
  createInventory: vi.fn(),
  setStock: vi.fn(),
  createUsage: vi.fn(),
}));

import * as repo from "../modules/nutraceuticals/data/nutraceuticals-repository";
import {
  createNutraceutical,
  registerUsage,
  setStock,
} from "../modules/nutraceuticals/services/nutraceuticals-service";

describe("B5: servicio de nutraceuticos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("al crear un nutraceutico auto-crea su fila de inventario en 0", async () => {
    vi.mocked(repo.createNutraceutical).mockResolvedValue({ id: "n1" } as never);
    vi.mocked(repo.createInventory).mockResolvedValue({} as never);

    await createNutraceutical({ name: "Demo" }, "org-1");
    expect(repo.createInventory).toHaveBeenCalledWith("n1", 0);
  });

  it("ajustar stock crea la fila si no existe", async () => {
    vi.mocked(repo.getInventory).mockResolvedValue(null);
    vi.mocked(repo.createInventory).mockResolvedValue({} as never);

    await setStock({ nutraceuticalId: "n1", stockQuantity: 50 });
    expect(repo.createInventory).toHaveBeenCalledWith("n1", 50);
    expect(repo.setStock).not.toHaveBeenCalled();
  });

  it("ajustar stock actualiza si la fila existe", async () => {
    vi.mocked(repo.getInventory).mockResolvedValue({ id: "i1" } as never);
    vi.mocked(repo.setStock).mockResolvedValue({} as never);

    await setStock({ nutraceuticalId: "n1", stockQuantity: 20 });
    expect(repo.setStock).toHaveBeenCalledWith("n1", 20);
  });

  it("registrar uso no toca el inventario", async () => {
    vi.mocked(repo.createUsage).mockResolvedValue({ id: "u1" } as never);

    await registerUsage({ treatmentId: "t1", nutraceuticalId: "n1", quantity: 3 });
    expect(repo.createUsage).toHaveBeenCalledWith("t1", "n1", 3);
    expect(repo.setStock).not.toHaveBeenCalled();
    expect(repo.createInventory).not.toHaveBeenCalled();
  });
});
