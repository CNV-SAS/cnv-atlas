"use client";

import { useActionState, useEffect, useState } from "react";

import { startMfaEnroll, verifyMfaEnrollAction } from "@/modules/auth/mfa-actions";
import type { AuthFormState } from "@/modules/auth/validations";

type Enroll = { factorId: string; qrCode: string; secret: string };

const initialState: AuthFormState = { error: null };

export function MfaSetup() {
  const [enroll, setEnroll] = useState<Enroll | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, action, pending] = useActionState(verifyMfaEnrollAction, initialState);

  useEffect(() => {
    let active = true;
    void startMfaEnroll().then((r) => {
      if (!active) return;
      if (r.ok) setEnroll(r.value);
      else setLoadError(r.error.message);
    });
    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return (
      <p role="alert" className="text-red-600">
        {loadError}
      </p>
    );
  }
  if (!enroll) return <p>Generando codigo...</p>;

  return (
    <div className="flex flex-col gap-3">
      <p>Escanea este codigo con tu app de autenticacion (por ejemplo Google Authenticator):</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- QR es un data URL; next/image no aplica */}
      <img src={enroll.qrCode} alt="Codigo QR para configurar MFA" width={200} height={200} />
      <p className="text-sm">
        O ingresa la clave manualmente: <code>{enroll.secret}</code>
      </p>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="factorId" value={enroll.factorId} />
        <label className="flex flex-col gap-1">
          <span>Codigo de 6 digitos</span>
          <input
            name="code"
            inputMode="numeric"
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
          {pending ? "Verificando..." : "Activar MFA"}
        </button>
      </form>
    </div>
  );
}
