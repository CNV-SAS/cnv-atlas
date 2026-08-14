"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getClientIp } from "@/core/http/client-ip";
import { limitLoginByIp } from "@/core/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mfaRelaxedForTesting } from "@/modules/auth/mfa-relaxation";

import {
  type AuthFormState,
  forgotPasswordSchema,
  type ForgotPasswordState,
  loginSchema,
  mfaCodeSchema,
  setPasswordSchema,
} from "./validations";

// Login con correo y contrasena. Si el usuario tiene MFA verificada, el AAL pide
// aal2 y se desvia al challenge; si no, va al dashboard. Mensajes de error
// genericos a proposito (no revelar si el correo existe).
export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Correo o contraseña inválidos." };

  // Rate limit: 5/15 min por IP (SECURITY.md).
  const ip = await getClientIp();
  const limit = await limitLoginByIp(ip);
  if (!limit.success) {
    return { error: "Demasiados intentos. Intenta de nuevo en unos minutos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Correo o contraseña incorrectos." };

  // Step-up de MFA: si hay un factor TOTP verificado, la sesion queda en aal1 y
  // se exige subir a aal2. getClaims valida el JWT server-side (como getUser) y
  // expone aal sin tocar el user de getSession (evita la advertencia); listFactors
  // ya usa getUser.
  const [{ data: claimsData }, { data: factors }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.mfa.listFactors(),
  ]);
  const hasVerifiedTotp = (factors?.totp?.length ?? 0) > 0;
  const currentLevel = claimsData?.claims.aal ?? null;
  // El layout salta el enforcement de MFA en pruebas, pero el step-up del login es un camino aparte: una
  // cuenta YA enrolada (como la de quien probo antes) caeria igual al challenge. Con la relajacion activa se
  // salta tambien aqui, para que en pruebas nadie tope el segundo factor. Inerte en produccion (ver
  // mfa-relaxation): produccion apunta a otra base y no coincide.
  if (!mfaRelaxedForTesting() && hasVerifiedTotp && currentLevel !== "aal2") {
    redirect("/mfa-challenge");
  }

  redirect("/dashboard");
}

// "Olvide mi clave" (self-service). Envia el correo de recuperacion de Supabase, cuyo enlace SOLO
// permite fijar una clave nueva (mismo mecanismo que la invitacion: aterriza en /auth/confirm ->
// set-password; no da acceso ni sesion). Anti-enumeracion: SIEMPRE el mismo mensaje, exista el correo
// o no, para no revelar quien es integrante. Rate limit por IP (misma superficie que login).
export async function requestPasswordResetAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  // Formato invalido: se puede decir (no revela existencia de cuenta).
  if (!parsed.success) return { error: "Correo inválido.", sent: false };

  const ip = await getClientIp();
  const limit = await limitLoginByIp(ip);
  if (!limit.success) {
    return { error: "Demasiados intentos. Intenta de nuevo en unos minutos.", sent: false };
  }

  const supabase = await createSupabaseServerClient();
  // El resultado (exista o no el correo) NO se distingue en la respuesta: se ignora el error a
  // proposito para no filtrar existencia. Supabase no envia correo si la cuenta no existe.
  await supabase.auth.resetPasswordForEmail(parsed.data.email);
  return { error: null, sent: true };
}

// Reta el factor TOTP y eleva la sesion a aal2. Lo comparten el login (verifyMfaAction) y la recuperacion
// de clave (verifyMfaForPasswordResetAction): en los dos hay que completar el segundo factor.
async function challengeAndVerifyTotp(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) return { ok: false, error: "No se pudieron leer los factores MFA." };
  const totp = factors?.totp?.[0];
  if (!totp) return { ok: false, error: "No hay un factor MFA configurado." };
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: totp.id });
  if (challengeError || !challenge) return { ok: false, error: "No se pudo iniciar el desafio MFA." };
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) return { ok: false, error: "Código incorrecto. Intenta de nuevo." };
  return { ok: true };
}

