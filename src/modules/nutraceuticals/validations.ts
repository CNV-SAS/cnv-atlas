import { z } from "zod";

// Validaciones de nutraceuticos. Ids con z.guid() (no z.uuid(): rechazaria los
// UUIDs fijos del seed; ver hallazgo de B4). Numeros con coerce porque la UI los
// envia como strings de FormData.

const dbUuid = z.guid();

export const createNutraceuticalSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  unit: z.string().trim().max(40).optional(),
  unitPrice: z.coerce.number().nonnegative().max(1_000_000_000).optional(),
});
export type CreateNutraceuticalInput = z.infer<typeof createNutraceuticalSchema>;

export const updateNutraceuticalSchema = createNutraceuticalSchema.extend({
  id: dbUuid,
});
export type UpdateNutraceuticalInput = z.infer<typeof updateNutraceuticalSchema>;

// Ajuste de stock: cantidad absoluta (no delta), entera y no negativa.
export const setStockSchema = z.object({
  nutraceuticalId: dbUuid,
  stockQuantity: z.coerce.number().int().min(0).max(1_000_000),
});
export type SetStockInput = z.infer<typeof setStockSchema>;

// Registro de uso vinculado a un tratamiento (sin UI en B5; la pantalla va en B12).
export const registerUsageSchema = z.object({
  treatmentId: dbUuid,
  nutraceuticalId: dbUuid,
  quantity: z.coerce.number().int().positive().max(100_000),
});
export type RegisterUsageInput = z.infer<typeof registerUsageSchema>;

// Estado para los formularios (useActionState). Exactamente uno no-nulo.
export type NutraceuticalFormState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};
