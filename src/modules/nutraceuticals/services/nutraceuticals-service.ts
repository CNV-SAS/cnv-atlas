import * as repo from "../data/nutraceuticals-repository";
import type { Nutraceutical, NutraceuticalUsage } from "../types";
import type {
  CreateNutraceuticalInput,
  RegisterUsageInput,
  UpdateNutraceuticalInput,
} from "../validations";

// Servicio de nutraceuticos (la logica vive aqui; las actions son thin). Asume
// que el caller ya autorizo via policy.

// ----- Lecturas -----

// El catalogo (sin stock: el stock ya no es global, es un saldo por profesional en consignacion, ver
// Mi inventario). Las superficies que solo listan productos (checkout, catalogo admin) usan esto.
export const listCatalog = repo.listNutraceuticals;

export const listUsageByTreatment = repo.listUsageByTreatment;

// ----- Escrituras -----

// Crea el nutraceutico. Ya NO crea una fila de inventario global (el stock es por profesional via
// recepcion, T3b-1): un producto nuevo no tiene stock hasta que un profesional reciba unidades.
export function createNutraceutical(
  input: CreateNutraceuticalInput,
  organizationId: string,
): Promise<Nutraceutical> {
  return repo.createNutraceutical(
    {
      name: input.name,
      description: input.description ?? null,
      unit: input.unit ?? null,
      unit_price: input.unitPrice ?? null,
    },
    organizationId,
  );
}

export function updateNutraceutical(input: UpdateNutraceuticalInput): Promise<Nutraceutical> {
  return repo.updateNutraceutical(input.id, {
    // La disponibilidad es EDITABLE aqui (no al crear): un producto nuevo nace `no_disponible`.
    commercial_availability: input.commercialAvailability,
    name: input.name,
    description: input.description ?? null,
    unit: input.unit ?? null,
    unit_price: input.unitPrice ?? null,
  });
}

// Registro de uso vinculado a un tratamiento (dato historico B5). El despacho con descuento de stock es
// T3b-2 (un movimiento). Esto se conserva sin descontar.
export function registerUsage(input: RegisterUsageInput): Promise<NutraceuticalUsage> {
  return repo.createUsage(input.treatmentId, input.nutraceuticalId, input.quantity);
}
