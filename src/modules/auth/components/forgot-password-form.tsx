"use client";

import { useActionState } from "react";

import { requestPasswordResetAction } from "@/modules/auth/actions";
import type { ForgotPasswordState } from "@/modules/auth/validations";

const initialState: ForgotPasswordState = { error: null, sent: false };

// "Olvide mi clave". El mensaje de exito es el MISMO exista o no el correo (anti-enumeracion): no
// confirma que la cuenta exista, solo que si existe recibira el enlace.
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialState);

  if (state.sent) {
    return (
      <p role="status" className="text-sm">
        Si ese correo tiene una cuenta, te enviamos un enlace para restablecer tu clave. Revisa tu
        bandeja (y el spam). El enlace solo sirve para fijar una clave nueva.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <label className="flex flex-col gap-1">
        <span>Correo</span>
        <input name="email" type="email" autoComplete="email" required className="border p-2" />
      </label>
      {state.error ? (
        <p role="alert" className="text-red-600">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="border p-2">
        {pending ? "Enviando..." : "Enviar enlace de recuperación"}
      </button>
    </form>
  );
}
