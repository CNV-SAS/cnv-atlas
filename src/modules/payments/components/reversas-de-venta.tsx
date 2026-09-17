"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { EnGestionForm, type EnGestionVigente } from "@/modules/avisos/components/en-gestion-form";

import {
  registrarNotaCreditoDeReversaFormAction,
  resolverReversaGanadaFormAction,
  resolverReversaPerdidaFormAction,
} from "../actions";
import { avisoDeTercero, diferenciaDelDebito, type Reversa } from "../reversa";
import type { AccionDeVentaState } from "../validations";

// ═══ CONTRACARGOS Y ANULACIONES (Bloque 3b, sesion 1) ═══
//
// Un contracargo LLEGA: el paciente desconocio el pago ante su banco y el banco debito. Este panel existe para
// que no se quede en el correo de Wompi de alguien. Y el orden de la pantalla sigue el de contabilidad: abrir NO
// mueve el ingreso, ganar tampoco, y solo perder revierte.
//
// LO QUE SE DICE EN PANTALLA, Y NO SOLO EN EL CODIGO:
//   · que la diferencia entre lo debitado y la venta es LO ESPERADO (cuota de manejo de la disputa, comision de
//     Wompi que no se devuelve), y que la nota credito va SOLO por el valor de la venta;
//   · que una disputa sin responder a tiempo SE PIERDE por silencio;
//   · y que si el producto era de tercero, CNV ya le pago su parte al proveedor.

const initial: AccionDeVentaState = { error: null, success: null, warning: null };

export type ReversaEnPanel = Reversa & {
  referenciaDeLaDisputa: string | null;
  productos: string | null;
  abiertaPor: string | null;
  resueltaPor: string | null;
  nota: string | null;
};

const ESTADO: Record<Reversa["estado"], string> = {
  abierta: "Disputa abierta",
  ganada: "Disputa ganada",
  perdida: "Disputa perdida",
};

const TIPO: Record<Reversa["tipo"], string> = {
  contracargo: "Contracargo",
  anulacion_wompi: "Anulada en Wompi",
};

function FormConReferencia({
  reversaId,
  accion,
  etiqueta,
  aviso,
  enCurso,
  variante,
}: {
  reversaId: string;
  accion: typeof resolverReversaGanadaFormAction;
  etiqueta: string;
  aviso: string;
  enCurso: string;
  variante: "default" | "destructive";
}) {
  const [state, action, pending] = useActionState(accion, initial);
  useFormToastAndRefresh(state);
  const [abierto, setAbierto] = useState(false);
  const [referencia, setReferencia] = useState("");

  if (!abierto) {
    return (
      <Button key={`pedir-${etiqueta}`} type="button" size="sm" variant="outline" onClick={() => setAbierto(true)}>
        {etiqueta}
      </Button>
    );
  }
  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="reversaId" value={reversaId} />
      <span className="text-xs text-muted-foreground">{aviso}</span>
      <Input
        name="referencia"
        aria-label="Referencia de la respuesta del banco"
        placeholder="Referencia de la respuesta del banco"
        required
        maxLength={120}
        value={referencia}
        onChange={(e) => setReferencia(e.target.value)}
        className="h-8 w-64"
      />
      <Button key={`confirmar-${etiqueta}`} type="submit" size="sm" variant={variante} disabled={pending || referencia.trim().length < 2}>
        {pending ? enCurso : etiqueta}
      </Button>
      <Button key={`cancelar-${etiqueta}`} type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setAbierto(false)}>
        Cancelar
      </Button>
    </form>
  );
}

function NotaCreditoForm({ reversaId }: { reversaId: string }) {
  const [state, action, pending] = useActionState(registrarNotaCreditoDeReversaFormAction, initial);
  useFormToastAndRefresh(state);
  const [numero, setNumero] = useState("");
  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="reversaId" value={reversaId} />
      <Input
        name="numero"
        aria-label="Número de la nota crédito"
        placeholder="Número de la nota crédito (por ejemplo, NC4)"
        required
        maxLength={60}
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        className="h-8 w-72"
      />
      <Button key="guardar-nc" type="submit" size="sm" disabled={pending || numero.trim().length < 2}>
        {pending ? "Guardando..." : "Registrar la nota crédito"}
      </Button>
    </form>
  );
}

export function ReversasDeVenta({
  reversas,
  puedeResolver,
  enGestion,
}: {
  reversas: ReversaEnPanel[];
  /** Resolver es de quien ve el ingreso (admin y direccion); soporte atiende y marca en gestion. */
  puedeResolver: boolean;
  enGestion: Record<string, EnGestionVigente>;
}) {
  if (reversas.length === 0) return null;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="text-base font-medium text-foreground">Contracargos y anulaciones</h2>
        <p className="text-sm text-muted-foreground">
          El banco devolvió el dinero de una venta ya cobrada. Mientras la disputa esté abierta el ingreso no se
          toca: la factura sigue siendo válida. Responde al banco con los soportes, porque una disputa sin
          respuesta a tiempo se pierde.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {reversas.map((r) => {
          const diferencia = diferenciaDelDebito(r);
          const tercero = avisoDeTercero(r);
          return (
            <li key={r.id} className="flex flex-col gap-1 rounded-md border border-border/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{Number(r.montoDeLaVenta).toLocaleString("es-CO")} COP</span>
                <span className="text-sm text-muted-foreground">{r.productos ?? "sin productos"}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {TIPO[r.tipo]} · {ESTADO[r.estado]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Abierta el {formatDateTime(r.abiertaEn)}
                {r.abiertaPor ? ` por ${r.abiertaPor}` : " por Atlas, desde Wompi"}
                {r.referenciaDeLaDisputa ? ` · referencia ${r.referenciaDeLaDisputa}` : ""}
                {r.montoDebitado ? ` · el banco debitó ${Number(r.montoDebitado).toLocaleString("es-CO")} COP` : ""}
                {r.resueltaEn ? ` · resuelta el ${formatDate(r.resueltaEn)}${r.resueltaPor ? ` por ${r.resueltaPor}` : ""}` : ""}
              </p>
              {diferencia.aviso ? <p className="text-xs text-attention">{diferencia.aviso}</p> : null}
              {tercero ? <p className="text-xs text-attention">{tercero}</p> : null}
              {r.notaCredito ? (
                <p className="text-xs text-muted-foreground">Nota crédito: {r.notaCredito}</p>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {puedeResolver && r.estado === "abierta" ? (
                  <>
                    <FormConReferencia
                      reversaId={r.id}
                      accion={resolverReversaGanadaFormAction}
                      etiqueta="Se ganó la disputa"
                      aviso="El banco repuso el dinero. El ingreso nunca se movió."
                      enCurso="Cerrando..."
                      variante="default"
                    />
                    <FormConReferencia
                      reversaId={r.id}
                      accion={resolverReversaPerdidaFormAction}
                      etiqueta="Se perdió la disputa"
                      aviso="Se revierten ingreso y comisión, y queda pendiente la nota crédito manual por el valor de la venta."
                      enCurso="Revirtiendo..."
                      variante="destructive"
                    />
                  </>
                ) : null}
                {puedeResolver && r.estado === "perdida" && !r.notaCredito ? <NotaCreditoForm reversaId={r.id} /> : null}
                <EnGestionForm tipo="reversa" transactionId={r.transactionId} vigente={enGestion[`reversa:${r.transactionId}`] ?? null} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
