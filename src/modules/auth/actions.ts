"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getClientIp } from "@/core/http/client-ip";
import { limitLoginByIp } from "@/core/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  if (hasVerifiedTotp && currentLevel !== "aal2") {
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

// Verifica el codigo TOTP del segundo factor y eleva la sesion a aal2.
export async function verifyMfaAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = mfaCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "El código debe tener 6 dígitos." };

  const supabase = await createSupabaseServerClient();
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) return { error: "No se pudieron leer los factores MFA." };

  const totp = factors?.totp?.[0];
  if (!totp) return { error: "No hay un factor MFA configurado." };

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: totp.id,
  });
  if (challengeError || !challenge) return { error: "No se pudo iniciar el desafio MFA." };

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code: parsed.data.code,
  });
  if (verifyError) return { error: "Código incorrecto. Intenta de nuevo." };

  redirect("/dashboard");
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
  if (error) return { error: "No se pudo fijar la contraseña." };

  cookieStore.delete("atlas-pwd-reset"); // un solo uso
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