// Verifica el codigo TOTP del segundo factor y eleva la sesion a aal2 (login).
export async function verifyMfaAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = mfaCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "El código debe tener 6 dígitos." };
  const supabase = await createSupabaseServerClient();
  const res = await challengeAndVerifyTotp(supabase, parsed.data.code);
  if (!res.ok) return { error: res.error ?? "No se pudo verificar el segundo factor." };
  redirect("/dashboard");
}

// Reto de MFA DENTRO de la recuperacion/set-password. Supabase exige AAL2 para cambiar la clave de una
// cuenta con MFA (insufficient_aal): NO se cambia la contrasena sin el segundo factor (si bastara el correo,
// quien tenga el buzon toma la cuenta y el MFA no protege nada). Eleva a AAL2 y vuelve a /set-password, donde
// ya se muestra el formulario de clave. Exige la cookie atlas-pwd-reset (solo se llega desde un enlace valido).
export async function verifyMfaForPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = mfaCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "El código debe tener 6 dígitos." };
  const cookieStore = await cookies();
  if (cookieStore.get("atlas-pwd-reset")?.value !== "1") {
    return { error: "Enlace no válido o expirado. Solicita uno nuevo." };
  }
  const supabase = await createSupabaseServerClient();
  const res = await challengeAndVerifyTotp(supabase, parsed.data.code);
  if (!res.ok) return { error: res.error ?? "No se pudo verificar el segundo factor." };
  redirect("/set-password");
}

// Fija la contrasena tras invitacion/recuperacion. Exige la cookie atlas-pwd-reset
// que solo pone /auth/confirm tras verificar un token valido server-side: una
// sesion sin ese token no puede llegar aqui. Consume la cookie al terminar.
export async function setPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = setPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const cookieStore = await cookies();
  if (cookieStore.get("atlas-pwd-reset")?.value !== "1") {
    return { error: "Enlace no válido o expirado. Solicita uno nuevo." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sesión no valida. Abre de nuevo el enlace del correo." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    // No se puede diagnosticar lo que no se registra: el error real de Supabase va al log del servidor.
    console.error("setPassword updateUser fallo:", error.status, error.code, error.message);
    // Causas conocidas con mensaje CLARO: un generico hace que el usuario reintente lo mismo (p. ej.
    // volver a poner la misma clave). Cada codigo de Supabase se traduce a algo accionable.
    if (error.code === "insufficient_aal") {
      // Cuenta con MFA sin AAL2: la pagina pide el segundo factor antes de llegar aqui; si aun asi pasa.
      return { error: "Confirma tu segundo factor antes de cambiar la contraseña." };
    }
    if (error.code === "same_password") {
      return { error: "La contraseña nueva tiene que ser distinta de la anterior." };
    }
    if (error.code === "weak_password") {
      return { error: "La contraseña es muy débil. Usa al menos 8 caracteres, combinando letras y números." };
    }
    return { error: "No se pudo fijar la contraseña." };
  }

  cookieStore.delete("atlas-pwd-reset"); // un solo uso
  // Cierra la sesion (TODAS las del usuario) ANTES de mandar a /login. Dos motivos: (1) sin esto el proxy
  // ve una sesion activa al llegar a /login y rebota al panel, que era el bug (redirigia a /dashboard);
  // (2) seguridad: si alguien recupero la cuenta por sospecha de acceso ajeno, la sesion del intruso
  // tambien debe morir (scope global invalida todas las sesiones, no solo esta). Entrar con la clave
  // nueva arranca sesion y pagina limpias, y confirma que la clave quedo bien.
  //
  // ORDEN DE ONBOARDING (deseable, NO optimizar a /dashboard): para un invitado nuevo esto produce el
  // orden correcto -> fija clave -> entra por /login (confirma que la clave sirve) -> el gate de MFA del
  // layout lo manda a /mfa-setup (segundo factor). Primero la clave, despues el factor. No redirigir
  // directo al panel: rompe ese orden y reintroduce el rebote de sesion.
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?mensaje=clave_lista");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
