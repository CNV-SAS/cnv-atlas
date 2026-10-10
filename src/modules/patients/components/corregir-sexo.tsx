"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { corregirSexoPacienteAction } from "../actions";
import type { SexoPacienteState } from "../types";

const VACIO: SexoPacienteState = { error: null, success: null, warning: null };

// CORREGIR UN SEXO YA REGISTRADO.
//
// ── EL CASO QUE LO PIDE, de Santiago ──────────────────────────────────────────────────────────────
//
// *"un paciente por ejemplo transexual puede pensar que es el genero, entonces el profesional debe poder
// cambiarlo."* El motor usa el sexo BIOLOGICO (todas sus clasificaciones son sexo-especificas), asi que un
// genero anotado en ese campo no es un dato de identidad mal puesto: es un insumo clinico equivocado, y
// hasta hoy no tenia arreglo desde la pantalla. Un freno sin salida se vive como un sistema roto.
//
// ── SE ABRE, NO ESTA ABIERTO, al contrario que el de completar ────────────────────────────────────
//
// Y la diferencia es el estado del dato, no una preferencia. `CompletarSexo` esta SIEMPRE a la vista porque
// el dato FALTA y bloquea el diagnostico: esconderlo repetiria el defecto que vino a cerrar. Aqui el dato
// EXISTE y la ficha es para leer; un desplegable de sexo permanentemente editable al lado de "Sexo: F"
// invita a teclear encima de algo bueno.
//
// ── POR QUE PIDE MOTIVO Y CONFIRMACION ───────────────────────────────────────────────────────────
//
// El motivo va al rastro clinico junto con el valor viejo y el nuevo, porque es lo unico que despues explica
// por que el mismo paciente se clasifico de dos formas. Y la confirmacion no es un tramite: lo que el
// profesional tiene que leer ANTES de pulsar es que esto NO rehace los diagnosticos ya emitidos.
export function CorregirSexo({
  patientId,
  sexoActual,
  diagnosticosGenerados,
}: {
  patientId: string;
  /** "F", "M", o cualquier otra cosa que haya quedado en la base. */
  sexoActual: string;
  /** Cuantos diagnosticos vigentes tiene este paciente: deciden si hay algo que rehacer despues. */
  diagnosticosGenerados: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, pending] = useActionState(corregirSexoPacienteAction, VACIO);
  useFormToastAndRefresh(state);

  // AL GUARDAR SE CIERRA, igual que el de contacto y por el mismo motivo: la pagina se refresca con el dato
  // nuevo y el formulario abierto encima haria parecer que no paso nada. Se ajusta durante el render, no en
  // un efecto (regla de lint set-state-in-effect).
  const [estadoVisto, setEstadoVisto] = useState(state);
  if (state !== estadoVisto) {
    setEstadoVisto(state);
    if (state.success) setAbierto(false);
  }

  if (!abierto) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}>
        Corregir el sexo
      </Button>
    );
  }

  const otro = sexoActual.trim().toUpperCase() === "F" ? "M" : "F";

  return (
    <form
      onSubmit={enviarSinReset(formAction)}
      className="flex w-full max-w-xl flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <input type="hidden" name="patientId" value={patientId} />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">Corregir el sexo de este paciente</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          El modelo clasifica con el sexo biológico: todas sus clasificaciones son distintas para mujer y
          para hombre. Si aquí quedó registrado el género, corrígelo.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`corregir-sexo-${patientId}`} className="text-xs text-muted-foreground">
            Sexo
          </label>
          <select
            id={`corregir-sexo-${patientId}`}
            name="sex"
            required
            // EL OTRO VALOR VIENE PUESTO, que es la correccion que se viene a hacer: dejarlo en el actual
            // obliga a cambiarlo para que el formulario sirva de algo, y dejarlo vacio es un paso de mas.
            defaultValue={otro}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`motivo-sexo-${patientId}`} className="text-xs text-muted-foreground">
          Por qué se corrige
        </label>
        <input
          id={`motivo-sexo-${patientId}`}
          name="motivo"
          required
          minLength={10}
          maxLength={300}
          placeholder="Ej. se registró el género y el modelo clasifica con el sexo biológico"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <span className="text-xs text-muted-foreground">
          Queda en la historia clínica junto con el valor anterior y el nuevo.
        </span>
      </div>

      {/* ═══ LO QUE ESTO NO HACE, DICHO ANTES DE PULSAR ═══

          Un diagnóstico generado es el registro de lo que se concluyó con los datos de entonces, y Atlas no
          lo reescribe por detrás. Si no se dijera aquí, el profesional corregiría el dato y se iría creyendo
          que el diagnóstico de la pantalla de al lado ya quedó al día.

          Y SE DICE CON LA CIFRA, no en abstracto: con cero diagnósticos no hay nada que rehacer y una
          advertencia genérica solo asusta; con dos, hay trabajo concreto y un sitio donde hacerlo. */}
      {diagnosticosGenerados > 0 ? (
        <p className="max-w-prose rounded-md bg-clinical-warning-bg p-3 text-xs text-clinical-warning">
          Este paciente ya tiene {diagnosticosGenerados === 1 ? "un diagnóstico generado" : `${diagnosticosGenerados} diagnósticos generados`} con el
          dato anterior. Corregir el sexo no {diagnosticosGenerados === 1 ? "lo rehace" : "los rehace"}: para
          rehacer una evaluación, entra en ella y usa Corregir, que crea una versión nueva y deja la anterior
          marcada como reemplazada.
        </p>
      ) : (
        <p className="max-w-prose text-xs text-muted-foreground">
          Este paciente todavía no tiene ningún diagnóstico generado, así que el primero saldrá ya con este
          dato.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando..." : "Corregir el sexo"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
