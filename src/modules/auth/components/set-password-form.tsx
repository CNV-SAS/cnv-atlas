"use client";

import { useActionState } from "react";

import { setPasswordAction } from "@/modules/auth/actions";
import type { AuthFormState } from "@/modules/auth/validations";

const initialState: AuthFormState = { error: null };

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(setPasswordAction, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span>Nueva contrasena</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="border p-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>Confirmar contrasena</span>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
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
        {pending ? "Guardando..." : "Guardar contrasena"}
      </button>
    </form>
  );
}
