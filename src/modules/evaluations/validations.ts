import { z } from "zod";

// Validaciones del envio de la encuesta publica. Entrada externa sin sesion: pasa
// por Zod con limites de tamano (CLAUDE.md). No incluye el consentimiento, que se
// valida con consentSchema del modulo consent.

const DOCUMENT_TYPES = ["CC", "CE", "TI", "PA", "NIT"] as const;

// Identidad declarada por el paciente. El documento es la llave de resolucion.
export const intakeIdentitySchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  documentNumber: z.string().trim().min(3).max(30),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  // Fecha de nacimiento opcional en el esquema, pero el flujo exige +18 aparte.
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida")
    .nullish()
    .transform((v) => v ?? null),
  sex: z.string().trim().max(40).nullish().transform((v) => v ?? null),
  country: z.string().trim().max(80).nullish().transform((v) => v ?? null),
  city: z.string().trim().max(80).nullish().transform((v) => v ?? null),
  email: z.email().max(160).nullish().transform((v) => v ?? null),
  phone: z.string().trim().max(40).nullish().transform((v) => v ?? null),
});
export type IntakeIdentityInput = z.infer<typeof intakeIdentitySchema>;

// Respuestas de la encuesta: pares pregunta/valor. El valor se guarda como texto
// crudo (recoleccion pura, sin scoring); el motor lo interpreta despues (B9+).
export const intakeAnswersSchema = z
  .array(
    z.object({
      questionId: z.guid(),
      answerValue: z.string().max(5000),
    }),
  )
  .max(500);
export type IntakeAnswersInput = z.infer<typeof intakeAnswersSchema>;

// Estado del formulario de la encuesta publica (useActionState).
export type SurveyFormState = {
  error: string | null;
  fields: Record<string, string> | null;
  done: boolean;
};

// Estado de la confirmacion de identidad (panel del profesional).
export type ConfirmIdentityState = {
  error: string | null;
  confirmed: boolean;
};

// Estado de la emision de un link de seguimiento. linkPath lleva la ruta relativa
// (/encuesta/<token>); la UI la combina con el origen para mostrar el link completo.
export type FollowupLinkState = {
  error: string | null;
  linkPath: string | null;
};

// Estado del link base (inicial reusable) de consultorio del profesional. linkPath lleva la ruta
// relativa (/encuesta/<token>) del link estable; la UI la combina con el origen. Es get-or-create:
// estable entre llamadas (no se regenera).
export type BaseSurveyLinkState = {
  error: string | null;
  linkPath: string | null;
};
