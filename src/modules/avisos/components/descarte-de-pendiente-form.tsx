"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import { descartarPendienteFormAction, reactivarPendienteFormAction } from "../actions";
import type { TipoSinSalida } from "../resumen";
import type { AvisoFormState } from "../validations";

const initial: AvisoFormState = { error: null, success: null, warning: null };

// ═══ DESCARTAR UN PENDIENTE QUE NO TIENE SALIDA (0205) ═══
//
// Dos pendientes no se cierran con ningun acto en Atlas ("sin saldo" se arregla contando la vitrina; "pagada sin
// despachar" se entrego por fuera). Esto los calla en el correo, CON MOTIVO, y vuelven si el hecho cambia.
export function DescarteDePendienteForm({
  tipo,
  transactionId,
}: {
  tipo: TipoSinSalida;
  transactionId: string;
}) {
  const [state, action, pending] = useActionState(descartarPendienteFormAction, initial);
  useFormToastAndRefresh(state);
  const [abierto, setAbierto] = useState(false);
  // CONTROLADO: un error del servidor no borra lo escrito (hazard 2 de CLAUDE.md).
  const [motivo, setMotivo] = useState("");

  // Al guardar se cierra. Se ajusta durante el render, no en un efecto (regla de lint set-state-in-effect).
  const [estadoVisto, setEstadoVisto] = useState(state);
  if (state !== estadoVisto) {
    setEstadoVisto(state);
    if (state.success) {
      setAbierto(false);
      setMotivo("");
    }
  }

  if (!abierto) {
    return (
      <Button key="abrir-descarte" type="button" size="sm" variant="ghost" onClick={() => setAbierto(true)}>
        Descartar
      </Button>
    );
  }

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-2 rounded-md bg-muted/40 p-2">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <label className="flex flex-col gap-1 text-xs text-foreground">
        Por qué se descarta
        <textarea
          name="motivo"
          rows={2}
          maxLength={500}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={
            tipo === "sin_saldo"
              ? "Por ejemplo: se contó la vitrina el 3 de octubre y cuadró; la diferencia era una recepción que faltaba cargar."
              : "Por ejemplo: el producto se lo llevó en la consulta, el despacho no pasó por Atlas."
          }
          className="w-full max-w-prose rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button key="guardar-descarte" type="submit" size="sm" disabled={pending || motivo.trim().length < 10}>
          {pending ? "Guardando..." : "Descartar"}
        </Button>
        <Button
          key="cancelar-descarte"
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setAbierto(false)}
        >
          Cancelar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Queda firmado con tu nombre y sale del correo. Si el hecho de la venta cambia (otra línea, otro importe,
        otro intento de descuento), vuelve a aparecer.
      </p>
    </form>
  );
}

/** Deshacer el descarte. No lo borra: lo revoca, y el pendiente vuelve al correo. */
export function ReactivarPendienteForm({
  tipo,
  transactionId,
}: {
  tipo: TipoSinSalida;
  transactionId: string;
}) {
  const [state, action, pending] = useActionState(reactivarPendienteFormAction, initial);
  useFormToastAndRefresh(state);
  return (
    <form onSubmit={enviarSinReset(action)}>
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <Button key="reactivar" type="submit" size="sm" variant="ghost" disabled={pending}>
        {pending ? "Reactivando..." : "Reactivar"}
      </Button>
    </form>
  );
}
