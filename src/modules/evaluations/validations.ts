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
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .nullish()
    .transform((v) => v ?? null),
  // Sexo OBLIGATORIO y exactamente F/M (decision A): el motor lo exige estricto (normalizeSex falla en
  // voz alta). Se valida aqui, en el intake, para no dejar pasar un vacio que reventaria despues en el
  // pipeline. El select del formulario produce F/M.
  sex: z.enum(["F", "M"]),
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

// Envio del codigo de verificacion (OTP) del consentimiento (B7, firma electronica). El sessionId es
// un nonce opaco que genera el cliente para ESTE intento de firma (crypto.randomUUID); ancla el codigo
// a este navegador/sesion y se vuelve a presentar al validar. El correo destino lo resuelve la accion
// segun la rama (mayor -> correo del paciente; menor -> correo del representante), no el cliente.
export const otpSendSchema = z.object({
  sessionId: z.guid(),
  email: z.email().max(160),
});
export type OtpSendInput = z.infer<typeof otpSendSchema>;

// Estado del envio del OTP (useActionState). maskedDestination es el correo ENMASCARADO (nunca el
// completo) para decirle al paciente a donde llego sin exponerlo; remaining son los reenvios que quedan
// en la ventana. sent marca que ya se envio (la UI pasa a pedir el codigo).
export type OtpSendState = {
  error: string | null;
  sent: boolean;
  maskedDestination: string | null;
  remaining: number | null;
};

// Estado del formulario de la encuesta publica (useActionState).
export type SurveyFormState = {
  error: string | null;
  fields: Record<string, string> | null;
  done: boolean;
};

// Reorganizacion del intake: estado de la FASE 1 (firmar). Al exito trae el resume_token, con el que el
// formulario pasa a la fase 2 (la encuesta) y con el que se reanuda. null mientras no se ha firmado.
export type SignSurveyState = {
  error: string | null;
  fields: Record<string, string> | null;
  resumeToken: string | null;
};

// Estado del guardado a medida (as-you-go) de la fase 2. saved marca el ultimo guardado exitoso; error
// se muestra discreto sin bloquear la encuesta (el paciente puede seguir; se reintenta).
export type SaveProgressState = {
  saved: boolean;
  error: string | null;
};

// Estado de la confirmacion de identidad (panel del profesional).
export type ConfirmIdentityState = {
  error: string | null;
  confirmed: boolean;
};

// Estado del cierre (archivado) de un shell firmado sin responder: pasa 'awaiting_survey' -> 'abandoned'.
// closed marca el exito para que la UI muestre la confirmacion.
export type AbandonEvaluationState = {
  error: string | null;
  closed: boolean;
};

// Estado de la resolucion de un conflicto de identidad (misma persona -> limpia el flag; no lo es ->
// cierra la evaluacion). resolved marca el exito.
export type ResolveConflictState = {
  error: string | null;
  resolved: boolean;
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

// Estado del QR del link base. qrDataUrl es un data URL (image/png) del QR, generado en servidor y
// PII-free (codifica solo la URL absoluta del token opaco).
export type BaseSurveyQrState = {
  error: string | null;
  qrDataUrl: string | null;
};
