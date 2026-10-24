"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { completarFechaDeNacimientoAction } from "../actions";
import type { SexoPacienteState } from "../types";

const VACIO: SexoPacienteState = { error: null, success: null, warning: null };

// COMPLETAR LA FECHA DE NACIMIENTO DE UN PACIENTE AL QUE LE FALTA.
//
// ── SE VE, NO SE ABRE AL PULSAR ───────────────────────────────────────────────────────────────────
//
// Misma decision que el bloque del sexo, y por la misma razon: aqui el dato FALTA y BLOQUEA el
// diagnostico. Esconderlo detras de un boton repetiria el defecto que esto arregla, que es llegar a la
// pestaña Diagnostico sin ninguna pista de que falta un dato ni de donde ponerlo.
//
// ── POR QUE DICE QUE IMPIDE, Y NO SOLO QUE FALTA ──────────────────────────────────────────────────
//
// Porque "falta la fecha de nacimiento" se lee como un hueco de papeleria. Lo que de verdad pasa es que
// la edad entra al diagnostico por cuatro puertas (el indice de aceleracion del envejecimiento, la
// clasificacion de capacitancia, el gasto calorico y el aviso de los 65+), y hasta hoy una fecha ausente
// se convertia en edad CERO sin que nada en pantalla lo dijera.
//
// El envio va por `enviarSinReset` (onSubmit + startTransition) y NO por la prop `action`: la prop
// resetea los campos tras la accion (hazard de React 19 registrado en CLAUDE.md).
export function CompletarFechaDeNacimiento({ patientId }: { patientId: string }) {
  const [state, formAction, pending] = useActionState(completarFechaDeNacimientoAction, VACIO);
  useFormToastAndRefresh(state);

  return (
    <form
      onSubmit={enviarSinReset(formAction)}
      className="flex w-full flex-col gap-3 rounded-xl border border-clinical-warning bg-clinical-warning-bg p-4"
    >
      <input type="hidden" name="patientId" value={patientId} />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-clinical-warning">
          Falta la fecha de nacimiento de este paciente
        </p>
        <p className="max-w-prose text-sm text-foreground">
          Sin ella no se le puede generar el diagnóstico: la edad entra en el índice de aceleración del
          envejecimiento, en la clasificación de capacitancia y en el gasto calórico. Regístrala y vuelve a
          la consulta.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`nacimiento-${patientId}`} className="text-xs text-muted-foreground">
            Fecha de nacimiento
          </label>
          <input
            id={`nacimiento-${patientId}`}
            name="birthDate"
            type="date"
            required
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando..." : "Registrar la fecha"}
        </Button>
      </div>
      {/* LO QUE PUEDE DESTAPAR, DICHO ANTES DE PULSAR. Si resulta que el paciente era menor de edad el día
          que firmó, su consentimiento pasa a quedar "pendiente de regularizar", y es mejor que quien lo
          registra lo sepa que descubrirlo después en la lista. */}
      <p className="text-xs text-muted-foreground">
        Revísala con el paciente antes de guardarla: no se puede cambiar desde aquí después. Si resulta que
        era menor de edad el día que firmó el consentimiento, la ficha lo señalará como pendiente de
        regularizar. Un diagnóstico ya emitido no se recalcula solo.
      </p>
    </form>
  );
}
