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
