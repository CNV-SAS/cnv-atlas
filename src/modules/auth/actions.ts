"use server";

import { redirect } from "next/navigation";

import { getClientIp } from "@/core/http/client-ip";
import { limitLoginByIp } from "@/core/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { loginSchema, mfaCodeSchema, type AuthFormState } from "./validations";

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

  // Step-up de MFA: si hay un factor verificado, la sesion queda en aal1 y el
  // siguiente nivel exigido es aal2.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
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

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
