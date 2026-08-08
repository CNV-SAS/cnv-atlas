"use client";

import { useEffect, useRef, useState, useActionState } from "react";

import { startMfaEnroll, verifyMfaEnrollAction } from "@/modules/auth/mfa-actions";
import type { AuthFormState } from "@/modules/auth/validations";

type Enroll = { factorId: string; qrCode: string; secret: string };
type EnrollPromise = ReturnType<typeof startMfaEnroll>;

const initialState: AuthFormState = { error: null };

export function MfaSetup() {
  const [enroll, setEnroll] = useState<Enroll | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, action, pending] = useActionState(verifyMfaEnrollAction, initialState);

  // El enroll se pide UNA sola vez y se cachea en un ref. En modo estricto de React (dev) el effect
  // corre dos veces; sin el cache se hacian DOS llamadas al servidor que competian y dejaban la
  // pantalla colgada en "Generando codigo..." (la respuesta llegaba, pero al effect ya desmontado).
  // Con el ref, la segunda montada reusa la MISMA promesa y el effect que sigue activo aplica la
  // respuesta. El estado de carga se apaga en TODOS los caminos (exito, error de la accion, rechazo):
  // nunca se queda cargando con la respuesta en la mano.
  const enrollPromiseRef = useRef<EnrollPromise | null>(null);

  function applyResult(r: Awaited<EnrollPromise>) {
    if (r.ok) setEnroll(r.value);
    else setLoadError(r.error.message);
  }

  useEffect(() => {
    let active = true;
    if (!enrollPromiseRef.current) enrollPromiseRef.current = startMfaEnroll();
    enrollPromiseRef.current
      .then((r) => {
        if (active) applyResult(r);
      })
      .catch(() => {
        if (active) setLoadError("No se pudo generar el código. Reintenta.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Reintento manual (event handler): descarta la promesa cacheada y pide un enroll nuevo. startMfaEnroll
  // limpia el factor a medias del intento anterior antes de crear otro.
  function retry() {
    setLoading(true);
    setLoadError(null);
    setEnroll(null);
    const p = startMfaEnroll();
    enrollPromiseRef.current = p;
    p.then(applyResult)
      .catch(() => setLoadError("No se pudo generar el código. Reintenta."))
      .finally(() => setLoading(false));
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
