import * as repo from "../data/nutraceuticals-repository";
import type {
  Nutraceutical,
  NutraceuticalUsage,
  NutraceuticalWithStock,
} from "../types";
import type {
  CreateNutraceuticalInput,
  RegisterUsageInput,
  SetStockInput,
  UpdateNutraceuticalInput,
} from "../validations";

// Servicio de nutraceuticos (la logica vive aqui; las actions son thin). Asume
// que el caller ya autorizo via policy.

// ----- Lecturas -----

// Catalogo con su stock resuelto. El stock vive en otra tabla; se une en memoria.
export async function listCatalogWithStock(): Promise<NutraceuticalWithStock[]> {
  const [items, inventory] = await Promise.all([
    repo.listNutraceuticals(),
    repo.listInventory(),
  ]);
  const stockByNutra = new Map(inventory.map((i) => [i.nutraceutical_id, i.stock_quantity]));
  return items.map((n) => ({ ...n, stock: stockByNutra.get(n.id) ?? null }));
}

export const listUsageByTreatment = repo.listUsageByTreatment;

// ----- Escrituras -----

// Crea el nutraceutico y, acto seguido, su fila de inventario en 0 para que todo
// nutraceutico tenga stock ajustable (decision de B5).
export async function createNutraceutical(
  input: CreateNutraceuticalInput,
  organizationId: string,
): Promise<Nutraceutical> {
  const created = await repo.createNutraceutical(
    {
      name: input.name,
      description: input.description ?? null,
      unit: input.unit ?? null,
      unit_price: input.unitPrice ?? null,
    },
    organizationId,
  );
  await repo.createInventory(created.id, 0);
  return created;
}

export function updateNutraceutical(input: UpdateNutraceuticalInput): Promise<Nutraceutical> {
  return repo.updateNutraceutical(input.id, {
    name: input.name,
    description: input.description ?? null,
    unit: input.unit ?? null,
    unit_price: input.unitPrice ?? null,
  });
}

// Ajuste de stock (cantidad absoluta). Si por algun motivo no existe la fila de
// inventario, se crea con esa cantidad (robustez).
export async function setStock(input: SetStockInput) {
  const existing = await repo.getInventory(input.nutraceuticalId);
  if (!existing) {
    return repo.createInventory(input.nutraceuticalId, input.stockQuantity);
  }
  return repo.setStock(input.nutraceuticalId, input.stockQuantity);
}

// Registro de uso vinculado a un tratamiento. El stock NO se descuenta: la RLS
// separa uso (profesional) de inventario (admin/soporte) a proposito.
export function registerUsage(input: RegisterUsageInput): Promise<NutraceuticalUsage> {
  return repo.createUsage(input.treatmentId, input.nutraceuticalId, input.quantity);
}
