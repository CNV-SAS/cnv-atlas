"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { appError, err, ok, type AppError, type Result } from "@/core/errors";
import { getClientIp } from "@/core/http/client-ip";
import { reportServerError } from "@/lib/observability/report-error";
import { db } from "@/db";
import { professionalProfiles, profiles, roles, userRoles } from "@/db/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/modules/audit/log";

import {
  createUserSchema,
  deactivateUserSchema,
  forcePasswordResetSchema,
  resetUserMfaSchema,
  rolDeUsuarioSchema,
  setProfessionalLicenseSchema,
  type AdminFormState,
  type CreateUserInput,
  type Profession,
} from "./admin-validations";
import { canManageUsers } from "./policies/can-manage-users";
import { getCurrentUser } from "./session";
import type { AppRole } from "./roles";

class RoleNotFoundError extends Error {}
class NotFoundError extends Error {}

// Autorizacion comun: sesion + policy. Nunca por role=== suelto (regla 3).
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: appError("unauthorized", "Inicia sesión.") };
  if (!canManageUsers(user)) {
    return { user: null, error: appError("forbidden", "No tienes permiso para esta acción.") };
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
  if (!parsed.success) return err(appError("validation", "Datos inválidos."));
  const { email, fullName, role, profession, license } = parsed.data;
  // Vacio o ausente => sin registro (null). No se guarda una cadena vacia (seria una "raya" en blanco).
  const licenseValue = license && license.length > 0 ? license : null;

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
        // profession!: la validacion (superRefine) garantiza que viene para el rol professional, asi
        // que un integrante nuevo nunca nace con profession null (bloquearia sus escrituras de
        // tratamiento). La columna es NOT NULL (migracion 0036); la asercion la respalda el refine.
        // license: opcional al crear (puede llegar despues via setProfessionalLicense).
        await tx
          .insert(professionalProfiles)
          .values({ profileId: newUserId, profession: profession!, license: licenseValue });
      }

      await recordAudit(tx, {
        event: "user.created",
        actorId: user.id,
        actorEmail: user.email,
        entityType: "profile",
        entityId: newUserId,
        payload: {
          email,
          role,
          ...(role === "professional" ? { profession, license: licenseValue } : {}),
        },
        ip,
        userAgent,
      });
    });
  } catch (e) {
    // La causa REAL (no visible al usuario) va al log Y a Sentry: sin esto, un fallo en produccion no
    // deja rastro y quedamos ciegos con los integrantes adentro. Un fallo de conexion de `db` (p. ej.
    // DATABASE_URL directa en vez del pooler en serverless) aparece aqui.
    reportServerError("createUser.transaccion", e);
    // Compensa: borra el auth user para no dejar un profile huerfano sin rol/audit. Si la compensacion
    // TAMBIEN falla, es un usuario a medias (auth creado, sin rol ni audit): al log con el id y a Sentry.
    const { error: delError } = await admin.auth.admin.deleteUser(newUserId);
    if (delError) {
      console.error("createUser: usuario a medias, deleteUser fallo para", newUserId);
      reportServerError("createUser.compensacion", delError);
    }
    if (e instanceof RoleNotFoundError) {
      return err(appError("validation", "El rol indicado no existe."));
    }
    return err(appError("internal", "No se pudo completar la creación del usuario."));
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
  if (!parsed.success) return err(appError("validation", "Correo inválido."));
  const { email } = parsed.data;

  const admin = createSupabaseAdminClient();
  const { error: resetError } = await admin.auth.resetPasswordForEmail(email);
  if (resetError) {
    return err(appError("internal", "No se pudo enviar el correo de recuperación."));
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

// Desbloqueo de MFA (recuperacion del segundo factor). Con MFA obligatoria para profesionales, un
// integrante que pierde el telefono queda fuera; el admin reinicia sus factores TOTP y en el proximo
// login vuelve al enroll. Es el equivalente de "olvide mi clave" para el 2FA. Audit inline.
export async function resetUserMfa(input: {
  userId: string;
  reason: string;
}): Promise<Result<null, AppError>> {
  const { user, error: authzError } = await requireAdmin();
  if (authzError) return err(authzError);

  const parsed = resetUserMfaSchema.safeParse(input);
  if (!parsed.success) {
    // El motivo vacio es el error esperable mas comun; se distingue del usuario invalido.
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos.";
    return err(appError("validation", msg));
  }
  const { userId, reason } = parsed.data;

  const admin = createSupabaseAdminClient();
  const { data: list, error: listErr } = await admin.auth.admin.mfa.listFactors({ userId });
  if (listErr) return err(appError("internal", "No se pudieron leer los factores MFA del usuario."));
  const factors = list?.factors ?? [];
  for (const f of factors) {
    const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId });
    if (delErr) return err(appError("internal", "No se pudo reiniciar el factor MFA."));
  }

  const { ip, userAgent } = await auditContext();
  await db.transaction(async (tx) => {
    await recordAudit(tx, {
      event: "admin.mfa_reset",
      actorId: user.id,
      actorEmail: user.email,
      entityType: "auth.user",
      entityId: userId,
      payload: { factors_removed: factors.length, reason },
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
  if (!parsed.success) return err(appError("validation", "Usuario inválido."));
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
    reportServerError("deactivateUser", e);
    return err(appError("internal", "No se pudo desactivar el usuario."));
  }

  return ok(null);
}

// Registra o edita el registro profesional (licencia) de un profesional. Existe aparte de la invitacion
// porque las licencias suelen llegar despues. Vacio => null (sin registro; el consentimiento omite esa
// linea). Escritura de dominio + audit en UNA transaccion. Solo profesionales (professional_profiles).
export async function setProfessionalLicense(input: {
  userId: string;
  license: string;
}): Promise<Result<null, AppError>> {
  const { user, error: authzError } = await requireAdmin();
  if (authzError) return err(authzError);

  const parsed = setProfessionalLicenseSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Datos inválidos."));
  const { userId, license } = parsed.data;
  const licenseValue = license.length > 0 ? license : null; // vacio => sin registro (no una raya)

  const { ip, userAgent } = await auditContext();
  try {
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(professionalProfiles)
        .set({ license: licenseValue })
        .where(eq(professionalProfiles.profileId, userId))
        .returning({ id: professionalProfiles.id });
      // Sin fila => el usuario no es profesional (o no existe): no se crea perfil profesional aqui.
      if (updated.length === 0) throw new NotFoundError();

      await recordAudit(tx, {
        event: "admin.professional_license_set",
        actorId: user.id,
        actorEmail: user.email,
        entityType: "professional_profile",
        entityId: userId,
        payload: { license: licenseValue },
        ip,
        userAgent,
      });
    });
  } catch (e) {
    if (e instanceof NotFoundError) {
      return err(appError("not_found", "Ese usuario no es un profesional."));
    }
    reportServerError("setProfessionalLicense", e);
    return err(appError("internal", "No se pudo registrar el registro profesional."));
  }

  return ok(null);
}

// Adaptador de formulario para la UI de admin (useActionState).
export async function createUserFormAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const role = String(formData.get("role") ?? "") as AppRole;
  const professionRaw = formData.get("profession");
  const licenseRaw = formData.get("license");
  const result = await createUser({
    email: String(formData.get("email") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    role,
    // Solo para el rol professional; el schema la exige/ignora segun el rol. Si el select no se
    // renderizo (rol interno), no viene en el FormData y queda undefined (no cuelga un valor viejo).
    profession: professionRaw ? (String(professionRaw) as Profession) : undefined,
    // Registro profesional opcional (mismo bloque que la profesion, solo para professional).
    license: licenseRaw ? String(licenseRaw) : undefined,
  });
  if (!result.ok) return { error: result.error.message, success: null };
  return { error: null, success: "Usuario creado. Se envio la invitación por correo." };
}

// Adaptador de formulario: forzar el correo de recuperacion a un usuario (UI de admin). Recuerda
// verificar la identidad por una via distinta ANTES (la confirmacion de la UI lo advierte, SECURITY.md).
export async function forcePasswordResetFormAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const result = await forcePasswordReset({ email: String(formData.get("email") ?? "") });
  if (!result.ok) return { error: result.error.message, success: null };
  return { error: null, success: "Se envió el correo para que el usuario fije una nueva contraseña." };
}

