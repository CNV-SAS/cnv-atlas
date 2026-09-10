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
  // Procedencia: "hubo asistencia de IA" al componer (llega como "true"/"false" de un campo oculto que
  // el cliente pone en true si el profesional genero un borrador durante esta composicion). Default false.
  aiAssisted: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
});

export type AddDiagnosisNoteInput = z.infer<typeof addDiagnosisNoteSchema>;

// Generar el borrador de criterio por IA: solo la evaluacion (el resto lo arma el service del snapshot).
export const generateCriterionSchema = z.object({
  evaluationId: z.guid("Evaluación inválida."),
});

// `confirmDiagnosisSchema` SE RETIRO (2026-09-10) con el acto de confirmar. La firma clinica se sella
// ahora al aprobar el reporte (`reports-writer.ts`, evento `diagnosis.confirmed_via_report`), que es donde
// Gildardo dijo que debia quedar: nadie firma el resultado del motor, se firma haber prescrito sobre el.
