"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { formatDateOnly } from "@/lib/format/date";

import { borrarVentaRetroactivaAction, type DevolucionState } from "../actions";

const inicial: DevolucionState = { error: null, success: null, warning: null };

export type VentaRetroactivaListada = {
  id: string;
  fecha: string;
  factura: string;
  total: string;
  paciente: string | null;
  estadoDelInventario: string | null;
};

// El estado del inventario se muestra porque es la parte que puede no haber salido bien: si el saldo de ese
// dia no alcanzaba, la venta queda `sin_saldo`, y eso es informacion (los numeros no cuadran), no un fallo
// que haya que esconder.
function rotuloDelInventario(estado: string | null): { texto: string; alerta: boolean } {
  if (estado === "descontado") return { texto: "Inventario descontado", alerta: false };
  if (estado === "sin_saldo") return { texto: "No alcanzó el saldo para descontarla entera", alerta: true };
  if (estado === "fallido") return { texto: "El descuento falló", alerta: true };
  return { texto: "Descuento pendiente", alerta: false };
}

function Fila({ venta }: { venta: VentaRetroactivaListada }) {
  const [state, action, pending] = useActionState(borrarVentaRetroactivaAction, inicial);
  useFormToastAndRefresh(state);
  const inventario = rotuloDelInventario(venta.estadoDelInventario);
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium text-foreground">
          {formatDateOnly(venta.fecha)} · factura {venta.factura}
        </span>
        <span className="tabular-nums text-foreground">${Number(venta.total).toLocaleString("es-CO")}</span>
      </div>
      <span className="text-muted-foreground">{venta.paciente ?? "(sin paciente)"}</span>
      <span className={inventario.alerta ? "text-destructive" : "text-muted-foreground"}>
        {inventario.texto}
      </span>
      <form onSubmit={enviarSinReset(action)}>
        <input type="hidden" name="transactionId" value={venta.id} />
        <Button type="submit" variant="ghost" disabled={pending} className="w-fit px-0 text-destructive">
          Borrarla
        </Button>
        {state.error ? <p className="text-destructive">{state.error}</p> : null}
      </form>
    </li>
  );
}

export function VentasRetroactivasRegistradas({ ventas }: { ventas: VentaRetroactivaListada[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-foreground">Las que ya se registraron</h2>
      {ventas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay ninguna.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Una venta recién registrada se puede borrar mientras no haya descontado inventario. Después ya no:
            su rastro de custodia quedaría suelto, y se corrige con una devolución, como cualquier otra venta.
          </p>
          <ul className="flex flex-col gap-2">
            {ventas.map((v) => (
              <Fila key={v.id} venta={v} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
