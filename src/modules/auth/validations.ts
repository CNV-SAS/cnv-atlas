import { z } from "zod";

// Estado que las server actions de auth devuelven a los formularios (useActionState).
export type AuthFormState = { error: string | null };

// Estado del flujo "olvide mi clave". `sent` no revela si el correo existe: es el mismo mensaje
// para un correo registrado o no (evitar enumeracion de cuentas = quien es integrante).
export type ForgotPasswordState = { error: string | null; sent: boolean };

export const forgotPasswordSchema = z.object({ email: z.string().email() });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const mfaCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export const setPasswordSchema = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden.",
    path: ["confirm"],
  });
