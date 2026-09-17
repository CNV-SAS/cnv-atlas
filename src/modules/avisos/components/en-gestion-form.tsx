"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format/date";

import { marcarEnGestionFormAction } from "../actions";
import type { AvisoFormState } from "../validations";

const initial: AvisoFormState = { error: null, success: null, warning: null };

export type EnGestionVigente = { hasta: string; nota: string; por: string | null } | null;

// "EN GESTION HASTA" (Bloque A). Quien atiende un pendiente deja escrito que lo esta mirando y hasta cuando no hace
// falta avisarle; sale del correo hasta esa fecha o hasta su plazo, lo que llegue primero. Es el ojo humano que
// Santiago pidio en vez del reintento automatico.
export function EnGestionForm({
  tipo,
  transactionId,
  vigente,
}: {
  tipo: "revision" | "sin_documento" | "nota_credito" | "reversa";
  transactionId: string;
  vigente: EnGestionVigente;
}) {
  const [state, action, pending] = useActionState(marcarEnGestionFormAction, initial);
  useFormToastAndRefresh(state);
  const [abierto, setAbierto] = useState(false);
  // Controlados: un error del servidor no borra lo escrito (hazard 2 de CLAUDE.md).
  const [nota, setNota] = useState("");
  const [hasta, setHasta] = useState("");

  // AL GUARDAR, SE CIERRA (smoke del Bloque A, 2026-09-15). La pagina si se refrescaba y traia la gestion nueva,
  // pero `abierto` seguia en true y el formulario tapaba la linea "En gestión hasta...": parecia que no habia
  // pasado nada hasta recargar. Se ajusta durante el render, no en un efecto (regla de lint set-state-in-effect).
  const [estadoVisto, setEstadoVisto] = useState(state);
  if (state !== estadoVisto) {
    setEstadoVisto(state);
    if (state.success) {
      setAbierto(false);
      setNota("");
      setHasta("");
    }
  }

  const vigenteHoy = vigente != null;
  const texto = vigenteHoy
    ? `En gestión hasta el ${formatDate(`${vigente.hasta}T12:00:00`)}${vigente.por ? ` por ${vigente.por}` : ""}: ${vigente.nota}`
    : null;

  if (!abierto) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {texto ? <span className="text-xs text-muted-foreground">{texto}</span> : null}
        <Button key="abrir" type="button" size="sm" variant="ghost" onClick={() => setAbierto(true)}>
          {vigenteHoy ? "Actualizar la gestión" : "Marcar en gestión"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-2 rounded-md bg-muted/40 p-2">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <label className="flex flex-col gap-1 text-xs text-foreground">
        Qué se está haciendo
        <textarea
          name="nota"
          rows={2}
          maxLength={500}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Por ejemplo: esperando a que contabilidad cree el ítem en Alegra."
          className="w-full max-w-prose rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-foreground">
        No me avises hasta
        <Input type="date" name="hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9 w-44" />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button key="guardar" type="submit" size="sm" disabled={pending || nota.trim().length < 5 || !hasta}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        <Button key="cancelar" type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Sale del correo hasta esa fecha. Si antes vence su plazo, vuelve igual.
      </p>
    </form>
  );
}
