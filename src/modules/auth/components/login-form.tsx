"use client";

import { useActionState } from "react";

import { loginAction } from "@/modules/auth/actions";
import type { AuthFormState } from "@/modules/auth/validations";

const initialState: AuthFormState = { error: null };

// UI minima sin marca (B2). El shell con marca llega en B3.
export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <label className="flex flex-col gap-1">
        <span>Correo</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="border p-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>Contrasena</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
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
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
