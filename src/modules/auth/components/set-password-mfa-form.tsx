"use client";

import { useActionState } from "react";

import { verifyMfaForPasswordResetAction } from "@/modules/auth/actions";
import type { AuthFormState } from "@/modules/auth/validations";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

const initialState: AuthFormState = { error: null };

// Reto de MFA en el flujo de recuperacion/set-password. El profesional llega de un correo de recuperacion y
// de pronto le piden el segundo factor: el texto explica por que (no se cambia la clave sin confirmar que
// eres tu) y la escotilla (si tambien perdio el factor, el admin lo reinicia). Al verificar, la accion eleva
// a AAL2 y vuelve a /set-password, donde se muestra el formulario de clave.
export function SetPasswordMfaForm() {
  const [state, action, pending] = useActionState(verifyMfaForPasswordResetAction, initialState);

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Para cambiar tu contraseña necesitamos confirmar que eres tú. Ingresa el código de tu aplicación de
        autenticación.
      </p>
      <label className="flex flex-col gap-1">
        <span>Código</span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          className="border p-2"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-red-600">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="border p-2">
        {pending ? "Verificando..." : "Continuar"}
      </button>
      <p className="text-xs text-muted-foreground">
        Si también perdiste el acceso a tu aplicación de autenticación, contacta al administrador para que
        reinicie tu segundo factor; después podrás recuperar la contraseña.
      </p>
    </form>
  );
}
