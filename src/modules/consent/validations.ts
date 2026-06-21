import { z } from "zod";

// Validaciones del consentimiento por capas (CONSENT_ATLAS.md seccion 12, DELTA C1/
// M3). El paciente marca casillas activamente: ninguna viene pre-marcada, asi que
// el default es false y las necesarias se exigen true de forma explicita.

// Los 6 tipos de autorizacion (consent_type_enum). El orden es el del documento.
export const CONSENT_TYPES = [
  "servicio",
  "datos_sensibles",
  "internacional_ia",
  "investigacion",
  "comunicaciones_continuidad",
  "comunicaciones_comerciales",
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

// Las 3 necesarias para el servicio: sin las 3, no se puede continuar (regla dura
// 15). Se modelan como literal(true) para que el flujo no avance si falta alguna.
export const NECESSARY_CONSENT_TYPES = [
  "servicio",
  "datos_sensibles",
  "internacional_ia",
] as const satisfies readonly ConsentType[];

// Las 3 opcionales: no afectan la atencion, se registran de forma independiente.
export const OPTIONAL_CONSENT_TYPES = [
  "investigacion",
  "comunicaciones_continuidad",
  "comunicaciones_comerciales",
] as const satisfies readonly ConsentType[];

// Mensaje unico para las casillas necesarias que el paciente no marco.
const requiredTrue = (label: string) =>
  z.literal(true, { message: `Debes autorizar ${label} para continuar.` });

export const consentSchema = z.object({
  // Necesarias (deben ser true).
  servicio: requiredTrue("el tratamiento de tus datos personales"),
  datos_sensibles: requiredTrue("el tratamiento de tus datos de salud"),
  internacional_ia: requiredTrue(
    "el tratamiento internacional y el uso de sistemas automatizados",
  ),
  // Opcionales (libres; default false porque no vienen pre-marcadas).
  investigacion: z.boolean().default(false),
  comunicaciones_continuidad: z.boolean().default(false),
  comunicaciones_comerciales: z.boolean().default(false),
  // Mayoria de edad: el MVP opera solo con +18 (CONSENT_ATLAS seccion 11, DELTA M3).
  mayoria_de_edad: z.literal(true, {
    message: "Debes declarar que eres mayor de 18 años para continuar.",
  }),
});

export type ConsentInput = z.infer<typeof consentSchema>;

// Tipos de autorizacion efectivamente otorgados (los true), para crear un registro
// en patient_consents por cada uno. Excluye mayoria_de_edad, que no es un consent_type.
export function grantedConsentTypes(input: ConsentInput): ConsentType[] {
  return CONSENT_TYPES.filter((t) => input[t] === true);
}
