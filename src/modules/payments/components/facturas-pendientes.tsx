"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/shared/panel";
import { useFormToastRefreshOnSuccess } from "@/components/shared/use-form-toast";

import { reintentarFacturasAction } from "../actions";

// ═══ VENTAS COBRADAS SIN DOCUMENTO FISCAL ═══
//
// Es el reporte que contabilidad exige EN CERO al cierre de cada dia (decision D2), y la contrapartida de
// haber aceptado que el inventario se descuente al sellar la venta y no al emitir la factura.
//
// ── POR QUE MUESTRA EL MOTIVO Y NO SOLO EL CONTEO ───────────────────────────────────────────────
//
// Una lista que dice "3 facturas fallaron" obliga a ir a la base para saber por que, y quien mira esta
// pantalla no entra a la base. El motivo es lo que convierte el aviso en algo accionable: "falta el tipo
// de persona del cliente" se arregla; "fallo" no.
//
// ── Y POR QUE EL PANEL NO SE ESCONDE CUANDO ESTA VACIO ─────────────────────────────────────────
//
// Porque el cero es el dato. Un panel que desaparece deja la duda de si esta en cero o si dejo de
// funcionar, y son dos cosas muy distintas al cierre del dia.

export type VentaSinDocumento = {
  id: string;
  amount: string;
  estado: string | null;
  numero: string | null;
  intentos: number;
  motivo: string | null;
  fecha: string;
};

const ROTULO: Record<string, string> = {
  pendiente: "Sin intentar",
  borrador: "En borrador",
  emitida_sin_sellar: "Numerada, sin sellar ante la DIAN",
  fallida: "Falló",
};

const MAX_INTENTOS = 5;

export function FacturasPendientes({ ventas }: { ventas: VentaSinDocumento[] }) {
  const [state, action, pending] = useActionState(reintentarFacturasAction, {
    error: null,
    success: null,
    warning: null,
  });
  useFormToastRefreshOnSuccess(state);

  return (
    <Panel titulo="Ventas sin documento fiscal">
      <p className="text-sm text-muted-foreground">
        {ventas.length === 0
          ? "Ninguna. Todas las ventas cobradas tienen su factura emitida."
          : `${ventas.length} venta${ventas.length === 1 ? "" : "s"} cobrada${ventas.length === 1 ? "" : "s"} cuya factura todavía no está completa.`}
      </p>
      {ventas.length > 0 && (
        <>
          <ul className="flex flex-col gap-2">
            {ventas.map((v) => (
              <li key={v.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <strong className="text-foreground">
                    {Number(v.amount).toLocaleString("es-CO")} COP
                  </strong>
                  <span className="text-muted-foreground">
                    {new Date(v.fecha).toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">
                    {ROTULO[v.estado ?? ""] ?? v.estado ?? "Sin intentar"}
                  </span>
                  {v.numero && <span className="text-xs text-muted-foreground">{v.numero}</span>}
                  {/* Los intentos importan porque al llegar al tope la cola deja de tocarla: a partir de
                      ahi no se arregla sola y hay que mirarla. En AMBAR OPERATIVO, no en la escala
                      clinica: esa dice cosas sobre un paciente, y esto es un problema de facturacion. */}
                  <span
                    className={`text-xs ${v.intentos >= MAX_INTENTOS ? "text-attention" : "text-muted-foreground"}`}
                  >
                    {v.intentos} de {MAX_INTENTOS} intentos
                    {v.intentos >= MAX_INTENTOS ? " · agotados" : ""}
                  </span>
                </div>
                {v.motivo && (
                  <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{v.motivo}</p>
                )}
              </li>
            ))}
          </ul>

          {/* onSubmit y no la prop `action`: React 19 dispara un reset nativo al ejecutar la accion. */}
          <form onSubmit={enviarSinReset(action)} className="mt-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Reintentando..." : "Reintentar las pendientes"}
            </Button>
            {/* Se dice aqui, y no solo en el codigo: pulsarlo dos veces NO emite dos facturas. Quien
                administra tiene que poder pulsarlo sin miedo, que es lo que hace que se use. */}
            <p className="mt-2 text-xs text-muted-foreground">
              Se puede pulsar las veces que haga falta: una venta que ya tiene factura no genera otra.
            </p>
          </form>
        </>
      )}
    </Panel>
  );
}