// Adaptador de formulario: reiniciar el segundo factor de un usuario (UI de admin). El motivo es
// obligatorio (queda en el audit). Igual que arriba: verificar identidad por otra via antes.
export async function resetUserMfaFormAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const result = await resetUserMfa({
    userId: String(formData.get("userId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!result.ok) return { error: result.error.message, success: null };
  return {
    error: null,
    success: "Segundo factor reiniciado. En su próximo ingreso configurará uno nuevo.",
  };
}

// Adaptador de formulario: registrar/editar el registro profesional de un profesional (UI de admin).
export async function setProfessionalLicenseFormAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const result = await setProfessionalLicense({
    userId: String(formData.get("userId") ?? ""),
    license: String(formData.get("license") ?? ""),
  });
  if (!result.ok) return { error: result.error.message, success: null };
  return { error: null, success: "Registro profesional guardado." };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS ROLES DE UN USUARIO QUE YA EXISTE  ·  AÑADIR Y QUITAR  (Santiago, 2026-10-24)
//
// ═══ DE DONDE SALE ═══
//
// *"Gildardo queda con profesional y obbia a la vez. Asignale el rol obbia."*
//
// `user_roles` es N:N desde el principio y `hasAnyRole` ya soporta varios, pero el UNICO sitio que
// escribia esa tabla era `createUser`, al nacer la cuenta y con UN rol. O sea: el modelo admitia dos roles
// y el sistema no tenia forma de dar el segundo. Un mecanismo sin superficie que lo alcance hace creer que
// la regla ya se puede aplicar, y aqui la unica via era SQL a mano.
//
// ═══ Y SI SE PUEDE DAR, TIENE QUE PODERSE QUITAR ═══
//
// Dar el rol por script y no construir el camino de vuelta deja a CNV con un permiso que solo se revoca
// pidiendole a alguien que escriba SQL contra produccion. Las dos direcciones van juntas.
//
// ═══ DOS FRENOS, Y CADA UNO SU RAZON ═══
//
//   · NO SE QUITA EL ULTIMO ROL. Un usuario sin ningun rol puede entrar y no ve nada: se parece a un
//     defecto, no a una baja. Para dar de baja existe el camino que ya existe (desactivar la cuenta), y es
//     el que la regla dura 14 nombra.
//   · NADIE SE QUITA SU PROPIO `admin`. Es el unico movimiento que se puede hacer sin poder deshacerlo:
//     al terminar, quien lo hizo ya no tiene permiso para volver a ponerselo.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

class UltimoRolError extends Error {}
class YaLoTieneError extends Error {}
class NoLoTieneError extends Error {}

export async function agregarRolAUsuario(input: {
  userId: string;
  rol: AppRole;
}): Promise<Result<null, AppError>> {
  const { user, error: authzError } = await requireAdmin();
  if (authzError) return err(authzError);

  const parsed = rolDeUsuarioSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Datos inválidos."));
  const { userId, rol } = parsed.data;

  const { ip, userAgent } = await auditContext();
  try {
    await db.transaction(async (tx) => {
      const [elUsuario] = await tx
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      if (!elUsuario) throw new NotFoundError();

      const [elRol] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.name, rol)).limit(1);
      if (!elRol) throw new RoleNotFoundError();

      // YA LO TIENE: no es un error de la base (la clave primaria lo absorberia en silencio con un
      // `onConflictDoNothing`), es una respuesta distinta en la pantalla. Un "listo" sobre algo que no
      // paso deja creer que se hizo un cambio.
      const suyos = await tx
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .where(eq(userRoles.userId, userId));
      if (suyos.some((r) => r.roleId === elRol.id)) throw new YaLoTieneError();

      await tx.insert(userRoles).values({ userId, roleId: elRol.id });

      await recordAudit(tx, {
        event: "admin.rol_agregado",
        actorId: user.id,
        actorEmail: user.email,
        entityType: "profile",
        entityId: userId,
        payload: { rol, rolesQueTenia: suyos.length },
        ip,
        userAgent,
      });
    });
  } catch (e) {
    if (e instanceof NotFoundError) return err(appError("not_found", "Ese usuario no existe."));
    if (e instanceof RoleNotFoundError) return err(appError("validation", "Ese rol no existe."));
    if (e instanceof YaLoTieneError) {
      return err(appError("conflict", "Ya tiene ese rol, así que no se cambió nada."));
    }
    reportServerError("agregarRolAUsuario", e);
    return err(appError("internal", "No se pudo asignar el rol."));
  }
  return ok(null);
}

export async function quitarRolAUsuario(input: {
  userId: string;
  rol: AppRole;
}): Promise<Result<null, AppError>> {
  const { user, error: authzError } = await requireAdmin();
  if (authzError) return err(authzError);

  const parsed = rolDeUsuarioSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Datos inválidos."));
  const { userId, rol } = parsed.data;

  // NADIE SE QUITA SU PROPIO ADMIN: es el unico movimiento irreversible por quien lo hace.
  if (userId === user.id && rol === "admin") {
    return err(
      appError(
        "validation",
        "No puedes quitarte tu propio rol de admin: al terminar no tendrías permiso para devolvértelo. " +
          "Pídeselo a otro admin.",
      ),
    );
  }

  const { ip, userAgent } = await auditContext();
  try {
    await db.transaction(async (tx) => {
      const [elRol] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.name, rol)).limit(1);
      if (!elRol) throw new RoleNotFoundError();

      const suyos = await tx
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .where(eq(userRoles.userId, userId));
      if (!suyos.some((r) => r.roleId === elRol.id)) throw new NoLoTieneError();
      // EL ULTIMO NO SE QUITA: un usuario sin rol entra y no ve nada, que se parece a un defecto y no a
      // una baja. La baja tiene su propio camino (desactivar la cuenta), el que nombra la regla dura 14.
      if (suyos.length <= 1) throw new UltimoRolError();

      await tx
        .delete(userRoles)
        .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, elRol.id)));

      await recordAudit(tx, {
        event: "admin.rol_quitado",
        actorId: user.id,
        actorEmail: user.email,
        entityType: "profile",
        entityId: userId,
        payload: { rol, rolesQueLeQuedan: suyos.length - 1 },
        ip,
        userAgent,
      });
    });
  } catch (e) {
    if (e instanceof RoleNotFoundError) return err(appError("validation", "Ese rol no existe."));
    if (e instanceof NoLoTieneError) {
      return err(appError("conflict", "No tiene ese rol, así que no se cambió nada."));
    }
    if (e instanceof UltimoRolError) {
      return err(
        appError(
          "validation",
          "Es su único rol: quitárselo lo dejaría entrando a un Atlas sin nada, que parece un defecto y " +
            "no una baja. Para darlo de baja, desactiva la cuenta.",
        ),
      );
    }
    reportServerError("quitarRolAUsuario", e);
    return err(appError("internal", "No se pudo quitar el rol."));
  }
  return ok(null);
}

// Adaptadores de formulario (useActionState). El rol viaja en un campo oculto por boton, asi que cada
// boton manda el suyo: el `name`/`value` del BOTON no viajaria con un envio propio (hazard 5).
export async function agregarRolFormAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const r = await agregarRolAUsuario({
    userId: String(formData.get("userId") ?? ""),
    rol: String(formData.get("rol") ?? "") as AppRole,
  });
  if (!r.ok) return { error: r.error.message, success: null };
  return { error: null, success: "Rol asignado. Tendrá efecto cuando vuelva a entrar." };
}

export async function quitarRolFormAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const r = await quitarRolAUsuario({
    userId: String(formData.get("userId") ?? ""),
    rol: String(formData.get("rol") ?? "") as AppRole,
  });
  if (!r.ok) return { error: r.error.message, success: null };
  return { error: null, success: "Rol retirado. Tendrá efecto cuando vuelva a entrar." };
}
