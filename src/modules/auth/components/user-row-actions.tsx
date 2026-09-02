"use client";

import { useActionState, useState } from "react";

import {
  forcePasswordResetFormAction,
  resetUserMfaFormAction,
  setProfessionalLicenseFormAction,
} from "@/modules/auth/admin-actions";
import type { AdminFormState } from "@/modules/auth/admin-validations";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

const initialState: AdminFormState = { error: null, success: null };

// Acciones de admin sobre un usuario (gate Hito 2): forzar el cambio de clave, reiniciar el segundo
// factor y, para profesionales, registrar su registro profesional. Sin las dos primeras, un integrante
// trabado (clave o telefono perdidos) no tiene salida. Cada accion de acceso abre un panel que RECUERDA
// verificar la identidad por una via distinta antes de ejecutar (SECURITY.md); el reinicio de MFA exige
// un motivo, que queda en el audit. El registro profesional solo aparece si el usuario es profesional.
export function UserRowActions({
  userId,
  email,
  isProfessional = false,
  license = null,
}: {
  userId: string;
  email: string;
  isProfessional?: boolean;
  license?: string | null;
}) {
  const [open, setOpen] = useState<null | "pwd" | "mfa" | "lic">(null);
  const [pwdState, pwdAction, pwdPending] = useActionState(forcePasswordResetFormAction, initialState);
  const [mfaState, mfaAction, mfaPending] = useActionState(resetUserMfaFormAction, initialState);
  const [licState, licAction, licPending] = useActionState(
    setProfessionalLicenseFormAction,
    initialState,
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen(open === "pwd" ? null : "pwd")}
          className="rounded border px-2 py-1 text-xs"
        >
          Forzar cambio de clave
        </button>
        <button
          type="button"
          onClick={() => setOpen(open === "mfa" ? null : "mfa")}
          className="rounded border px-2 py-1 text-xs"
        >
          Reiniciar segundo factor
        </button>
        {isProfessional ? (
          <button
            type="button"
            onClick={() => setOpen(open === "lic" ? null : "lic")}
            className="rounded border px-2 py-1 text-xs"
          >
            {license ? "Editar registro profesional" : "Agregar registro profesional"}
          </button>
        ) : null}
      </div>

      {open === "pwd" ? (
        <form onSubmit={enviarSinReset(pwdAction)} className="flex flex-col gap-2 rounded border p-3">
          <p className="text-xs text-muted-foreground">
            Verifica primero la identidad del usuario por una vía distinta (llamada, en persona). Se le
            enviará un correo para que fije una nueva contraseña; su acceso actual no cambia hasta que lo use.
          </p>
          <input type="hidden" name="email" value={email} />
          {pwdState.error ? (
            <p role="alert" className="text-xs text-red-600">
              {pwdState.error}
            </p>
          ) : null}
          {pwdState.success ? <p className="text-xs text-green-700">{pwdState.success}</p> : null}
          <button type="submit" disabled={pwdPending} className="rounded border px-2 py-1 text-xs">
            {pwdPending ? "Enviando..." : "Confirmar y enviar correo"}
          </button>
        </form>
      ) : null}

      {open === "mfa" ? (
        <form onSubmit={enviarSinReset(mfaAction)} className="flex flex-col gap-2 rounded border p-3">
          <p className="text-xs text-muted-foreground">
            Verifica primero la identidad del usuario por una vía distinta (llamada, en persona). Esto
            elimina su segundo factor; en su próximo ingreso configurará uno nuevo.
          </p>
          <input type="hidden" name="userId" value={userId} />
          <label className="flex flex-col gap-1 text-xs">
            <span>Motivo (obligatorio, queda registrado)</span>
            <input
              name="reason"
              type="text"
              required
              maxLength={500}
              placeholder="Ej.: perdió el teléfono, identidad verificada por llamada"
              className="border p-2"
            />
          </label>
          {mfaState.error ? (
            <p role="alert" className="text-xs text-red-600">
              {mfaState.error}
            </p>
          ) : null}
          {mfaState.success ? <p className="text-xs text-green-700">{mfaState.success}</p> : null}
          <button type="submit" disabled={mfaPending} className="rounded border px-2 py-1 text-xs">
            {mfaPending ? "Reiniciando..." : "Confirmar y reiniciar MFA"}
          </button>
        </form>
      ) : null}

      {open === "lic" ? (
        <form onSubmit={enviarSinReset(licAction)} className="flex flex-col gap-2 rounded border p-3">
          <p className="text-xs text-muted-foreground">
            El registro profesional aparece en el consentimiento que firma el paciente. Si se deja vacío,
            esa línea no aparece en el documento.
          </p>
          <input type="hidden" name="userId" value={userId} />
          <label className="flex flex-col gap-1 text-xs">
            <span>Número de registro profesional</span>
            <input
              name="license"
              type="text"
              maxLength={100}
              defaultValue={license ?? ""}
              placeholder="Número de registro profesional"
              className="border p-2"
            />
          </label>
          {licState.error ? (
            <p role="alert" className="text-xs text-red-600">
              {licState.error}
            </p>
          ) : null}
          {licState.success ? <p className="text-xs text-green-700">{licState.success}</p> : null}
          <button type="submit" disabled={licPending} className="rounded border px-2 py-1 text-xs">
            {licPending ? "Guardando..." : "Guardar registro profesional"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
