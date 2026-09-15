"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format/date";
import { Panel } from "@/components/shared/panel";
import { useFormToastRefreshOnSuccess } from "@/components/shared/use-form-toast";

import { EnGestionForm, type EnGestionVigente } from "@/modules/avisos/components/en-gestion-form";

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
  pagoPendiente: boolean;
};

const ROTULO: Record<string, string> = {
  pendiente: "Sin intentar",
  borrador: "En borrador",
  emitida_sin_sellar: "Numerada, sin sellar ante la DIAN",
  fallida: "Falló",
  // UNA DECISION, NO UN FALLO. Mismo paciente y mismo ambiente dan siempre lo mismo, asi que reintentarla
  // no cambia nada y no gasta intentos. "Falló" o "agotados" dirian que algo se rindio.
  rechazada: "No se factura aquí, por regla",
};

const MAX_INTENTOS = 5;

export function FacturasPendientes({
  ventas,
  dia,
  porDia,
  puedeReintentar,
  enGestion,
}: {
  /** Reintentar es de quien ve el ingreso (admin y direccion); soporte atiende pero no reintenta. */
  puedeReintentar: boolean;
  /** El "en gestion" vigente por "tipo:venta" (Bloque A). */
  enGestion: Record<string, EnGestionVigente>;
  ventas: VentaSinDocumento[];
  /** El dia consultado ("AAAA-MM-DD", de Colombia), o null para todas. */
  dia: string | null;
  /** Cuantas quedan por dia en los ultimos 30 dias; solo los dias con alguna. */
  porDia: { dia: string; total: number }[];
}) {
  const [state, action, pending] = useActionState(reintentarFacturasAction, {
    error: null,
    success: null,
    warning: null,
  });
  useFormToastRefreshOnSuccess(state);

  return (
    <Panel titulo="Ventas cobradas sin cerrar en contabilidad">
      {/* Con `key`: al cambiar de dia por un enlace, el campo muestra el dia nuevo. */}
      <FiltroDelDia key={dia ?? "todas"} dia={dia} />
      {porDia.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Días con ventas sin cerrar (últimos 30):{" "}
          {porDia.map((d, i) => (
            <span key={d.dia}>
              {i > 0 ? " · " : ""}
              <Link href={`/pagos?dia=${d.dia}`} scroll={false} className="text-primary underline-offset-4 hover:underline">
                {d.dia.split("-").reverse().join("/")}
              </Link>{" "}
              ({d.total})
            </span>
          ))}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {ventas.length === 0
          ? dia
            ? `Ninguna del ${dia.split("-").reverse().join("/")}. Ese día quedó en cero.`
            : "Ninguna. Todas las ventas cobradas tienen su factura emitida y su pago registrado."
          : `${ventas.length} venta${ventas.length === 1 ? "" : "s"} cobrada${ventas.length === 1 ? "" : "s"}${dia ? ` el ${dia.split("-").reverse().join("/")}` : ""} con la factura o el pago sin completar.`}
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
                  {/* CON EL HELPER DE ZONA FIJA, y esto fue el error #418 que salio en consola. Este
                      componente es de cliente: el servidor (Vercel, UTC) y el navegador (Bogota, UTC-5)
                      formateaban la misma fecha distinta, y React no pudo hidratar. `lib/format/date`
                      existe exactamente para eso y su propia cabecera nombra el 418; no lo use. */}
                  <span className="text-muted-foreground">{formatDateTime(v.fecha)}</span>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">
                    {/* La factura puede estar completa y el pago no: se dice, porque es otro problema y
                        otra cuenta en contabilidad (el paciente figura "por cobrar" habiendo pagado). */}
                    {v.pagoPendiente
                      ? "Facturada, pago no registrado"
                      : (ROTULO[v.estado ?? ""] ?? v.estado ?? "Sin intentar")}
                  </span>
                  {v.numero && <span className="text-xs text-muted-foreground">{v.numero}</span>}
                  {/* Los intentos importan porque al llegar al tope la cola deja de tocarla: a partir de
                      ahi no se arregla sola y hay que mirarla. En AMBAR OPERATIVO, no en la escala
                      clinica: esa dice cosas sobre un paciente, y esto es un problema de facturacion. */}
                  {/* Una rechazada NO muestra contador: no se esta intentando, se esta decidiendo. Un "3 de 5"
                      junto a una decision la hace parecer un fallo que va a agotarse. */}
                  {v.estado !== "rechazada" && (
                    <span
                      className={`text-xs ${v.intentos >= MAX_INTENTOS ? "text-attention" : "text-muted-foreground"}`}
                    >
                      {v.intentos} de {MAX_INTENTOS} intentos
                      {v.intentos >= MAX_INTENTOS ? " · agotados" : ""}
                    </span>
                  )}
                </div>
                {v.motivo && (
                  <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{v.motivo}</p>
                )}
                <div className="mt-2">
                  <EnGestionForm tipo="sin_documento" transactionId={v.id} vigente={enGestion[`sin_documento:${v.id}`] ?? null} />
                </div>
              </li>
            ))}
          </ul>

          {/* onSubmit y no la prop `action`: React 19 dispara un reset nativo al ejecutar la accion. */}
          {puedeReintentar ? (
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
          ) : null}
        </>
      )}
    </Panel>
  );
}

// ═══ EL FILTRO POR DIA (paso 6 del 3.4) ═══
//
// NO ES UN FORMULARIO GET NATIVO, y lo fue: un envio nativo es una NAVEGACION COMPLETA, y el navegador sube la
// pagina al inicio en cada clic (smoke del 2026-09-15). No es el salto de las acciones de servidor que corrige
// `preservarScroll`: aqui no hay accion, hay navegacion. Se navega con el router de Next y `scroll: false`,
// que cambia la direccion (?dia=) y vuelve a leer la pagina sin moverla.
//
// LA FECHA VACIA SIGNIFICA "VER TODAS" (decision del 2026-09-15): el boton lo dice cuando el campo esta vacio, y
// se apaga si ya se estan viendo todas, porque no habria nada que hacer.
function FiltroDelDia({ dia }: { dia: string | null }) {
  const router = useRouter();
  const [valor, setValor] = useState(dia ?? "");
  const vacio = valor === "";
  const ir = (destino: string | null) => router.push(destino ? `/pagos?dia=${destino}` : "/pagos", { scroll: false });

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        ir(vacio ? null : valor);
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Día
        <input
          type="date"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs"
        />
      </label>
      <Button type="submit" variant="outline" size="sm" disabled={vacio && dia == null}>
        {vacio ? "Ver todas" : "Ver ese día"}
      </Button>
      {dia && !vacio ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => ir(null)}>
          Ver todas
        </Button>
      ) : null}
    </form>
  );
}
