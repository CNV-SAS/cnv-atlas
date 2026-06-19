"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getClientIp } from "@/core/http/client-ip";
import { limitLoginByIp } from "@/core/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  loginSchema,
  mfaCodeSchema,
  setPasswordSchema,
  type AuthFormState,
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
  if (!parsed.success) return { error: "Correo o contrasena invalidos." };

  // Rate limit: 5/15 min por IP (SECURITY.md).
  const ip = await getClientIp();
  const limit = await limitLoginByIp(ip);
  if (!limit.success) {
    return { error: "Demasiados intentos. Intenta de nuevo en unos minutos." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Correo o contrasena incorrectos." };

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

// Verifica el codigo TOTP del segundo factor y eleva la sesion a aal2.
export async function verifyMfaAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = mfaCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "El codigo debe tener 6 digitos." };

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
  if (verifyError) return { error: "Codigo incorrecto. Intenta de nuevo." };

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
    return { error: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }

  const cookieStore = await cookies();
  if (cookieStore.get("atlas-pwd-reset")?.value !== "1") {
    return { error: "Enlace no valido o expirado. Solicita uno nuevo." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sesion no valida. Abre de nuevo el enlace del correo." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "No se pudo fijar la contrasena." };

  cookieStore.delete("atlas-pwd-reset"); // un solo uso
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
