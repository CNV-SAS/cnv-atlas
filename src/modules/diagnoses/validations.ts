import { z } from "zod";

// Validacion de la nota de criterio del profesional sobre un diagnostico. Limite de tamano
// para acotar el payload (regla de validacion). z.guid: los ids del proyecto son UUID fijos.
export const addDiagnosisNoteSchema = z.object({
  evaluationId: z.guid("Evaluacion invalida."),
  note: z
    .string()
    .trim()
    .min(1, "El criterio no puede estar vacio.")
    .max(2000, "El criterio es demasiado largo."),
});

export type AddDiagnosisNoteInput = z.infer<typeof addDiagnosisNoteSchema>;
