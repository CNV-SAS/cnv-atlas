"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CANAL_ADMIN } from "@/lib/constants/canales";
import { formatDateOnly } from "@/lib/format/date";

import {
  descartarLiquidacionAction,
  liquidarComisionAction,
  registrarPagoDeLiquidacionAction,
  type DevolucionState,
} from "../actions";

const inicial: DevolucionState = { error: null, success: null, warning: null };

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

export type PendienteDeLiquidar = {
  professionalId: string;
  nombre: string;
  /** Lo que SE PUEDE girar: comisiones de ventas reales. Excluye las de pacientes de prueba (2026-10-09). */
  base: number;
  /**
   * Y lo que NO se gira, aparte: comisiones de ventas a pacientes de prueba.
   *
   * VA SEPARADO Y NO FILTRADO, por el criterio de Santiago: *"alguien que entre a /comercial ve que hay
   * pendiente por girarle X a un profesional que NO esta marcado de prueba, y se los gira pensando que son
   * ventas reales. Eso NO puede pasar."* Y por la misma razon que la marca del profesional el 2026-10-01:
   * esconderlo haria desaparecer comisiones ya selladas sin que nadie sepa que existieron.
   */
  baseDePrueba: number;
  filasDePrueba: number;
  /** Cuenta de demostracion: se muestra marcada y sin boton de liquidar. */
  esDePrueba: boolean;
  filas: number;
  /** Filas NEGATIVAS pendientes (devoluciones y disputas perdidas). No son comisiones. */
  reversiones: number;
  faltantes: string[];
};

