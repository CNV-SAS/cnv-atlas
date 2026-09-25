import { z } from "zod";

import { cantidadTecleada, importeTecleado } from "@/core/pesos";

// Validaciones de nutraceuticos. Ids con z.guid() (no z.uuid(): rechazaria los
// UUIDs fijos del seed; ver hallazgo de B4). Numeros con coerce porque la UI los
// envia como strings de FormData.

const dbUuid = z.guid();

export const createNutraceuticalSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  unit: z.string().trim().max(40).optional(),
  // EL PRECIO QUE SELLA TODAS LAS VENTAS (2026-09-25), asi que aqui un 11,9 no contamina una venta:
  // contamina todas, y tambien el precio sellado de un faltante. Era `z.coerce.number()`, o sea `Number()`:
  // "11.900" daba 11,9. Lo tapaba el `step={1}` del campo, que es una defensa del NAVEGADOR y no del lector.
  unitPrice: importeTecleado({ max: 1_000_000_000 }).optional(),
});
export type CreateNutraceuticalInput = z.infer<typeof createNutraceuticalSchema>;

// La DISPONIBILIDAD solo se edita (al crear nace `no_disponible`, que es el default de la columna): un
// producto nuevo no esta en ninguna parte hasta que alguien diga que si. Es dato COMERCIAL y lo mueve el
// admin del catalogo, no el profesional. Cotejo 2026-08-24: el badge se veia y no habia como cambiarlo.
export const nutraceuticalAvailabilityValues = ["en_consultorio", "solo_tienda", "no_disponible"] as const;

export const updateNutraceuticalSchema = createNutraceuticalSchema.extend({
  id: dbUuid,
  commercialAvailability: z.enum(nutraceuticalAvailabilityValues),
});
export type UpdateNutraceuticalInput = z.infer<typeof updateNutraceuticalSchema>;

// Recepcion en consignacion (Mi inventario): reconoce N unidades recibidas de CNV en custodia. Cantidad
// entera positiva; lote opcional (lo pide el reporte de faltante).
// `receptionSchema` se retiro con la recepcion tecleada (2026-09-25): el profesional ya no escribe lo que
// recibio, confirma lo que CNV declaro.

// Declarar una remesa (E2): CNV envía N unidades de un producto a un integrante. Cantidad entera positiva.
//
// EL LOTE ES OBLIGATORIO, y la pantalla decía "opcional" (2026-09-25). No era un matiz de etiqueta: el saldo
// se lleva por (ubicación, producto, lote) desde la 0121, así que el servicio rechazaba la remesa sin lote. La
// pantalla prometía que se podía dejar en blanco y al enviar no dejaba continuar, con un mensaje escrito
// además para quien RECIBE ("Indica el lote del producto que estás recibiendo"), no para CNV declarando.
//
// Es el caso de dos partes que LEEN FUENTES DISTINTAS: se unen del lado de la que manda, que es la base. Y se
// exige también aquí, no solo en el formulario, porque el `required` del navegador se puede saltar.
export const declareRemesaSchema = z.object({
  professionalId: dbUuid,
  nutraceuticalId: dbUuid,
  quantity: cantidadTecleada(1, 1_000_000),
  lote: z
    .string()
    .trim()
    .min(1, "Indica el lote que viene en la caja: el inventario se lleva por lote y sin él no se puede rastrear un retiro.")
    .max(120),
});
export type DeclareRemesaInput = z.infer<typeof declareRemesaSchema>;

// Confirmar una remesa (E2): el integrante reconoce cuánto llegó. min 0 a propósito (confirmar CERO = no
// llegó nada = faltante total; es la vía para "rechazar" una remesa que nunca llegó).
export const confirmRemesaSchema = z.object({
  remesaId: dbUuid,
  actualQuantity: cantidadTecleada(0, 1_000_000),
  lote: z.string().trim().max(120).optional(),
});
export type ConfirmRemesaInput = z.infer<typeof confirmRemesaSchema>;

// Conteo fisico (T3b-3 ST2): lineas de lo contado por producto. Cantidad entera >= 0 (contar cero es un
// dato valido: el producto ya no esta). Puede ser PARCIAL, pero al menos una linea. Lote opcional.
export const countLineSchema = z.object({
  nutraceuticalId: z.guid("Producto invalido."),
  lote: z.string().trim().max(120).optional(),
  // EL CONTEO FISICO ES EL DE MAS CONSECUENCIA de todas estas cantidades: su diferencia contra el saldo abre
  // un caso de faltante con precio sellado y CARGO ECONOMICO al Integrante. Con `z.coerce.number().int()`,
  // contar "1.000" se leia como 1 (entero y positivo, asi que pasaba) y abria un faltante de 999 unidades.
  physicalQty: cantidadTecleada(0, 1_000_000),
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
  quantity: cantidadTecleada(1, 100_000),
});
export type RegisterUsageInput = z.infer<typeof registerUsageSchema>;

// Estado para los formularios (useActionState). Exactamente uno no-nulo.
export type NutraceuticalFormState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};
