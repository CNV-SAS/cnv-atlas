"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { objetarCuentaDistribucionAction, type DevolucionState } from "../actions";

const inicial: DevolucionState = { error: null, success: null, warning: null };
const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

export type MiCuenta = {
  id: string;
  corteDesde: string;
  corteHasta: string;
  emitidaEl: string;
  total: number;
  objetarHasta: string;
  pagarHasta: string;
  objetadaEl: string | null;
  motivoDeObjecion: string | null;
  objecionResueltaEl: string | null;
  desenlaceDeObjecion: string | null;
  pagadaEl: string | null;
  detalle: { dia: string; producto: string; cantidad: number; baseDescontada: number; iva: number; total: number }[];
};

// ═══ LAS CUENTAS DEL INTEGRANTE BAJO DISTRIBUCION (0188) ═══
//
// EL DETALLE ESTA ABIERTO, NO ESCONDIDO TRAS UN BOTON: el modelo le da dos dias habiles para objetar "de
// forma sustentada", y no se puede sustentar lo que no se ve. Y la factura discrimina base e IVA por
// renglon, que es como el modelo pide que salga y como se puede cotejar con su propia facturacion.
export function MisCuentasDistribucion({ cuentas, hoy }: { cuentas: MiCuenta[]; hoy: string }) {
  if (cuentas.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-prose text-sm text-muted-foreground">
        Bajo modalidad Distribución el paciente te paga a ti, y CNV te factura cada quincena el producto con
        tu descuento comercial más el IVA.{" "}
        <strong className="text-foreground">Tienes dos días hábiles para objetar</strong> una cuenta, con el
        motivo; objetar una parte no suspende el pago de lo demás.
      </p>
      {cuentas.map((c) => (
        <Cuenta key={c.id} cuenta={c} hoy={hoy} />
      ))}
    </div>
  );
}

function Cuenta({ cuenta, hoy }: { cuenta: MiCuenta; hoy: string }) {
  const [state, action, pending] = useActionState(objetarCuentaDistribucionAction, inicial);
  useFormToastAndRefresh(state);
  const [abierto, setAbierto] = useState(false);

  const puedeObjetar = cuenta.objetadaEl == null && cuenta.pagadaEl == null && hoy <= cuenta.objetarHasta;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">
            Del {cuenta.corteDesde} al {cuenta.corteHasta} · {pesos(cuenta.total)}
          </span>
          <span className="text-xs text-muted-foreground">
            Emitida el {cuenta.emitidaEl}
            {cuenta.pagadaEl ? ` · pagada el ${cuenta.pagadaEl}` : ` · vence el ${cuenta.pagarHasta}`}
          </span>
        </div>
        {puedeObjetar ? (
          <span className="text-xs text-muted-foreground">Puedes objetarla hasta el {cuenta.objetarHasta}</span>
        ) : null}
      </div>

      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1 font-normal">Día</th>
              <th className="px-2 py-1 font-normal">Producto</th>
              <th className="px-2 py-1 text-right font-normal">Cant.</th>
              <th className="px-2 py-1 text-right font-normal">Base con descuento</th>
              <th className="px-2 py-1 text-right font-normal">IVA</th>
              <th className="px-2 py-1 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {cuenta.detalle.map((l, i) => (
              <tr key={`${l.dia}-${l.producto}-${i}`} className="border-t border-border/60">
                <td className="px-2 py-1 text-muted-foreground">{l.dia}</td>
                <td className="px-2 py-1 text-foreground">{l.producto}</td>
                <td className="px-2 py-1 text-right tabular-nums text-foreground">{l.cantidad}</td>
                <td className="px-2 py-1 text-right tabular-nums text-foreground">{pesos(l.baseDescontada)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">{pesos(l.iva)}</td>
                <td className="px-2 py-1 text-right font-medium tabular-nums text-foreground">{pesos(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cuenta.objetadaEl ? (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Objetaste el {cuenta.objetadaEl}: {cuenta.motivoDeObjecion}
          {cuenta.objecionResueltaEl
            ? ` · CNV la resolvió el ${cuenta.objecionResueltaEl} como ${cuenta.desenlaceDeObjecion}`
            : " · CNV tiene tres días hábiles para responder"}
        </div>
      ) : null}

      {puedeObjetar ? (
        abierto ? (
          <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="statementId" value={cuenta.id} />
            <Input
              name="motivo"
              required
              maxLength={500}
              placeholder="Qué no cuadra: la venta, la cantidad, el precio..."
              className="w-full max-w-md"
            />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {pending ? "Enviando..." : "Objetar"}
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="self-start text-xs text-muted-foreground underline"
          >
            Algo no cuadra: objetar esta cuenta
          </button>
        )
      ) : null}
    </div>
  );
}
