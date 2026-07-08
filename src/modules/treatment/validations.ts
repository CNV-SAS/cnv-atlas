import { z } from "zod";

// Validaciones del protocolo de tratamiento (B13). Toda entrada externa pasa por Zod
// (ARCHITECTURE). Los ids se validan con z.guid(): z.uuid() de Zod 4 rechaza los UUIDs
// deterministas del seed. Los objetivos son opcionales (el tratamiento puede existir sin
// ellos); cuando vienen, se acotan a rangos clinicos razonables para atajar errores obvios.

// Objetivo calorico diario: rango amplio pero acotado (evita ceros o miles absurdos).
const kcalSchema = z.coerce
  .number()
  .int("El objetivo calorico debe ser un numero entero.")
  .min(500, "El objetivo calorico es demasiado bajo.")
  .max(6000, "El objetivo calorico es demasiado alto.")
  .nullable();

// Proteina objetivo en gramos por dia.
const proteinSchema = z.coerce
  .number()
  .int("La proteina debe ser un numero entero de gramos.")
  .min(0, "La proteina no puede ser negativa.")
  .max(400, "El objetivo de proteina es demasiado alto.")
  .nullable();

const restriccionSchema = z
  .string()
  .trim()
  .min(1)
  .max(60, "Cada restriccion es demasiado larga.");

const nutraceuticalLineSchema = z.object({
  nutraceuticalId: z.guid("Nutraceutico invalido."),
  dosage: z.string().trim().max(120, "La dosis es demasiado larga.").nullable(),
  durationDays: z.coerce
    .number()
    .int("La duracion debe ser un numero entero de dias.")
    .min(1, "La duracion minima es un dia.")
    .max(365, "La duracion maxima es un ano.")
    .nullable(),
});

const guidelineSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000, "La guia dietaria es demasiado larga.");

// Guardado completo del protocolo: objetivos + set de nutraceuticos + set de guias.
// Los sets se reemplazan por completo (el formulario envia el estado final deseado).
export const saveProtocolSchema = z.object({
  evaluationId: z.guid("Evaluacion invalida."),
  kcalObjetivo: kcalSchema,
  proteinaGramos: proteinSchema,
  restricciones: z.array(restriccionSchema).max(20, "Demasiadas restricciones."),
  nutraceuticals: z
    .array(nutraceuticalLineSchema)
    .max(30, "Demasiados nutraceuticos en el protocolo."),
  guidelines: z.array(guidelineSchema).max(30, "Demasiadas guias dietarias."),
});

export type SaveProtocolInput = z.infer<typeof saveProtocolSchema>;

// Nota clinica del tratamiento: append-only (treatment_notes lleva su timestamp).
export const addNoteSchema = z.object({
  evaluationId: z.guid("Evaluacion invalida."),
  note: z.string().trim().min(1, "La nota no puede estar vacia.").max(2000, "La nota es demasiado larga."),
});

export type AddNoteInput = z.infer<typeof addNoteSchema>;