export type LiquidacionParaVer = {
  id: string;
  profesional: string;
  hasta: string;
  base: number;
  iva: number;
  retencion: number;
  cargosDeFaltante: number;
  faltantesCobrados: number;
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
        <span className="font-medium text-foreground">
          {item.nombre}
          {/* MARCADA Y SIN BOTON (Santiago, 2026-10-01). Las dos salidas faciles estan mal: ocultarla esconde
              que hay comisiones colgando en el sistema, y mostrarla igual que las demas invita a girar plata
              de una venta que no existio. Esta es la pantalla donde alguien gira DE VERDAD. */}
          {item.esDePrueba ? (
            <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              Cuenta de demostración
            </span>
          ) : null}
        </span>
        <span className="tabular-nums text-foreground">
          {pesos(item.base)}{" "}
          <span className="text-muted-foreground">
            en {item.filas} {item.filas === 1 ? "comisión" : "comisiones"}
            {/* LAS REVERSIONES SE NOMBRAN APARTE: son filas negativas, no comisiones, y contarlas juntas
                producía "$0 en 6 comisiones" sobre tres ventas devueltas. */}
            {item.reversiones > 0
              ? `, con ${item.reversiones} ${item.reversiones === 1 ? "reversión" : "reversiones"} descontadas`
              : ""}
          </span>
        </span>
      </div>
      {/* ═══ LO DE PRUEBA, APARTE Y ROTULADO (Santiago, 2026-10-09) ═══

          SU CRITERIO, QUE ES EL QUE MANDA: *"hoy alguien que entre a /comercial ve que hay pendiente por
          girarle X a un profesional que NO está marcado de prueba, y se los gira pensando que son ventas
          reales, cuando esas ventas se las hizo a un paciente con el que estaba haciendo pruebas. Eso NO puede
          pasar."*

          ESTO ES DISTINTO DE LA CUENTA DE DEMOSTRACIÓN de arriba: ahí el marcado es el PROFESIONAL y no se le
          liquida nada. Aquí el profesional es real y solo PARTE de sus comisiones salen de pacientes de prueba,
          así que sí se le liquida, pero no esa parte.

          Y NO SE FILTRA EN SILENCIO, por la misma razón que él dio el 2026-10-01 para el otro caso: hacer
          desaparecer comisiones ya selladas esconde que existen. La cifra de arriba ya es la girable; esto dice
          qué quedó fuera y por qué, para que el número de abajo no se lea como un error del de arriba. */}
      {item.baseDePrueba > 0 ? (
        <p className="text-muted-foreground">
          Además hay <span className="tabular-nums text-foreground">{pesos(item.baseDePrueba)}</span> en{" "}
          {item.filasDePrueba} {item.filasDePrueba === 1 ? "comisión" : "comisiones"} de{" "}
          <strong className="text-foreground">ventas a pacientes de prueba</strong>, que no entran en la cifra de
          arriba y no se giran: esas ventas no cuentan como ingreso de CNV, así que su comisión no se causa.
        </p>
      ) : null}
      {item.esDePrueba ? (
        <p className="text-muted-foreground">
          No se liquida: es una cuenta de demostración y estas comisiones salen de ventas que no ocurrieron.
          Aparecen aquí para que se vea que existen, no para pagarlas.
        </p>
      ) : bloqueado ? (
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
  const [descarte, descartar, descartando] = useActionState(descartarLiquidacionAction, inicial);
  useFormToastAndRefresh(state);
  useFormToastAndRefresh(descarte);
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
        {/* EL CARGO VA EN LA MISMA CUENTA Y CON SU NOMBRE. El modelo lo pide explícito: "el cargo por faltante
            debe quedar IDENTIFICADO como tal en el reporte de liquidación, separado del efectivo recaudado,
            para que el Integrante entienda de dónde sale". Un neto más bajo sin la línea es una resta que
            nadie puede seguir. */}
        {item.cargosDeFaltante > 0
          ? ` − ${item.faltantesCobrados === 1 ? "faltante" : `${item.faltantesCobrados} faltantes`} ${pesos(item.cargosDeFaltante)}`
          : ""}
      </span>
      {/* ═══ A DONDE RECLAMAR EL CARGO (Santiago, 2026-09-28) ═══
          "Un canal que nadie sabe que existe no es un canal." Solo sale cuando hay cargo, y solo mientras NO se
          haya girado: después el reclamo es otra conversación, y decir que se puede revisar algo ya pagado sería
          prometer lo que el sistema no sostiene. */}
      {item.cargosDeFaltante > 0 && !item.pagadaEn ? (
        <span className="text-xs text-muted-foreground">
          El descuento por faltante se puede revisar antes del giro: si no estás de acuerdo, escribe a{" "}
          <a className="font-medium text-foreground underline" href={`mailto:${CANAL_ADMIN}`}>
            {CANAL_ADMIN}
          </a>
          .
        </span>
      ) : null}
      {/* EL DOCUMENTO SALE DEL PERFIL, y el rótulo dice de dónde: "obligado a facturar" es la condición del
          RUT que lo decide (modelo §3), y sin nombrarla el profesional no sabe por qué le toca una u otra. */}
      <span className="text-muted-foreground">
        {item.documento === "factura_del_integrante"
          ? "Obligado a facturar: él le emite la factura a CNV."
          : "No obligado a facturar: CNV emite el documento soporte electrónico."}
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
        // El Integrante ve la suya y no la gira: eso es de Dirección.
        <span className="text-muted-foreground">Calculada, pendiente de giro.</span>
      )}
      {/* DESCARTAR, SOLO MIENTRAS NO SE HAYA GIRADO. Una liquidación mal hecha RETIENE comisiones: mientras
          viva, sus filas tienen dueño y no entran en la siguiente, así que alguien se queda sin cobrar. */}
      {!item.pagadaEn && puedePagar ? (
        <form onSubmit={enviarSinReset(descartar)}>
          <input type="hidden" name="settlementId" value={item.id} />
          <Button type="submit" variant="ghost" disabled={descartando} className="w-fit px-0 text-destructive">
            Descartarla
          </Button>
          {descarte.error ? <p className="text-destructive">{descarte.error}</p> : null}
        </form>
      ) : null}
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
