"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { guardarContactoPacienteAction } from "../actions";
import type { ContactoPacienteState } from "../types";

const VACIO: ContactoPacienteState = { error: null, success: null, warning: null };

// CORREGIR EL CORREO Y EL TELEFONO DEL PACIENTE.
//
// SE ABRE, NO ESTA ABIERTO. La ficha es para LEER; el formulario aparece al pulsar "Corregir". Un par de
// campos editables permanentes invita a teclear encima de un dato bueno, y estos dos deciden a donde va
// la documentacion clinica del paciente.
//
// EL FORMULARIO VIENE RELLENO con lo que hay: corregir un correo mal escrito es cambiar dos letras, no
// volver a teclearlo entero. Y se puede dejar vacio a proposito (ver el writer): un correo equivocado es
// peor que ninguno, porque el envio se da por bueno y no llega a nadie.
//
// El envio va por `enviarSinReset` (onSubmit + startTransition) y NO por la prop `action`: la prop
// resetea los campos tras la accion, y un error borraria lo que el profesional acaba de escribir (hazard
// de React 19 registrado en CLAUDE.md).
export function EditarContacto({
  patientId,
  email,
  phone,
}: {
  patientId: string;
  email: string | null;
  phone: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, pending] = useActionState(guardarContactoPacienteAction, VACIO);
  useFormToastAndRefresh(state);

  // AL GUARDAR SE CIERRA, igual que al cancelar (Santiago, 2026-09-19). La pagina se refresca y trae el
  // contacto nuevo, pero el formulario seguia abierto TAPANDO la tarjeta que acaba de cambiar: parecia que
  // no habia pasado nada. Es el mismo defecto que ya se corrigio en "en gestion", y por eso se resuelve
  // igual: ajustando el estado durante el render, no en un efecto (regla de lint set-state-in-effect).
  const [estadoVisto, setEstadoVisto] = useState(state);
  if (state !== estadoVisto) {
    setEstadoVisto(state);
    if (state.success) setAbierto(false);
  }

  if (!abierto) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}>
          Corregir el contacto
        </Button>
        {!email ? (
          // SE DICE LO QUE FALTA Y QUE IMPIDE. Sin correo, el reporte y la historia clinica no salen, y
          // eso hoy se descubria al intentar enviarlos, con el paciente ya fuera del consultorio.
          <p className="text-xs text-muted-foreground">
            Sin correo no se le puede enviar su reporte ni su historia clínica.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={enviarSinReset(formAction)}
      className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <input type="hidden" name="patientId" value={patientId} />
      <div className="flex flex-col gap-1">
        <label htmlFor={`email-${patientId}`} className="text-xs text-muted-foreground">
          Correo
        </label>
        <input
          id={`email-${patientId}`}
          name="email"
          type="email"
          defaultValue={email ?? ""}
          maxLength={160}
          placeholder="correo@ejemplo.com"
          className="w-full rounded-md border border-input bg-background p-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`phone-${patientId}`} className="text-xs text-muted-foreground">
          Teléfono
        </label>
        <input
          id={`phone-${patientId}`}
          name="phone"
          type="tel"
          defaultValue={phone ?? ""}
          maxLength={40}
          placeholder="300 000 0000"
          className="w-full rounded-md border border-input bg-background p-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Solo el contacto. El nombre, el documento y la fecha de nacimiento no se corrigen aquí: cambian la
        identidad con la que el paciente firmó su consentimiento.
      </p>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
