import { z } from "zod";

// Validacion de la nota de criterio del profesional sobre un diagnostico. Limite de tamano
// para acotar el payload (regla de validacion). z.guid: los ids del proyecto son UUID fijos.
export const addDiagnosisNoteSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
  note: z
    .string()
    .trim()
    .min(1, "El criterio no puede estar vacío.")
    .max(2000, "El criterio es demasiado largo."),
});

export type AddDiagnosisNoteInput = z.infer<typeof addDiagnosisNoteSchema>;

// Confirmar el diagnostico (mini-bloque): la firma clinica del analisis, que habilita prescribir. No
// lleva payload mas alla de la evaluacion (el que confirma es el profesional asignado, resuelto en el
// service; no hay dato del formulario que confiar).
export const confirmDiagnosisSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
});

export type ConfirmDiagnosisInput = z.infer<typeof confirmDiagnosisSchema>;
