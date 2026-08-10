import { z } from "zod";

export const roleEnum = z.enum([
  "admin",
  "direccion",
  "soporte",
  "obbia",
  "professional",
]);

// Lista cerrada de profesiones (espejo del enum professional_profession de la BD). Gobierna la
// subpestaña de tratamiento por profesión y el guard de ámbito de práctica.
export const professionEnum = z.enum([
  "medico",
  "psicologo",
  "deportologo",
  "nutricionista",
]);
export type Profession = z.infer<typeof professionEnum>;

export const createUserSchema = z
  .object({
    email: z.string().email(),
    fullName: z.string().min(1).max(120),
    role: roleEnum,
    // Solo aplica al rol 'professional'. Opcional en el tipo; el refine la EXIGE para ese rol y la
    // ignora para roles internos (un integrante nuevo NO puede nacer con profesión null: bloquearía
    // todas sus escrituras de tratamiento, gate del Hito 2).
    profession: professionEnum.optional(),
    // Registro profesional (licencia). Opcional al crear: muchas licencias llegan despues, el admin las
    // agrega con setProfessionalLicense. Vacio => sin registro (en el consentimiento esa linea se omite).
    license: z.string().trim().max(100).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.role === "professional" && !val.profession) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["profession"],
        message: "La profesión es obligatoria para un profesional.",
      });
    }
  });
export type CreateUserInput = z.infer<typeof createUserSchema>;

// Registrar/editar el registro profesional de un profesional existente (las licencias llegan tarde; el
// admin las agrega despues). Vacio es valido: significa "sin registro" y guarda null (no una raya).
export const setProfessionalLicenseSchema = z.object({
  userId: z.string().uuid(),
  license: z.string().trim().max(100),
});
export type SetProfessionalLicenseInput = z.infer<typeof setProfessionalLicenseSchema>;

export const forcePasswordResetSchema = z.object({
  email: z.string().email(),
});

export const deactivateUserSchema = z.object({
  userId: z.string().uuid(),
});

export const resetUserMfaSchema = z.object({
  userId: z.string().uuid(),
  // Motivo obligatorio: el audit registra al admin que EJECUTA, no a quien PIDE. El reason es lo unico
  // que deja rastro de por que y a pedido de quien se reinicio el factor (SECURITY.md, seccion MFA).
  reason: z.string().trim().min(1, "Escribe el motivo del reinicio.").max(500),
});

// Estado para los formularios de admin (useActionState).
export type AdminFormState = { error: string | null; success: string | null };
