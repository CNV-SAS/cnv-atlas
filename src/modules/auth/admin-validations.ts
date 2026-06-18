import { z } from "zod";

export const roleEnum = z.enum([
  "admin",
  "direccion",
  "soporte",
  "obbia",
  "professional",
]);

export const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(120),
  role: roleEnum,
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
