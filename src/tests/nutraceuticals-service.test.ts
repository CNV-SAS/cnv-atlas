import { beforeEach, describe, expect, it, vi } from "vitest";

// Repo mockeado: prueba la LOGICA del servicio sin Supabase ni server-only. El inventario global
// (createInventory/setStock/getInventory/listInventory) se retiro al migrar a consignacion por
// profesional (T3b-1): el servicio ya no lo toca.
vi.mock("../modules/nutraceuticals/data/nutraceuticals-repository", () => ({
  listNutraceuticals: vi.fn(),
  getNutraceuticalById: vi.fn(),
  createNutraceutical: vi.fn(),
  updateNutraceutical: vi.fn(),
  listUsageByTreatment: vi.fn(),
  createUsage: vi.fn(),
}));

import * as repo from "../modules/nutraceuticals/data/nutraceuticals-repository";
import { createNutraceutical, registerUsage } from "../modules/nutraceuticals/services/nutraceuticals-service";

describe("B5: servicio de nutraceuticos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("al crear un nutraceutico NO crea inventario global (el stock es por profesional, consignacion)", async () => {
    vi.mocked(repo.createNutraceutical).mockResolvedValue({ id: "n1" } as never);
    const created = await createNutraceutical({ name: "Demo" }, "org-1");
    expect(created.id).toBe("n1");
    expect(repo.createNutraceutical).toHaveBeenCalledTimes(1);
  });

  it("registrar uso llama al repo (dato historico; el despacho con descuento es T3b-2)", async () => {
    vi.mocked(repo.createUsage).mockResolvedValue({ id: "u1" } as never);
    await registerUsage({ treatmentId: "t1", nutraceuticalId: "n1", quantity: 3 });
    expect(repo.createUsage).toHaveBeenCalledWith("t1", "n1", 3);
  });
});
