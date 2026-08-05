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
  })
  .superRefine((val, ctx) => {
    if (val.role === "professional" && !val.profession) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["profession"],
        message: "La profesion es obligatoria para un profesional.",
      });
    }
  });
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const forcePasswordResetSchema = z.object({
  email: z.string().email(),
});

export const deactivateUserSchema = z.object({
  userId: z.string().uuid(),
});

// Estado para los formularios de admin (useActionState).
export type AdminFormState = { error: string | null; success: string | null };
