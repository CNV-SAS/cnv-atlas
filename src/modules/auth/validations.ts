import { z } from "zod";

// Estado que las server actions de auth devuelven a los formularios (useActionState).
export type AuthFormState = { error: string | null };

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const mfaCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export const setPasswordSchema = z
  .object({
    password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contrasenas no coinciden.",
    path: ["confirm"],
  });
