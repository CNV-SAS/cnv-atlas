"use client";

import { useCallback, useEffect, useState, useActionState } from "react";

import { startMfaEnroll, verifyMfaEnrollAction } from "@/modules/auth/mfa-actions";
import type { AuthFormState } from "@/modules/auth/validations";

type Enroll = { factorId: string; qrCode: string; secret: string };

const initialState: AuthFormState = { error: null };

export function MfaSetup() {
  const [enroll, setEnroll] = useState<Enroll | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, action, pending] = useActionState(verifyMfaEnrollAction, initialState);

  // Genera el factor. Si falla (o la accion rechaza), muestra el error y ofrece reintentar: nunca se
  // queda colgado en "Generando codigo...". El reintento vuelve a llamar a startMfaEnroll, que limpia
  // el factor a medias del intento anterior antes de crear otro. Solo toca estado en los callbacks
  // async (no sincronamente dentro del effect).
  const runEnroll = useCallback((signal?: { active: boolean }) => {
    startMfaEnroll()
      .then((r) => {
        if (signal && !signal.active) return;
        if (r.ok) setEnroll(r.value);
        else setLoadError(r.error.message);
      })
      .catch(() => {
        if (signal && !signal.active) return;
        setLoadError("No se pudo generar el código. Reintenta.");
      })
      .finally(() => {
        if (signal && !signal.active) return;
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const signal = { active: true };
    runEnroll(signal);
    return () => {
      signal.active = false;
    };
  }, [runEnroll]);

  // Reintento manual (event handler, no effect): aqui si se resetea el estado antes de relanzar.
  function retry() {
    setLoading(true);
    setLoadError(null);
    runEnroll();
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="text-red-600">
          {loadError}
        </p>
        <button type="button" onClick={retry} disabled={loading} className="border p-2">
          {loading ? "Generando..." : "Reintentar"}
        </button>
      </div>
    );
  }
  if (!enroll) return <p>Generando código...</p>;

  return (
    <div className="flex flex-col gap-3">
      {/* Explica QUE es y POR QUE, para que un profesional que no conoce TOTP no se quede trabado. */}
      <p className="text-sm text-muted-foreground">
        Para proteger las historias clinicas de tus pacientes, Atlas pide un segundo factor al iniciar
        sesion. Instala una app de autenticacion (Google Authenticator, Authy o similar) en tu telefono
        y escanea el codigo. Cada vez que entres, la app te dara un codigo de 6 digitos.
      </p>
      <p>Escanea este código con tu app de autenticación (por ejemplo Google Authenticator):</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- QR es un data URL; next/image no aplica */}
      <img src={enroll.qrCode} alt="Código QR para configurar MFA" width={200} height={200} />
      <p className="text-sm">
        O ingresa la clave manualmente: <code>{enroll.secret}</code>
      </p>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="factorId" value={enroll.factorId} />
        <label className="flex flex-col gap-1">
          <span>Código de 6 dígitos</span>
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
      {/* (c) recuperacion: si pierde el telefono, el admin lo desbloquea (resetUserMfa). */}
      <p className="text-xs text-muted-foreground">
        Si pierdes acceso a tu app de autenticacion (cambio de telefono, app borrada), contacta al
        administrador para que reinicie tu segundo factor.
      </p>
    </div>
  );
}
