import { theadTr, th, thNum } from "@/components/shared/tabla";
import { TituloSeccion } from "@/components/shared/titulo-pantalla";

import type { ConsolidadoDeDespachos } from "../data/despachos-reader";

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

// ═══ EL CONSOLIDADO QUE SOPORTA EL PAGO AL DOMICILIARIO (2026-09-29) ═══
//
// LO PIDIO CONTABILIDAD, y su razon es de plata: el pago al domiciliario no es deducible sin soporte. Sin el,
// CNV registra el ingreso del flete y no puede restar lo que pagó, así que tributa sobre un ingreso que no
// ganó. El documento lo emite Alegra; esto es lo que va dentro.
//
// SE MUESTRAN LOS DOS CORTES, y el anterior primero: el que se paga es el que ya cerró. El corriente está
// abierto y su total todavía sube.
function Corte({ c, titulo, nota }: { c: ConsolidadoDeDespachos; titulo: string; nota: string }) {
  if (c.despachos.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">
        {titulo} · del {c.corte.desde} al {c.corte.hasta}
      </span>
      <p className="max-w-prose text-xs text-muted-foreground">{nota}</p>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-xs">
          <thead>
            <tr className={theadTr}>
              <th className={th}>Día</th>
              <th className={th}>Destino</th>
              <th className={th}>Entregado</th>
              <th className={thNum}>Domiciliario</th>
              <th className={thNum}>Cobrado</th>
            </tr>
          </thead>
          <tbody>
            {c.despachos.map((d) => (
              <tr key={d.transactionId} className="border-b border-border/60">
                <td className="px-3 py-2 text-muted-foreground">{d.dia}</td>
                <td className="px-3 py-2 text-foreground">
                  {d.ciudad ?? "-"}
                  {d.departamento ? ` (${d.departamento})` : ""}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{d.entregadoEl ?? "sin entregar"}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">
                  {pesos(d.costo)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{pesos(d.flete)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-3 py-2 text-foreground" colSpan={3}>
                {c.despachos.length} {c.despachos.length === 1 ? "envío" : "envíos"}
              </td>
              <td className="px-3 py-2 text-right font-bold tabular-nums text-foreground">
                {pesos(c.totalCosto)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{pesos(c.totalFlete)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {/* LA DIFERENCIA SE NOMBRA Y SE EXPLICA: no es margen de CNV, es lo que se lleva la pasarela por cobrar
          el flete. Sin decirlo, alguien la va a leer como una ganancia del envío y no lo es. */}
      <span className="text-xs text-muted-foreground">
        Al domiciliario se le pagan <strong className="text-foreground">{pesos(c.totalCosto)}</strong>. La
        diferencia con lo cobrado ({pesos(c.diferencia)}) se la lleva la pasarela por cobrar el envío: no es
        margen.
      </span>
    </div>
  );
}

export function ConsolidadoDeDespachosSection({
  anterior,
  corriente,
}: {
  anterior: ConsolidadoDeDespachos;
  corriente: ConsolidadoDeDespachos;
}) {
  if (anterior.despachos.length === 0 && corriente.despachos.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      <TituloSeccion>Envíos a domicilio, para pagarle al domiciliario</TituloSeccion>
      <p className="max-w-prose text-sm text-muted-foreground">
        Este es el detalle que soporta el pago quincenal.{" "}
        <strong className="text-foreground">El documento lo emite Alegra</strong> (documento soporte si el
        domiciliario es persona natural no obligada a facturar, o su factura si es una empresa): sin ese papel,
        el gasto no es deducible y CNV termina tributando sobre un ingreso que no ganó.
      </p>
      <Corte
        c={anterior}
        titulo="Corte cerrado"
        nota="Es el que toca pagar: el período ya cerró y su total no cambia."
      />
      <Corte
        c={corriente}
        titulo="Corte en curso"
        nota="Todavía abierto: su total sube con cada envío que se cobre hasta el cierre."
      />
    </div>
  );
}
