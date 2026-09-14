import { Panel } from "@/components/shared/panel";
import { formatDate, formatDateTime } from "@/lib/format/date";

import type { VentaPorRevisar } from "../data/ventas-por-revisar";
import { plazoDeRevision } from "../plazo-de-revision";
import { AccionDeVentaButton } from "./accion-de-venta-button";
import { VersionDelIntegranteForm } from "./version-del-integrante-form";

// ═══ VENTAS POR REVISAR (Bloque 3, sesion 2) ═══
//
// Antes estos avisos quedaban en la venta y en Sentry, y nadie de CNV mira Sentry. Aqui los ve quien ve el
// ingreso. VA ANTES de la lista de transacciones por la misma razon que las facturas pendientes: al final de
// la pagina no lo mira nadie. Y NO SE ESCONDE VACIO: el cero es el dato.

const ROTULO: Record<VentaPorRevisar["motivo"], string> = {
  pago_sobre_link_anulado: "Pago sobre un link anulado",
  sin_saldo: "Vendida sin saldo en Atlas",
  fallido: "Inventario sin descontar",
};

const EXPLICACION: Record<VentaPorRevisar["motivo"], string> = {
  pago_sobre_link_anulado:
    "Llegó un pago aprobado de Wompi sobre un link que Atlas ya había anulado. Lo más común: un pago con PSE o Nequi que parecía fallido, el paciente pagó en efectivo, y la aprobación llegó después. No se factura, no se descuenta y no se entrega hasta decidir. Primero la versión del Integrante; después, si fue un cobro doble, devuelve el pago desde Wompi y márcalo como devuelto con su comprobante; si el paciente quería las dos compras, márcala como segunda compra y Atlas descuenta y factura.",
  sin_saldo:
    "Se descontó lo que había y faltaron unidades: el saldo de esa ubicación no cuadra con la vitrina. Revisa si falta registrar una recepción.",
  fallido: "El descuento de inventario no corrió. «Reintentar las pendientes» lo vuelve a intentar.",
};

function Plazo({ abierta, ahora }: { abierta: string; ahora: Date }) {
  const p = plazoDeRevision(new Date(abierta), ahora);
  const hasta = formatDate(p.limite);
  const texto =
    p.estado === "vencido"
      ? `Plazo vencido el ${hasta}.`
      : p.porCierreDeBimestre
        ? `Resuélvela a más tardar el ${hasta}, antes del cierre del bimestre.`
        : `Resuélvela a más tardar el ${hasta} (${p.diasHabilesRestantes} día${p.diasHabilesRestantes === 1 ? "" : "s"} hábil${p.diasHabilesRestantes === 1 ? "" : "es"}).`;
  return <p className={`text-xs ${p.estado === "a_tiempo" ? "text-muted-foreground" : "font-medium text-attention"}`}>{texto}</p>;
}

export function VentasPorRevisar({ ventas, ahora }: { ventas: VentaPorRevisar[]; ahora: Date }) {
  return (
    <Panel titulo="Ventas por revisar">
      <p className="text-sm text-muted-foreground">
        {ventas.length === 0
          ? "Ninguna. No hay pagos por decidir ni avisos de inventario en los últimos 30 días."
          : `${ventas.length} venta${ventas.length === 1 ? "" : "s"} con algo por revisar.`}
      </p>
      {ventas.length > 0 && (
        <ul className="flex flex-col gap-2">
          {ventas.map((v) => (
            <li key={`${v.id}-${v.motivo}`} className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <strong className="text-foreground tabular-nums">{Number(v.amount).toLocaleString("es-CO")} COP</strong>
                <span className="text-muted-foreground">{formatDateTime(v.fecha)}</span>
                <span className="rounded bg-attention-bg px-2 py-0.5 text-xs text-attention">{ROTULO[v.motivo]}</span>
                <span className="text-xs text-muted-foreground">{v.productos}</span>
              </div>
              <p className="max-w-prose text-xs text-muted-foreground">{EXPLICACION[v.motivo]}</p>
              {v.detalle && <p className="break-words font-mono text-xs text-muted-foreground">{v.detalle}</p>}
              {v.motivo === "pago_sobre_link_anulado" && (
                <div className="flex flex-col gap-2">
                  <Plazo abierta={v.abierta} ahora={ahora} />
                  {v.version ? (
                    <div className="flex flex-col gap-1 rounded-md bg-muted/40 p-2">
                      <span className="text-xs font-medium text-foreground">Versión del Integrante</span>
                      <p className="max-w-prose whitespace-pre-wrap text-sm text-foreground">{v.version}</p>
                      <span className="text-xs text-muted-foreground">
                        Escrita por {v.versionPor ?? "alguien de Atlas"}
                        {v.versionEn ? ` el ${formatDateTime(v.versionEn)}` : ""}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-attention">
                      Falta la versión del Integrante. Pídesela, o escribe lo que te contó.
                    </p>
                  )}
                  <VersionDelIntegranteForm
                    key={v.version ?? "sin-version"}
                    transactionId={v.id}
                    actual={v.version}
                    titulo="Versión del Integrante: qué pasó en la consulta"
                  />
                  {/* Sin la version no se ofrece resolver: es el soporte que pide contabilidad, y la accion
                      tambien lo exige. */}
                  {v.version ? (
                    <div className="flex flex-wrap gap-2">
                      <AccionDeVentaButton transactionId={v.id} tipo="segunda_compra" />
                      <AccionDeVentaButton transactionId={v.id} tipo="devuelto" />
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
