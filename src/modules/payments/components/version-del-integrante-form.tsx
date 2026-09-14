"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { registrarVersionFormAction } from "../actions";
import type { AccionDeVentaState } from "../validations";

const initial: AccionDeVentaState = { error: null, success: null, warning: null };

// LA VERSION DEL INTEGRANTE sobre un pago en revision (contabilidad, 2026-09-14): el Integrante cuenta que paso
// en la consulta y Direccion resuelve. La escribe el profesional de la venta, o quien resuelve de lo que el
// Integrante le conto. Se puede corregir mientras la venta siga en revision.
export function VersionDelIntegranteForm({
  transactionId,
  actual,
  titulo,
}: {
  transactionId: string;
  actual: string | null;
  titulo: string;
}) {
  const [state, action, pending] = useActionState(registrarVersionFormAction, initial);
  useFormToastAndRefresh(state);
  const [editando, setEditando] = useState(!actual);
  // Controlado: el reset de React 19 no lo toca, y un error del servidor no borra lo escrito (hazard 2).
  const [texto, setTexto] = useState(actual ?? "");

  if (!editando) {
    return (
      <Button key="corregir" type="button" size="sm" variant="ghost" className="self-start" onClick={() => setEditando(true)}>
        Corregir la versión
      </Button>
    );
  }

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-2">
      <input type="hidden" name="transactionId" value={transactionId} />
      <label htmlFor={`version-${transactionId}`} className="text-xs font-medium text-foreground">
        {titulo}
      </label>
      <textarea
        id={`version-${transactionId}`}
        name="version"
        rows={3}
        maxLength={1000}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Por ejemplo: la tarjeta no pasó, pagó en efectivo y la página de Wompi quedó abierta en su teléfono."
        className="w-full max-w-prose rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <div className="flex flex-wrap gap-2">
        <Button key="guardar" type="submit" size="sm" disabled={pending || texto.trim().length < 10}>
          {pending ? "Guardando..." : "Guardar la versión"}
        </Button>
        {actual ? (
          <Button key="cancelar" type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setEditando(false)}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
