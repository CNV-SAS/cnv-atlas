import { z } from "zod";

// Validaciones del protocolo de tratamiento (B13). Toda entrada externa pasa por Zod
// (ARCHITECTURE). Los ids se validan con z.guid(): z.uuid() de Zod 4 rechaza los UUIDs
// deterministas del seed. Nota (checkpoint 2): el objetivo calorico y la proteina ya NO se
// validan aqui como input del protocolo; el objetivo sale de la cadena (adj_*), no de un input manual.

const restriccionSchema = z
  .string()
  .trim()
  .min(1)
  .max(60, "Cada restricción es demasiado larga.");

const nutraceuticalLineSchema = z.object({
  nutraceuticalId: z.guid("Nutracéutico inválido."),
  dosage: z.string().trim().max(120, "La dosis es demasiado larga.").nullable(),
  durationDays: z.coerce
    .number()
    .int("La duración debe ser un número entero de días.")
    .min(1, "La duración mínima es un día.")
    .max(365, "La duración máxima es un año.")
    .nullable(),
});

const guidelineSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000, "La guía dietaria es demasiado larga.");

// Checkpoint 2.4/2.5: el "Protocolo de tratamiento" se desarmo. Cada seccion editable tiene su propia
// accion/firma/candado (objetivo -> cadena; nutraceuticos, restricciones, guias por separado); saveProtocol
// y su firma por secciones se retiraron. baseSignature es un string opaco: se compara por igualdad.

// Restricciones alimentarias (checkpoint 2.4): set completo + firma base del candado.
export const saveRestriccionesSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  restricciones: z.array(restriccionSchema).max(20, "Demasiadas restricciones."),
  baseSignature: z.string().max(4000).default(""),
});

export type SaveRestriccionesInput = z.infer<typeof saveRestriccionesSchema>;

// Guias dietarias (checkpoint 2.4): set completo + firma base del candado.
export const saveGuidelinesSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  guidelines: z.array(guidelineSchema).max(30, "Demasiadas guías dietarias."),
  baseSignature: z.string().max(8000).default(""),
});

export type SaveGuidelinesInput = z.infer<typeof saveGuidelinesSchema>;

// Objetivo del tratamiento nutricional (checkpoint 2.4, pieza 1): texto libre del profesional. Limite HOLGADO
// (un par de parrafos clinicos) pero ACOTADO: un campo sin limite es un campo que alguien llena con un
// documento entero. Vacio -> null (el textarea vacio no cuenta como objetivo).
export const saveObjetivoSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  objetivo: z
    .string()
    .trim()
    .max(4000, "El objetivo del tratamiento es demasiado largo (máximo 4000 caracteres).")
    .nullable()
    .default(null),
  baseSignature: z.string().max(4200).default(""),
});

export type SaveObjetivoInput = z.infer<typeof saveObjetivoSchema>;

// Prescripcion de nutraceuticos (checkpoint 2.3): set completo + firma base del candado. El set se
// reemplaza por completo (el formulario envia el estado final deseado).
export const saveNutraceuticalsSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  nutraceuticals: z
    .array(nutraceuticalLineSchema)
    .max(30, "Demasiados nutracéuticos en la prescripción."),
  // Firma de la prescripcion que el cliente cargó (candado de concurrencia; ver nutraceuticalsSignature).
  baseSignature: z.string().max(4000).default(""),
});

export type SaveNutraceuticalsInput = z.infer<typeof saveNutraceuticalsSchema>;

// Ajustes del profesional sobre el protocolo sugerido (T2 A2), apartados B/D + peso meta de
// Nivel V. Todos opcionales (ajusta algunos, ninguno o todos); acotados a rangos clinicos
// razonables para atajar errores obvios. El valor efectivo (ajuste ?? sugerido) y los
// derivados los resuelve el service; la UI nunca escribe kcal_objetivo/proteina_g directo.
const optInt = (min: number, max: number, msg: string) =>
  z.coerce.number().int(msg).min(min, msg).max(max, msg).nullable();
const optNum = (min: number, max: number, msg: string) =>
  z.coerce.number().min(min, msg).max(max, msg).nullable();

export const saveAdjustmentsSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  adjGeb: optInt(500, 4000, "El gasto basal ajustado está fuera de rango."),
  adjPal: optNum(1, 2.5, "El factor de actividad está fuera de rango."),
  adjKcalObj: optInt(500, 6000, "El objetivo calórico ajustado está fuera de rango."),
  adjProtGkg: optNum(0, 4, "La proteína g/kg ajustada está fuera de rango."),
  adjFatPct: optInt(0, 100, "El porcentaje de grasa ajustado está fuera de rango."),
  adjPesoMeta: optNum(20, 400, "El peso meta está fuera de rango."),
  // Firma de los seis ajustes que el cliente cargó (candado de concurrencia; ver adjustmentSignature).
  // String opaco: se compara por igualdad, no se interpreta. Default "" para llamadas viejas sin firma.
  baseSignature: z.string().max(200).default(""),
});

export type SaveAdjustmentsInput = z.infer<typeof saveAdjustmentsSchema>;

// Reconocimiento de las restricciones del modelo (gate del generador de menu, Opcion B).
export const acknowledgeRestrictionsSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
});

export type AcknowledgeRestrictionsInput = z.infer<typeof acknowledgeRestrictionsSchema>;

// Aprobar el protocolo (T2 A3): convierte el sugerido + ajustes en la prescripcion efectiva y la
// sella. No lleva mas payload que la evaluacion: los adj_* ya estan guardados (saveAdjustments) y el
// set efectivo se recomputa en el service; el profesional nunca escribe el efectivo directo.
export const approveProtocolSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
});

export type ApproveProtocolInput = z.infer<typeof approveProtocolSchema>;

// Nota clinica del tratamiento: append-only (treatment_notes lleva su timestamp).
export const addNoteSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  note: z.string().trim().min(1, "La nota no puede estar vacía.").max(2000, "La nota es demasiado larga."),
});

export type AddNoteInput = z.infer<typeof addNoteSchema>;
