"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  emitirCuentaDistribucionAction,
  registrarPagoDeCuentaDistribucionAction,
  resolverObjecionDistribucionAction,
  type DevolucionState,
} from "../actions";

const inicial: DevolucionState = { error: null, success: null, warning: null };
const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

export type CorteListoParaVer = {
  professionalId: string;
  quien: string;
  ventas: number;
  total: number;
  corteDesde: string;
  corteHasta: string;
};

export type CuentaParaVer = {
  id: string;
  quien: string;
  corteDesde: string;
  corteHasta: string;
  emitidaEl: string;
  total: number;
  objetarHasta: string;
  pagarHasta: string;
  moraDesde: string;
  objetadaEl: string | null;
  motivoDeObjecion: string | null;
  objecionResueltaEl: string | null;
  desenlaceDeObjecion: string | null;
  pagadaEl: string | null;
  montoPagado: number | null;
};

// ═══ EL RECAUDO DE DISTRIBUCION, DEL LADO DE CNV (0188) ═══
//
// Bajo Distribucion el paciente le paga AL INTEGRANTE, asi que aqui no se liquida nada: se COBRA. Es la
// direccion contraria de la pantalla de liquidaciones, y por eso vive en su propio bloque en vez de mezclarse
// con ella: un administrador que confunda las dos giraria plata que en realidad le deben.
export function CuentasDistribucion({
  cortes,
  cuentas,
  hoy,
}: {
  cortes: CorteListoParaVer[];
  cuentas: CuentaParaVer[];
  hoy: string;
}) {
  if (cortes.length === 0 && cuentas.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {cortes.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Cortes listos para facturar</span>
          <p className="max-w-prose text-xs text-muted-foreground">
            Ventas selladas bajo Distribución que todavía no se han facturado. Emitir crea la cuenta y marca
            esas ventas, para que no puedan entrar en otra.
          </p>
          {cortes.map((c) => (
            <FilaCorte key={`${c.professionalId}-${c.corteHasta}`} corte={c} hoy={hoy} />
          ))}
        </div>
      ) : null}

      {cuentas.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Cuentas emitidas</span>
          {cuentas.map((c) => (
            <FilaCuenta key={c.id} cuenta={c} hoy={hoy} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FilaCorte({ corte, hoy }: { corte: CorteListoParaVer; hoy: string }) {
  const [state, action, pending] = useActionState(emitirCuentaDistribucionAction, inicial);
  useFormToastAndRefresh(state);
  return (
    <form
      onSubmit={enviarSinReset(action)}
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
    >
      <input type="hidden" name="professionalId" value={corte.professionalId} />
      <input type="hidden" name="dia" value={hoy} />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{corte.quien}</span>
        <span className="text-xs text-muted-foreground">
          Del {corte.corteDesde} al {corte.corteHasta} · {corte.ventas}{" "}
          {corte.ventas === 1 ? "venta" : "ventas"} · {pesos(corte.total)}
        </span>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Emitiendo..." : "Emitir la cuenta"}
      </Button>
    </form>
  );
}

function FilaCuenta({ cuenta, hoy }: { cuenta: CuentaParaVer; hoy: string }) {
  const [pagoState, pagoAction, pagando] = useActionState(registrarPagoDeCuentaDistribucionAction, inicial);
  const [objState, objAction, resolviendo] = useActionState(resolverObjecionDistribucionAction, inicial);
  useFormToastAndRefresh(pagoState);
  useFormToastAndRefresh(objState);

  const enMora = cuenta.pagadaEl == null && hoy >= cuenta.moraDesde;
  const objecionAbierta = cuenta.objetadaEl != null && cuenta.objecionResueltaEl == null;

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-3 ${enMora ? "border-attention bg-attention-bg" : "border-border"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">
            {cuenta.quien} · {pesos(cuenta.total)}
          </span>
          <span className="text-xs text-muted-foreground">
            Corte {cuenta.corteDesde} a {cuenta.corteHasta} · emitida el {cuenta.emitidaEl}
            {cuenta.pagadaEl
              ? ` · pagada el ${cuenta.pagadaEl}${cuenta.montoPagado != null ? ` (${pesos(cuenta.montoPagado)})` : ""}`
              : ` · vence el ${cuenta.pagarHasta}`}
          </span>
        </div>
        {/* LA MORA SE NOMBRA CON SU CONSECUENCIA, no solo como un rotulo: pasados tres dias calendario del
            plazo se suspenden los despachos, y esa es la parte que hace falta saber. */}
        {enMora ? (
          <span className="text-xs text-attention">
            En mora desde el {cuenta.moraDesde}: los despachos están suspendidos
          </span>
        ) : null}
      </div>

      {cuenta.objetadaEl ? (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <strong className="text-foreground">Objetada el {cuenta.objetadaEl}:</strong>{" "}
          {cuenta.motivoDeObjecion}
          {cuenta.objecionResueltaEl ? (
            <>
              {" "}
              · Resuelta el {cuenta.objecionResueltaEl} como <strong>{cuenta.desenlaceDeObjecion}</strong>
            </>
          ) : null}
        </div>
      ) : null}

      {objecionAbierta ? (
        <form onSubmit={enviarSinReset(objAction)} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="statementId" value={cuenta.id} />
          <span className="text-xs text-muted-foreground">Resolver la objeción:</span>
          {/* DOS BOTONES DE ENVIO CON `key` DISTINTA (hazard 1 de CLAUDE.md): comparten formulario y el
              valor viaja en el `name` del boton, que `enviarSinReset` si manda porque pasa el submitter. */}
          <Button key="corregir" type="submit" name="desenlace" value="corregida" variant="outline" size="sm" disabled={resolviendo}>
            Darle la razón y rehacerla
          </Button>
          <Button key="sostener" type="submit" name="desenlace" value="sostenida" variant="outline" size="sm" disabled={resolviendo}>
            Sostener la cuenta
          </Button>
        </form>
      ) : null}

      {cuenta.pagadaEl == null && !objecionAbierta ? (
        <form onSubmit={enviarSinReset(pagoAction)} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="statementId" value={cuenta.id} />
          <Input name="monto" placeholder="Monto recibido" className="w-40" required />
          <Input name="nota" placeholder="Referencia (opcional)" className="w-56" />
          <Button type="submit" variant="outline" size="sm" disabled={pagando}>
            {pagando ? "Registrando..." : "Registrar el pago"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
