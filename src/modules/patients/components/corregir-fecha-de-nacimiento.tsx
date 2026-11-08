"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { corregirFechaDeNacimientoAction } from "../actions";
import type { SexoPacienteState } from "../types";

const VACIO: SexoPacienteState = { error: null, success: null, warning: null };

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CORREGIR UNA FECHA DE NACIMIENTO YA REGISTRADA  ·  0244, Santiago 2026-11-08
//
// ═══ POR QUE ESTE BLOQUE EMPIEZA CERRADO, al reves que el de completar ═══
//
// El de completar SE VE porque ahi el dato FALTA y BLOQUEA el diagnostico: esconderlo repetiria el
// defecto que vino a arreglar. Aqui el dato ESTA, el sistema funciona, y lo que se ofrece es pisar un
// valor con el que ya se diagnostico. Un formulario abierto para eso, permanente en la ficha de todos
// los pacientes, invita a usarlo; cerrado, hay que ir a buscarlo, que es lo correcto para un acto que
// deberia ser raro.
//
// ═══ LOS TRES CAMPOS SON OBLIGATORIOS Y NINGUNO SOBRA ═══
//
//   · la FECHA, obviamente;
//   · el MOTIVO, que es lo que un auditor lee dentro de dos años ("error" no explica nada, por eso el
//     minimo son diez caracteres y lo impone el esquema);
//   · la FUENTE, que es lo que separa una correccion de una suposicion. Una fecha de nacimiento no se
//     corrige de memoria.
//
// Y EL BOTON PIDE LOS TRES EN SU ROTULO, no con un `required` suelto (hazard 6/8): la exigencia se dice,
// no se deja que el navegador la descubra campo por campo.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Las cuatro fuentes, con su texto. La lista la cierran el esquema y el CHECK de la tabla. */
const FUENTES: { valor: string; texto: string }[] = [
  { valor: "documento_de_identidad", texto: "El documento de identidad" },
  { valor: "registro_civil", texto: "El registro civil" },
  { valor: "el_paciente_lo_confirmo", texto: "El paciente lo confirmó" },
  { valor: "otro", texto: "Otra fuente (dilo en el motivo)" },
];

export function CorregirFechaDeNacimiento({
  patientId,
  actual,
}: {
  patientId: string;
  /** La fecha vigente, para que quien corrige vea contra qué está corrigiendo. */
  actual: string | null;
}) {
  const [state, formAction, pending] = useActionState(corregirFechaDeNacimientoAction, VACIO);
  useFormToastAndRefresh(state);
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fuente, setFuente] = useState("");
  const completo = fecha !== "" && motivo.trim().length >= 10 && fuente !== "";

  // AL TERMINAR SE CIERRA Y SE VACIA, igual que la correccion del sexo y por el mismo motivo: la pagina se
  // refresca con la fecha nueva, y el formulario abierto con los campos llenos encima haria parecer que no
  // paso nada (y la segunda pulsacion no corrige: el CHECK de la tabla rechaza corregir a lo mismo). Se
  // ajusta durante el render, no en un efecto (regla de lint set-state-in-effect).
  //
  // Se cierra tambien con el aviso de la rama del consentimiento: ahi la correccion SI se hizo, y lo que
  // queda por mirar no esta en este formulario.
  const [estadoVisto, setEstadoVisto] = useState(state);
  if (state !== estadoVisto) {
    setEstadoVisto(state);
    if (!state.error) {
      setAbierto(false);
      setFecha("");
      setMotivo("");
      setFuente("");
    }
  }

  if (!abierto) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}>
        Corregir la fecha de nacimiento
      </Button>
    );
  }

  return (
    <form
      onSubmit={enviarSinReset(formAction)}
      className="flex w-full max-w-xl flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <input type="hidden" name="patientId" value={patientId} />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">Corregir la fecha de nacimiento</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          Hoy dice <strong className="text-foreground">{actual ?? "sin fecha"}</strong>. La anterior no se
          borra: queda guardada con tu nombre, el motivo y la fuente.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`correccion-fecha-${patientId}`} className="text-xs text-muted-foreground">
            Fecha correcta
          </label>
          {/* SIN `required`: la exigencia vive en el botón y se dice ahí (hazard 8). */}
          <input
            id={`correccion-fecha-${patientId}`}
            name="birthDate"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.currentTarget.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`correccion-fuente-${patientId}`} className="text-xs text-muted-foreground">
            De dónde sale
          </label>
          <select
            id={`correccion-fuente-${patientId}`}
            name="fuente"
            value={fuente}
            onChange={(e) => setFuente(e.currentTarget.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">Elige una</option>
            {FUENTES.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.texto}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`correccion-motivo-${patientId}`} className="text-xs text-muted-foreground">
          Por qué se corrige
        </label>
        <Input
          id={`correccion-motivo-${patientId}`}
          name="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.currentTarget.value)}
          maxLength={500}
          placeholder="Por ejemplo: la edad del equipo no cuadra con la de la ficha; se verificó contra la cédula"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || !completo}>
          {pending
            ? "Corrigiendo..."
            : completo
              ? "Corregir la fecha"
              : "Completa la fecha, la fuente y el motivo"}
        </Button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-xs text-muted-foreground underline"
        >
          Cancelar
        </button>
      </div>

      {/* LAS DOS CONSECUENCIAS, DICHAS ANTES DE PULSAR. Las dos ocurren solas y las dos son visibles:
          esconderlas convertiría una corrección en una sorpresa a los tres días. */}
      <p className="max-w-prose text-xs text-muted-foreground">
        Dos cosas pasan al corregir. Si con la fecha nueva el paciente era menor el día que firmó, su
        consentimiento queda <strong>pendiente de regularizar</strong> y la ficha lo dirá. Y sus consultas
        ya diagnosticadas aparecen en <strong>Recalibración</strong>, porque se emitieron con otra edad: el
        diagnóstico no se recalcula solo.
      </p>
    </form>
  );
}
