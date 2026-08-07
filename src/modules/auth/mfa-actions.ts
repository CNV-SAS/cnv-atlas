"use server";

import { redirect } from "next/navigation";
import QRCode from "qrcode";

import { appError, err, ok, type AppError, type Result } from "@/core/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { mfaCodeSchema, type AuthFormState } from "./validations";

// Inicia el registro de un factor TOTP. El factor nace en estado 'unverified';
// solo se activa cuando verifyMfaEnrollAction confirma un codigo. Limpia factores
// TOTP sin verificar previos para que un enroll abandonado no bloquee el siguiente.
//
// NUNCA lanza: cualquier fallo se devuelve dentro de Result. Un throw sin manejar
// aqui dejaba la pagina de setup colgada para siempre en "Generando codigo..." (la
// llamada del cliente no tenia .catch), lo que bloqueaba el alta de todo profesional nuevo.
export async function startMfaEnroll(): Promise<
  Result<{ factorId: string; qrCode: string; secret: string }, AppError>
> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err(appError("unauthorized", "Inicia sesión."));

    // Limpia factores TOTP sin verificar de un intento anterior. Verificado (repro) que
    // unenroll SI quita un factor unverified desde aal1, asi que reintentar tras abandonar funciona.
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const stale = (factors?.all ?? []).filter(
      (f) => f.factor_type === "totp" && f.status === "unverified",
    );
    for (const f of stale) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) {
      // La causa real (que no se muestra al usuario) va al log del servidor para poder diagnosticar.
      console.error("startMfaEnroll enroll fallo:", error?.status, error?.code, error?.message);
      return err(appError("internal", "No se pudo generar el código. Recarga la página para reintentar."));
    }

    // QR desde la URI otpauth con la libreria qrcode (sin dangerouslySetInnerHTML).
    const qrCode = await QRCode.toDataURL(data.totp.uri);
    return ok({ factorId: data.id, qrCode, secret: data.totp.secret });
  } catch (e) {
    console.error("startMfaEnroll excepcion:", e);
    return err(appError("internal", "No se pudo generar el código. Recarga la página para reintentar."));
  }
}

// Verifica el codigo TOTP. Solo aqui el factor pasa de unverified a verified y la
// sesion sube a aal2.
export async function verifyMfaEnrollAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const factorId = String(formData.get("factorId") ?? "");
  const parsed = mfaCodeSchema.safeParse({ code: formData.get("code") });
  if (!factorId || !parsed.success) return { error: "Código inválido." };

  const supabase = await createSupabaseServerClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (challengeError || !challenge) return { error: "No se pudo iniciar el desafio." };

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: parsed.data.code,
  });
  if (verifyError) return { error: "Código incorrecto. Intenta de nuevo." };

  redirect("/dashboard");
}
