import { z } from "zod";

import {
  ASCENDENCIA_OPTIONS,
  EDUCACION_OPTIONS,
  ESTADO_CIVIL_OPTIONS,
  ESTRATO_OPTIONS,
  ETNIA_OPTIONS,
  MOTIVO_OPTIONS,
} from "./data/sociodemographic-options";

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
  // Residencia prolongada (Gildardo §1). Opcional (nullish), max 80 como la ciudad. Sin gate: es
  // caracterizacion, no dato sensible como la etnia.
  longestResidenceCity: z.string().trim().max(80).nullish().transform((v) => v ?? null),
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

// Caracterizacion sociodemografica OPCIONAL (E1). Tolerante A PROPOSITO: nunca debe bloquear el envio de
// la encuesta (es opcional). Normaliza cada campo contra su lista (valor fuera de lista => null) y filtra el
// motivo a las opciones conocidas. La ocupacion admite texto libre (opcion "Otra"), asi que no se lista.
const inList = (value: string | null, options: readonly string[]): string | null =>
  value && options.includes(value) ? value : null;

// Etnia: una de las 7 opciones, o "Otro: <texto>" (el campo "cual", texto libre). El texto se recorta a 50
// caracteres (precaucion del dictamen legal 2026-08-20: forzar respuesta categorica, evitar relato/fuga). Nada
// mas se acepta. El texto libre es sensible: NUNCA estratifica directo ni sale en exportaciones sin normalizar
// a categorias, revisado por una persona (DATA_GOVERNANCE). El writer ademas re-gatea a la autorizacion.
const normalizeEtnia = (value: string | null): string | null => {
  if (!value) return null;
  const s = value.trim();
  if ((ETNIA_OPTIONS as readonly string[]).includes(s)) return s;
  const m = /^Otro:\s*(.+)$/i.exec(s);
  return m ? `Otro: ${m[1].trim().slice(0, 50)}` : null;
};

export const characterizationSchema = z
  .object({
    // profile PRESENTE solo cuando la seccion muestra los 4 campos (intake inicial). Ausente en seguimiento.
    profile: z
      .object({
        educationLevel: z.string().max(120).nullish().transform((v) => v ?? null),
        occupation: z.string().trim().max(120).nullish().transform((v) => (v ? v : null)),
        maritalStatus: z.string().max(120).nullish().transform((v) => v ?? null),
        socioeconomicStratum: z.string().max(120).nullish().transform((v) => v ?? null),
      })
      .extend({
        ethnicity: z.string().max(120).nullish().transform((v) => v ?? null),
        ancestry: z.string().max(120).nullish().transform((v) => v ?? null),
      })
      .transform((p) => ({
        educationLevel: inList(p.educationLevel, EDUCACION_OPTIONS),
        occupation: p.occupation, // texto libre permitido ("Otra")
        maritalStatus: inList(p.maritalStatus, ESTADO_CIVIL_OPTIONS),
        socioeconomicStratum: inList(p.socioeconomicStratum, ESTRATO_OPTIONS),
        // Etnia: la opcion de la lista o "Otro: <texto>". El SERVIDOR ademas la gatea a investigacion en el
        // writer (no basta la validacion aqui). Ascendencia RETIRADA del intake (el form no la envia): siempre
        // resuelve a null; la validacion se conserva por si llegara un valor viejo (que tambien cae a null).
        ethnicity: normalizeEtnia(p.ethnicity),
        ancestry: inList(p.ancestry, ASCENDENCIA_OPTIONS),
      }))
      .optional(),
    reasonForVisit: z
      .array(z.string().max(120))
      .max(50)
      // Se conservan los motivos de la lista Y el texto libre de "Otro" ("Otro: <texto>"). Antes solo dejaba
      // pasar los de la lista, asi que el texto libre del motivo se descartaba en el servidor y no aparecia en
      // el perfil (Santiago 2026-08-20 §4a). El resto (valores fuera de lista sin el centinela) se filtra.
      .transform((arr) =>
        arr.filter(
          (x) => (MOTIVO_OPTIONS as readonly string[]).includes(x) || /^otro\s*:\s*.+$/i.test(x.trim()),
        ),
      )
      .optional(),
  })
  .nullish()
  .transform((v) => v ?? null);
export type CharacterizationInput = z.infer<typeof characterizationSchema>;

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
  // Otorgo la autorizacion de investigacion (consent v1.0): la fase 2 muestra el campo de etnia.
  ethnicityAuthorized: boolean;
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
