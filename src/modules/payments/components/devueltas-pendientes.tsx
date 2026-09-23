"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";

import { verificarDevueltaAction, type DevolucionState } from "../actions";
import type { DevueltaPendiente } from "../data/devolucion-fisica-writer";

// LAS DEVUELTAS PENDIENTES DE VERIFICACION (Bloque 3b, sesion 2).
//
// Lo que volvio del paciente espera aqui, y NO es vendible mientras espera (decision D-3b-3: el producto es
// alimento registrado ante INVIMA y una unidad que salio del control de CNV no tiene cadena de custodia).
// Alguien la inspecciona y decide, con su nombre: reincorporar al lote o dar de baja.

const inicial: DevolucionState = { error: null, success: null, warning: null };

function FilaDevuelta({
  item,
  destinos,
}: {
  item: DevueltaPendiente;
  destinos: { id: string; nombre: string }[];
}) {
  const [state, action, pending] = useActionState(verificarDevueltaAction, inicial);
  useFormToastAndRefresh(state);
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium text-foreground">{item.producto}</span>
        <span className="text-muted-foreground">
          lote {item.lote ?? "(sin lote)"} · {item.cantidad === 1 ? "1 unidad" : `${item.cantidad} unidades`}
        </span>
      </div>
      {item.ultimoMotivo ? (
        <span className="text-muted-foreground">Motivo de la devolución: {item.ultimoMotivo}</span>
      ) : null}
      <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-2">
        <input type="hidden" name="nutraceuticalId" value={item.nutraceuticalId} />
        <input type="hidden" name="lotId" value={item.lotId} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`cant-${item.lotId}`} className="text-xs font-medium">
              Unidades
            </label>
            <Input
              id={`cant-${item.lotId}`}
              name="cantidad"
              inputMode="numeric"
              defaultValue={String(item.cantidad)}
              className="w-20"
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`dest-${item.lotId}`} className="text-xs font-medium">
              Si se reincorpora, ¿a dónde vuelve?
            </label>
            <select
              id={`dest-${item.lotId}`}
              name="destinoId"
              defaultValue=""
              disabled={pending}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
            >
              <option value="">— Elegir —</option>
              {destinos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor={`motivo-${item.lotId}`} className="text-xs font-medium">
              Resultado de la verificación
            </label>
            <Input
              id={`motivo-${item.lotId}`}
              name="motivo"
              placeholder="Sellada, íntegra y sin vencer"
              disabled={pending}
            />
          </div>
        </div>
        {/* DOS BOTONES CON `key` DISTINTAS (hazard 1 de formularios) y su valor en el `name`, que viaja
            porque `enviarSinReset` pasa el submitter. La decisión es de la persona, nunca automática. */}
        <div className="flex flex-wrap gap-2">
          <Button key="reincorporar" type="submit" name="decision" value="reincorporar" disabled={pending} className="w-fit">
            Reincorporar al lote
          </Button>
          <Button key="baja" type="submit" name="decision" value="dar_de_baja" variant="secondary" disabled={pending} className="w-fit">
            Dar de baja
          </Button>
        </div>
        {state.error ? <p className="text-destructive">{state.error}</p> : null}
      </form>
    </li>
  );
}

export function DevueltasPendientes({
  items,
  destinos,
}: {
  items: DevueltaPendiente[];
  destinos: { id: string; nombre: string }[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-foreground">Devueltas pendientes de verificación</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay unidades esperando verificación.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Lo que volvió del paciente espera aquí y no se puede vender. Revisa cada unidad: sellada, íntegra y
            sin vencer puede volver al lote; abierta, dañada o con duda, se da de baja.
          </p>
          <ul className="flex flex-col gap-3">
            {items.map((i) => (
              <FilaDevuelta key={`${i.nutraceuticalId}-${i.lotId}`} item={i} destinos={destinos} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
