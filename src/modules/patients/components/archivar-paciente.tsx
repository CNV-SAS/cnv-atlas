"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { archivarPacienteAction } from "../actions";
import type { ArchivarPacienteState } from "../types";

const INICIAL: ArchivarPacienteState = { error: null, success: null, warning: null };

// ARCHIVAR / DESARCHIVAR, desde la ficha del paciente (Santiago, 2026-09-10).
//
// EL BOTON DICE LO QUE VA A PASAR, no el estado en el que esta: "Archivar" cuando esta activo y
// "Desarchivar" cuando no. Un boton que dice el estado obliga a adivinar si lo pone o lo quita.
//
// Y VA CON SU CONSECUENCIA AL LADO, no en un dialogo de confirmacion: archivar es REVERSIBLE de un clic,
// asi que pedir confirmacion seria gastar un paso en algo que se deshace con otro. Lo que si hace falta es
// decir que NO borra, porque "archivar" en otros sistemas si borra.
export function ArchivarPaciente({
  patientId,
  archivado,
}: {
  patientId: string;
  archivado: boolean;
}) {
  const [state, action, pending] = useActionState(archivarPacienteAction, INICIAL);
  useFormToastAndRefresh(state);

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-col items-end gap-1">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="archivar" value={archivado ? "0" : "1"} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Guardando..." : archivado ? "Desarchivar" : "Archivar"}
      </Button>
      <span className="text-xs text-muted-foreground">
        {archivado
          ? "Vuelve a la lista de pacientes activos."
          : "Sale de la lista. No se borra nada y se puede deshacer."}
      </span>
    </form>
  );
}
