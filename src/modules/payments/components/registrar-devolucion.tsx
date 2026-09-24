"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { registrarDevolucionFisicaAction, type DevolucionState } from "../actions";

// ═══ LA PUERTA DE LA DEVOLUCION FISICA (2026-09-24) ═══
//
// FALTABA, y el smoke lo destapó: la sesión 2 del 3b construyó la cuarentena, la verificación y el bloqueo
// del producto de tercero, o sea TODO EL DESTINO, y ninguna pantalla llamaba a la acción que registra la
// devolución. Así que "Devueltas pendientes de verificación" nunca podía aparecer: no había por dónde meter
// nada. Un destino sin puerta se ve exactamente igual que una función que no existe.
//
// VIVE EN LA VENTA, que es donde está el hecho: el paciente devuelve LO QUE COMPRÓ, y la unidad que vuelve
// es la que salió con esa línea (por eso la acción pide la línea y no el producto: es lo que ata la
// devolución a su lote y a su precio).

const inicial: DevolucionState = { error: null, success: null, warning: null };

export type LineaDevolvible = { id: string; producto: string; cantidad: number };

export function RegistrarDevolucion({ lineas }: { lineas: LineaDevolvible[] }) {
  const [state, action, pending] = useActionState(registrarDevolucionFisicaAction, inicial);
  useFormToastAndRefresh(state);
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={() => setAbierto(true)}
        className="w-fit px-0 text-xs text-muted-foreground"
      >
        El paciente devolvió algo
      </Button>
    );
  }

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <span className="text-xs text-muted-foreground">
        Lo devuelto no vuelve al inventario vendible: queda en devueltas pendientes hasta que alguien lo
        revise y decida.
      </span>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`linea-${lineas[0]?.id}`} className="text-xs font-medium">
            Qué devolvió
          </label>
          <select
            id={`linea-${lineas[0]?.id}`}
            name="transactionItemId"
            disabled={pending}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {lineas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.producto} ({l.cantidad === 1 ? "1 unidad" : `${l.cantidad} unidades`})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`cant-dev-${lineas[0]?.id}`} className="text-xs font-medium">
            Cuántas
          </label>
          <Input
            id={`cant-dev-${lineas[0]?.id}`}
            name="cantidad"
            inputMode="numeric"
            defaultValue="1"
            className="w-20"
            disabled={pending}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={`motivo-dev-${lineas[0]?.id}`} className="text-xs font-medium">
            Por qué la devolvió
          </label>
          <Input
            id={`motivo-dev-${lineas[0]?.id}`}
            name="motivo"
            placeholder="Frasco sellado, no lo alcanzó a usar"
            disabled={pending}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="w-fit">
          Registrar la devolución
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAbierto(false)} disabled={pending} className="w-fit">
          Cancelar
        </Button>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
