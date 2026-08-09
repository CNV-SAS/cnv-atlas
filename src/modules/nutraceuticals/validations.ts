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

// Recepcion en consignacion (Mi inventario): reconoce N unidades recibidas de CNV en custodia. Cantidad
// entera positiva; lote opcional (lo pide el reporte de faltante).
export const receptionSchema = z.object({
  nutraceuticalId: dbUuid,
  quantity: z.coerce.number().int().min(1).max(1_000_000),
  lote: z.string().trim().max(120).optional(),
});
export type ReceptionInput = z.infer<typeof receptionSchema>;

// Confirmar una remesa (E2): el integrante reconoce cuánto llegó. min 0 a propósito (confirmar CERO = no
// llegó nada = faltante total; es la vía para "rechazar" una remesa que nunca llegó).
export const confirmRemesaSchema = z.object({
  remesaId: dbUuid,
  actualQuantity: z.coerce.number().int().min(0).max(1_000_000),
  lote: z.string().trim().max(120).optional(),
});
export type ConfirmRemesaInput = z.infer<typeof confirmRemesaSchema>;

// Despacho (T3b-2): entrega de N unidades al paciente, ligada a su tratamiento. Cantidad entera positiva
// (el negativo lo pone el service como delta; aqui es "cuantas entregaste").
export const despachoSchema = z.object({
  treatmentId: dbUuid,
  nutraceuticalId: dbUuid,
  quantity: z.coerce.number().int().min(1).max(1_000_000),
});
export type DespachoInput = z.infer<typeof despachoSchema>;

// Conteo fisico (T3b-3 ST2): lineas de lo contado por producto. Cantidad entera >= 0 (contar cero es un
// dato valido: el producto ya no esta). Puede ser PARCIAL, pero al menos una linea. Lote opcional.
export const countLineSchema = z.object({
  nutraceuticalId: z.guid("Producto invalido."),
  lote: z.string().trim().max(120).optional(),
  physicalQty: z.coerce.number().int().min(0).max(1_000_000),
});
export const recordCountSchema = z.object({
  note: z.string().trim().max(500).optional(),
  lines: z.array(countLineSchema).min(1, "Cuenta al menos un producto.").max(200),
});
export type RecordCountInput = z.infer<typeof recordCountSchema>;

// Justificacion de un faltante (T3b-3 ST3): categoria + referencia OBLIGATORIA. La referencia especifica
// depende de la categoria (numero de denuncia, guia, o id de movimiento); el schema exige que no este vacia,
// la superficie pide la que corresponde. Las 4 categorias espejan el enum nutraceuticalFaltanteJustification.
export const faltanteJustificationCategory = z.enum([
  "hurto_denuncia",
  "transporte_documentado",
  "venta_no_registrada",
  "devolucion_guia",
]);
export const submitJustificationSchema = z.object({
  caseId: z.guid("Caso invalido."),
  category: faltanteJustificationCategory,
  reference: z.string().trim().min(1, "La referencia es obligatoria.").max(200),
});
export type SubmitJustificationInput = z.infer<typeof submitJustificationSchema>;

// Clasificacion de CNV (T3b-3 ST4). admin propone; direccion confirma. reason opcional (motivo).
export const classifyFaltanteSchema = z.object({
  caseId: z.guid("Caso invalido."),
  decision: z.enum(["justificado", "venta_no_registrada", "injustificado"]),
  reason: z.string().trim().max(500).optional(),
});
export const confirmFaltanteSchema = z.object({
  caseId: z.guid("Caso invalido."),
  decision: z.enum(["confirmar", "rechazar"]),
  reason: z.string().trim().max(500).optional(),
});

// Resolver un sobrante (T3b-3 ST5): motivo OBLIGATORIO (por que sobra). No hay cargo ni plazo.
export const resolveSobranteSchema = z.object({
  countLineId: z.guid("Línea invalida."),
  reason: z.string().trim().min(1, "El motivo es obligatorio.").max(500),
});

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
