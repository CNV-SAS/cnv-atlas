"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateOnly } from "@/lib/format/date";

import { liquidarComisionAction, registrarPagoDeLiquidacionAction, type DevolucionState } from "../actions";

const inicial: DevolucionState = { error: null, success: null, warning: null };

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

export type PendienteDeLiquidar = {
  professionalId: string;
  nombre: string;
  base: number;
  filas: number;
  faltantes: string[];
};

export type LiquidacionParaVer = {
  id: string;
  profesional: string;
  hasta: string;
  base: number;
  iva: number;
  retencion: number;
  tarifa: number;
  neto: number;
  documento: string;
  pagadaEn: string | null;
  referencia: string | null;
};

function FilaPendiente({ item, hasta }: { item: PendienteDeLiquidar; hasta: string }) {
  const [state, action, pending] = useActionState(liquidarComisionAction, inicial);
  useFormToastAndRefresh(state);
  const bloqueado = item.faltantes.length > 0;
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium text-foreground">{item.nombre}</span>
        <span className="tabular-nums text-foreground">
          {pesos(item.base)} <span className="text-muted-foreground">en {item.filas} comisiones</span>
        </span>
      </div>
      {bloqueado ? (
        // NO SE LIQUIDA A MEDIAS: sin los datos tributarios la cuenta saldría mal, y girar de menos o de más
        // se arregla con plata de por medio. Se dice qué falta y dónde se completa.
        <p className="text-destructive">
          Falta en su perfil: {item.faltantes.join(", ")}. Sin eso no se puede calcular la retención.
        </p>
      ) : (
        <form onSubmit={enviarSinReset(action)} className="flex items-center gap-2">
          <input type="hidden" name="professionalId" value={item.professionalId} />
          <input type="hidden" name="hasta" value={hasta} />
          <Button type="submit" disabled={pending} className="w-fit">
            Liquidar hasta {formatDateOnly(hasta)}
          </Button>
          {state.error ? <span className="text-destructive">{state.error}</span> : null}
        </form>
      )}
    </li>
  );
}

function FilaLiquidacion({ item, puedePagar }: { item: LiquidacionParaVer; puedePagar: boolean }) {
  const [state, action, pending] = useActionState(registrarPagoDeLiquidacionAction, inicial);
  useFormToastAndRefresh(state);
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium text-foreground">
          {item.profesional} · hasta {formatDateOnly(item.hasta)}
        </span>
        <span className="tabular-nums font-medium text-foreground">{pesos(item.neto)}</span>
      </div>
      {/* LA CUENTA A LA VISTA: una liquidación tiene que poder explicarse sola, sin que nadie rehaga la
          multiplicación para entender por qué se giró eso. */}
      <span className="text-muted-foreground tabular-nums">
        Comisión {pesos(item.base)}
        {item.iva > 0 ? ` + IVA ${pesos(item.iva)}` : " (sin IVA)"} − retención{" "}
        {Math.round(item.tarifa * 100)} % {pesos(item.retencion)}
      </span>
      <span className="text-muted-foreground">
        {item.documento === "factura_del_integrante"
          ? "Él emite la factura a CNV."
          : "CNV emite documento soporte electrónico."}
      </span>
      {item.pagadaEn ? (
        <span className="text-muted-foreground">
          Girada el {formatDateOnly(item.pagadaEn)} · {item.referencia}
        </span>
      ) : puedePagar ? (
        <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="settlementId" value={item.id} />
          <Input name="referencia" placeholder="Referencia del giro" className="w-56" disabled={pending} />
          <Button type="submit" variant="secondary" disabled={pending} className="w-fit">
            Registrar el giro
          </Button>
          {state.error ? <span className="text-destructive">{state.error}</span> : null}
        </form>
      ) : (
        <span className="text-muted-foreground">Calculada, pendiente de giro.</span>
      )}
    </li>
  );
}

export function Liquidaciones({
  pendientes,
  liquidaciones,
  hasta,
  puedeLiquidar,
}: {
  pendientes: PendienteDeLiquidar[];
  liquidaciones: LiquidacionParaVer[];
  hasta: string;
  /** Dirección liquida y registra el giro; el Integrante solo ve las suyas. */
  puedeLiquidar: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      {puedeLiquidar ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-foreground">Comisiones por liquidar</h2>
          {pendientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay comisiones pendientes.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Entra todo lo causado y no liquidado hasta {formatDateOnly(hasta)}, ya neteado: si se revirtió
                una comisión que ya se había pagado, su fila negativa se descuenta aquí.
              </p>
              <ul className="flex flex-col gap-3">
                {pendientes.map((p) => (
                  <FilaPendiente key={p.professionalId} item={p} hasta={hasta} />
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-foreground">
          {puedeLiquidar ? "Liquidaciones" : "Tus liquidaciones"}
        </h2>
        {liquidaciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay ninguna.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {liquidaciones.map((l) => (
              <FilaLiquidacion key={l.id} item={l} puedePagar={puedeLiquidar} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
