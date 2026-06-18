"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { appError, err, ok, type AppError, type Result } from "@/core/errors";
import { getClientIp } from "@/core/http/client-ip";
import { db } from "@/db";
import { professionalProfiles, profiles, roles, userRoles } from "@/db/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/modules/audit/log";

import {
  createUserSchema,
  deactivateUserSchema,
  forcePasswordResetSchema,
  type AdminFormState,
  type CreateUserInput,
} from "./admin-validations";
import { canManageUsers } from "./policies/can-manage-users";
import { getCurrentUser } from "./session";
import type { AppRole } from "./roles";

class RoleNotFoundError extends Error {}
class NotFoundError extends Error {}

// Autorizacion comun: sesion + policy. Nunca por role=== suelto (regla 3).
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: appError("unauthorized", "Inicia sesion.") };
  if (!canManageUsers(user)) {
    return { user: null, error: appError("forbidden", "No tienes permiso para esta accion.") };
  }
  return { user, error: null as null };
}

async function auditContext() {
  const h = await headers();
  return { ip: await getClientIp(), userAgent: h.get("user-agent") };
}

// Crea el auth user (API de Auth, fuera de la transaccion), luego en UNA sola
// transaccion: verifica el rol, asigna user_roles, crea professional_profiles si
// aplica, y escribe el audit user.created INLINE (si algo falla, todo revierte).
export async function createUser(
  input: CreateUserInput,
): Promise<Result<{ userId: string }, AppError>> {
  const { user, error: authzError } = await requireAdmin();
  if (authzError) return err(authzError);

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Datos invalidos."));
  const { email, fullName, role } = parsed.data;

  const admin = createSupabaseAdminClient();
  // El trigger handle_new_user materializa el profile desde el user_metadata.
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    { data: { organization_id: user.organizationId, full_name: fullName } },
  );
  if (inviteError || !invited?.user) {
    return err(appError("conflict", "No se pudo crear el usuario (el correo podria ya existir)."));
  }
  const newUserId = invited.user.id;

  const { ip, userAgent } = await auditContext();
  try {
    await db.transaction(async (tx) => {
      // Verifica que el rol exista ANTES de insertar en user_roles (no se confia
      // solo en la FK); el lookup ademas da el role_id.
      const [roleRow] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, role))
        .limit(1);
      if (!roleRow) throw new RoleNotFoundError();

      await tx.insert(userRoles).values({ userId: newUserId, roleId: roleRow.id });
      if (role === "professional") {
        await tx.insert(professionalProfiles).values({ profileId: newUserId });
      }

      await recordAudit(tx, {
        event: "user.created",
        actorId: user.id,
        actorEmail: user.email,
        entityType: "profile",
        entityId: newUserId,
        payload: { email, role },
        ip,
        userAgent,
      });
    });
  } catch (e) {
    // Compensa: borra el auth user para no dejar un profile huerfano sin rol/audit.
    await admin.auth.admin.deleteUser(newUserId);
    if (e instanceof RoleNotFoundError) {
      return err(appError("validation", "El rol indicado no existe."));
    }
    return err(appError("internal", "No se pudo completar la creacion del usuario."));
  }

  return ok({ userId: newUserId });
}

// Fuerza el envio del correo de recuperacion al buzon del propio usuario. El audit
// se escribe SOLO si el envio fue exitoso (no antes, no en finally); si el envio
// falla, no hay audit y el error sube al caller.
export async function forcePasswordReset(input: {
  email: string;
}): Promise<Result<null, AppError>> {
  const { user, error: authzError } = await requireAdmin();
  if (authzError) return err(authzError);

  const parsed = forcePasswordResetSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Correo invalido."));
  const { email } = parsed.data;

  const admin = createSupabaseAdminClient();
  const { error: resetError } = await admin.auth.resetPasswordForEmail(email);
  if (resetError) {
    return err(appError("internal", "No se pudo enviar el correo de recuperacion."));
  }

  // Envio exitoso: recien aqui se audita.
  const { ip, userAgent } = await auditContext();
  await db.transaction(async (tx) => {
    await recordAudit(tx, {
      event: "admin.password_reset_forced",
      actorId: user.id,
      actorEmail: user.email,
      entityType: "auth.user",
      entityId: email,
      payload: { email },
      ip,
      userAgent,
    });
  });

  return ok(null);
}

// Offboarding: desactiva (status inactivo, conserva atribucion; no se recicla la
// cuenta, regla 14). Mutacion de dominio + audit en UNA transaccion.
export async function deactivateUser(input: {
  userId: string;
}): Promise<Result<null, AppError>> {
  const { user, error: authzError } = await requireAdmin();
  if (authzError) return err(authzError);

  const parsed = deactivateUserSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Usuario invalido."));
  const { userId } = parsed.data;
  if (userId === user.id) {
    return err(appError("validation", "No puedes desactivar tu propia cuenta."));
  }

  const { ip, userAgent } = await auditContext();
  try {
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(profiles)
        .set({ status: "inactive" })
        .where(eq(profiles.id, userId))
        .returning({ id: profiles.id });
      if (updated.length === 0) throw new NotFoundError();

      await recordAudit(tx, {
        event: "user.deactivated",
        actorId: user.id,
        actorEmail: user.email,
        entityType: "profile",
        entityId: userId,
        ip,
        userAgent,
      });
    });
  } catch (e) {
    if (e instanceof NotFoundError) return err(appError("not_found", "Usuario no encontrado."));
    return err(appError("internal", "No se pudo desactivar el usuario."));
  }

  return ok(null);
}

// Adaptador de formulario para la UI de admin (useActionState).
export async function createUserFormAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const result = await createUser({
    email: String(formData.get("email") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    role: String(formData.get("role") ?? "") as AppRole,
  });
  if (!result.ok) return { error: result.error.message, success: null };
  return { error: null, success: "Usuario creado. Se envio la invitacion por correo." };
}
