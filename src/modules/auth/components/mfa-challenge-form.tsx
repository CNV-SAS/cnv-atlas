"use client";

import { useActionState } from "react";

import { verifyMfaAction } from "@/modules/auth/actions";
import type { AuthFormState } from "@/modules/auth/validations";

const initialState: AuthFormState = { error: null };

export function MfaChallengeForm() {
  const [state, action, pending] = useActionState(verifyMfaAction, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span>Codigo</span>
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
        {pending ? "Verificando..." : "Verificar"}
      </button>
    </form>
  );
}
