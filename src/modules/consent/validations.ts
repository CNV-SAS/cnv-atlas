import { z } from "zod";

// Validaciones del consentimiento por capas (CONSENT_ATLAS.md secciones 11-12, DELTA
// C1/M3 y DELTA2 B1/B2). El paciente marca casillas activamente: ninguna viene pre-
// marcada, asi que el default es false y las necesarias se exigen true de forma
// explicita. Desde v1.5 el consentimiento soporta menores de edad: una rama de edad
// explicita ('mayor' | 'menor') abre el bloque del representante legal y, entre 14 y
// 17 años, el asentimiento del menor.

// Los 6 tipos de autorizacion que el titular marca como casillas (consent_type_enum).
// Los tipos derivados de la rama menor (representante_legal, asentimiento_menor) NO
// son casillas: se generan en el escritor a partir de la rama y sus datos (DELTA2 B4).
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
// Aplican igual en la rama menor, firmadas por el representante legal.
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

// Parentesco/calidad del representante legal (CONSENT_ATLAS seccion 11). 'tutor' se
// muestra como "tutor legal" en la UI; el valor persistido es el corto.
export const LEGAL_REP_RELATIONSHIPS = ["padre", "madre", "tutor", "curador"] as const;
export type LegalRepRelationship = (typeof LEGAL_REP_RELATIONSHIPS)[number];

// Umbrales de edad (CONSENT_ATLAS seccion 11).
export const ADULT_MIN_AGE = 18;
export const ASSENT_MIN_AGE = 14; // 14-17: el menor otorga asentimiento

// Edad en años cumplidos a partir de una fecha de nacimiento YYYY-MM-DD. UTC para no
// depender de la zona horaria del proceso. Devuelve null si la fecha es invalida.
export function computeAgeYears(birthDate: string, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = now.getUTCFullYear() - year;
  const monthDiff = now.getUTCMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < day)) age -= 1;
  return age;
}

export function isMinorAge(ageYears: number | null): boolean {
  return ageYears !== null && ageYears < ADULT_MIN_AGE;
}

// El asentimiento del menor aplica en el rango 14-17 (CONSENT_ATLAS seccion 11).
export function assentApplies(ageYears: number | null): boolean {
  return ageYears !== null && ageYears >= ASSENT_MIN_AGE && ageYears < ADULT_MIN_AGE;
}

// Mensaje unico para las casillas necesarias que el paciente no marco.
const requiredTrue = (label: string) =>
  z.literal(true, { message: `Debes autorizar ${label} para continuar.` });

export const consentSchema = z
  .object({
    // Necesarias (deben ser true, en ambas ramas de edad).
    servicio: requiredTrue("el tratamiento de tus datos personales"),
    datos_sensibles: requiredTrue("el tratamiento de tus datos de salud"),
    internacional_ia: requiredTrue(
      "el tratamiento internacional y el uso de sistemas automatizados",
    ),
    // Opcionales (libres; default false porque no vienen pre-marcadas).
    investigacion: z.boolean().default(false),
    comunicaciones_continuidad: z.boolean().default(false),
    comunicaciones_comerciales: z.boolean().default(false),
    // Rama de edad (DELTA2 B2). 'mayor': el paciente adulto declara y firma.
    // 'menor': firma el representante legal. Default 'mayor' por compatibilidad.
    ageBranch: z.enum(["mayor", "menor"]).default("mayor"),
    // Rama mayor: declaracion de mayoria de edad (CONSENT_ATLAS seccion 11).
    mayoria_de_edad: z.boolean().default(false),
    // Rama menor: datos del representante legal (se validan en el refine segun rama).
    legalRepresentativeName: z.string().trim().min(1).max(120).optional(),
    legalRepresentativeDocument: z.string().trim().min(3).max(60).optional(),
    legalRepresentativeRelationship: z.enum(LEGAL_REP_RELATIONSHIPS).optional(),
    legalRepresentativeEmail: z.email().max(160).optional(),
    // Fecha de nacimiento del menor: pedida en el consentimiento para determinar si
    // aplica el asentimiento (14-17). Se reutiliza como prefill en identificacion.
    minorBirthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida")
      .optional(),
    asentimiento_menor: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    if (val.ageBranch === "mayor") {
      if (val.mayoria_de_edad !== true) {
        ctx.addIssue({
          code: "custom",
          path: ["mayoria_de_edad"],
          message: "Debes declarar que eres mayor de 18 años para continuar.",
        });
      }
      return;
    }

    // Rama menor: el bloque del representante legal es obligatorio.
    if (!val.legalRepresentativeName) {
      ctx.addIssue({
        code: "custom",
        path: ["legalRepresentativeName"],
        message: "Ingresa el nombre del representante legal.",
      });
    }
    if (!val.legalRepresentativeDocument) {
      ctx.addIssue({
        code: "custom",
        path: ["legalRepresentativeDocument"],
        message: "Ingresa el documento del representante legal.",
      });
    }
    if (!val.legalRepresentativeRelationship) {
      ctx.addIssue({
        code: "custom",
        path: ["legalRepresentativeRelationship"],
        message: "Indica el parentesco o calidad del representante legal.",
      });
    }
    if (!val.legalRepresentativeEmail) {
      ctx.addIssue({
        code: "custom",
        path: ["legalRepresentativeEmail"],
        message: "Ingresa el correo del representante legal.",
      });
    }
    if (!val.minorBirthDate) {
      ctx.addIssue({
        code: "custom",
        path: ["minorBirthDate"],
        message: "Ingresa la fecha de nacimiento del menor.",
      });
      return;
    }

    // La fecha no puede indicar mayoria de edad en la rama menor: seria una rama
    // equivocada (el segundo muro real se valida contra el documento en B3).
    const age = computeAgeYears(val.minorBirthDate, new Date());
    if (age !== null && age >= ADULT_MIN_AGE) {
      ctx.addIssue({
        code: "custom",
        path: ["minorBirthDate"],
        message: "La fecha indica mayoria de edad. Usa la opcion de mayor de edad.",
      });
    }
    // Asentimiento obligatorio entre 14 y 17 años.
    if (assentApplies(age) && val.asentimiento_menor !== true) {
      ctx.addIssue({
        code: "custom",
        path: ["asentimiento_menor"],
        message: "El menor de 14 a 17 años debe otorgar su asentimiento.",
      });
    }
  });

export type ConsentInput = z.infer<typeof consentSchema>;

// Tipos de autorizacion (casillas) efectivamente otorgados (los true), para crear un
// registro en patient_consents por cada uno. Excluye la rama de edad y los tipos
// derivados del menor (representante_legal, asentimiento_menor), que arma el escritor.
export function grantedConsentTypes(input: ConsentInput): ConsentType[] {
  return CONSENT_TYPES.filter((t) => input[t] === true);
}
