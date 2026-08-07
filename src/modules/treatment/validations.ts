import { z } from "zod";

// Validaciones del protocolo de tratamiento (B13). Toda entrada externa pasa por Zod
// (ARCHITECTURE). Los ids se validan con z.guid(): z.uuid() de Zod 4 rechaza los UUIDs
// deterministas del seed. Los objetivos son opcionales (el tratamiento puede existir sin
// ellos); cuando vienen, se acotan a rangos clinicos razonables para atajar errores obvios.

// Objetivo calorico diario: rango amplio pero acotado (evita ceros o miles absurdos).
const kcalSchema = z.coerce
  .number()
  .int("El objetivo calórico debe ser un número entero.")
  .min(500, "El objetivo calórico es demasiado bajo.")
  .max(6000, "El objetivo calórico es demasiado alto.")
  .nullable();

// Proteina objetivo en gramos por dia.
const proteinSchema = z.coerce
  .number()
  .int("La proteína debe ser un número entero de gramos.")
  .min(0, "La proteína no puede ser negativa.")
  .max(400, "El objetivo de proteína es demasiado alto.")
  .nullable();

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

// Firma base por seccion (candado de concurrencia): la del protocolo que el cliente cargó. Las 4 claves
// espejan SectionKey de protocol-signature.ts. El servidor compara contra la firma actual bajo lock; si
// difiere, rechaza la escritura (no pisa un cambio hecho en otra sesion).
const sectionSignaturesSchema = z.object({
  objetivos: z.string(),
  restricciones: z.string(),
  nutraceuticals: z.string(),
  guidelines: z.string(),
});

// Guardado completo del protocolo: objetivos + set de nutraceuticos + set de guias.
// Los sets se reemplazan por completo (el formulario envia el estado final deseado).
export const saveProtocolSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  kcalObjetivo: kcalSchema,
  proteinaGramos: proteinSchema,
  restricciones: z.array(restriccionSchema).max(20, "Demasiadas restricciones."),
  nutraceuticals: z
    .array(nutraceuticalLineSchema)
    .max(30, "Demasiados nutracéuticos en el protocolo."),
  guidelines: z.array(guidelineSchema).max(30, "Demasiadas guías dietarias."),
  baseSignatures: sectionSignaturesSchema,
});

export type SaveProtocolInput = z.infer<typeof saveProtocolSchema>;

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
