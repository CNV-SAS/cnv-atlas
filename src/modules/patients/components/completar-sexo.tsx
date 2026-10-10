"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { completarSexoPacienteAction } from "../actions";
import type { SexoPacienteState } from "../types";

const VACIO: SexoPacienteState = { error: null, success: null, warning: null };

// COMPLETAR EL SEXO DE UN PACIENTE AL QUE LE FALTA.
//
// ── ESTE NO SE ABRE AL PULSAR, COMO EL DEL CONTACTO. ESTE SE VE ───────────────────────────────────
//
// Y es una diferencia deliberada. El del contacto vive detras de un boton porque la ficha es para LEER y
// ahi el dato ya existe: un campo editable permanente invita a teclear encima de algo bueno. Aqui el dato
// FALTA y BLOQUEA el diagnostico, asi que esconderlo repetiria exactamente el defecto que esto arregla:
// una integrante con la paciente delante, la pestaña Diagnostico caida, y ninguna pista de que faltaba un
// dato ni de donde ponerlo.
//
// ── POR QUE DICE QUE IMPIDE, Y NO SOLO QUE FALTA ──────────────────────────────────────────────────
//
// Porque "falta el sexo" se lee como un hueco de papeleria. Lo que de verdad pasa es que el modelo no
// puede clasificar a nadie sin el: todas sus clasificaciones son distintas para mujer y para hombre. Si el
// aviso no lo dice, el dato se queda sin poner.
//
// ── Y SE DICE QUE NO SE PODRA CAMBIAR ─────────────────────────────────────────────────────────────
//
// El writer rellena el hueco y nunca pisa un valor (ver `patient-sex-writer`), asi que esto se elige UNA
// vez. Quien lo va a pulsar tiene que saberlo ANTES, no descubrirlo despues al querer corregirse.
//
// El envio va por `enviarSinReset` (onSubmit + startTransition) y NO por la prop `action`: la prop resetea
// los campos tras la accion (hazard de React 19 registrado en CLAUDE.md).
export function CompletarSexo({ patientId }: { patientId: string }) {
  const [state, formAction, pending] = useActionState(completarSexoPacienteAction, VACIO);
  useFormToastAndRefresh(state);

  return (
    <form
      onSubmit={enviarSinReset(formAction)}
      className="flex w-full flex-col gap-3 rounded-xl border border-clinical-warning bg-clinical-warning-bg p-4"
    >
      <input type="hidden" name="patientId" value={patientId} />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-clinical-warning">Falta el sexo de este paciente</p>
        <p className="max-w-prose text-sm text-foreground">
          Sin ese dato no se le puede generar el diagnóstico: todas las clasificaciones del modelo son
          distintas para mujer y para hombre. Regístralo y vuelve a la consulta.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`sexo-${patientId}`} className="text-xs text-muted-foreground">
            Sexo
          </label>
          <select
            id={`sexo-${patientId}`}
            name="sex"
            required
            defaultValue=""
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">Selecciona</option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
          </select>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando..." : "Registrar el sexo"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Revísalo con el paciente antes de guardarlo: una vez registrado no se cambia desde aquí, porque un
        diagnóstico ya emitido se calculó con ese dato.
      </p>
    </form>
  );
}
