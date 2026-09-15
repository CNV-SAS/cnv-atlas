import { Panel } from "@/components/shared/panel";
import { formatDate, formatDateTime } from "@/lib/format/date";

import type { EfectivoNoRecibido, VentaPorRevisar } from "../data/ventas-por-revisar";
import { plazoDeRevision } from "../plazo-de-revision";
import { ESCALADA_EFECTIVO_NO_RECIBIDO } from "../revision";
import { EnGestionForm, type EnGestionVigente } from "@/modules/avisos/components/en-gestion-form";

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

// La escalada: desde el segundo caso del mismo Integrante en 90 dias (Santiago, 2026-09-14).
const ESCALADA = ESCALADA_EFECTIVO_NO_RECIBIDO;

/** El "en gestion" vigente de cada pendiente, por "tipo:venta" (Bloque A). */
export type MapaEnGestion = Record<string, EnGestionVigente>;

function EfectivosNoRecibidos({
  efectivos,
  puedeResolver,
  enGestion,
}: {
  efectivos: EfectivoNoRecibido[];
  puedeResolver: boolean;
  enGestion: MapaEnGestion;
}) {
  if (efectivos.length === 0) return null;
  const escala = efectivos.some((e) => e.casosEn90Dias >= ESCALADA);
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-3 ${escala ? "border-destructive bg-destructive/5" : "border-border"}`}
    >
      <h3 className={`text-sm font-semibold ${escala ? "text-destructive" : "text-foreground"}`}>
        Efectivo registrado que no se recibió
      </h3>
      <p className="max-w-prose text-xs text-muted-foreground">
        Ventas en efectivo que el Integrante registró y cuyo dinero no entró. Su factura sigue emitida hasta la nota
        crédito manual en Alegra. Desde el segundo caso de un mismo Integrante en 90 días, este bloque se marca en rojo.
      </p>
      <ul className="flex flex-col gap-2">
        {efectivos.map((e) => (
          <li key={e.id} className="flex flex-col gap-1 rounded-md border border-border bg-card p-2 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <strong className="tabular-nums text-foreground">{Number(e.amount).toLocaleString("es-CO")} COP</strong>
              <span className="text-foreground">{e.profesional ?? "Sin profesional"}</span>
              <span className="text-muted-foreground">marcada el {formatDateTime(e.marcadaEn)}</span>
              {e.factura ? <span className="text-xs text-muted-foreground">factura {e.factura}</span> : null}
              <span
                className={`rounded px-2 py-0.5 text-xs ${e.casosEn90Dias >= ESCALADA ? "bg-destructive text-white" : "bg-muted text-muted-foreground"}`}
              >
                {e.casosEn90Dias} caso{e.casosEn90Dias === 1 ? "" : "s"} en 90 días
              </span>
            </div>
            {e.notaCredito ? (
              <span className="text-xs text-muted-foreground">Nota crédito manual: {e.notaCredito}</span>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-attention">Falta la nota crédito manual en Alegra.</span>
                {puedeResolver ? (
                  <div>
                    <AccionDeVentaButton transactionId={e.id} tipo="nota_credito" />
                  </div>
                ) : null}
                <EnGestionForm tipo="nota_credito" transactionId={e.id} vigente={enGestion[`nota_credito:${e.id}`] ?? null} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VentasPorRevisar({
  ventas,
  efectivos,
  ahora,
  puedeResolver,
  enGestion,
}: {
  ventas: VentaPorRevisar[];
  efectivos: EfectivoNoRecibido[];
  ahora: Date;
  /** Admin y direccion resuelven; soporte atiende (ve y marca en gestion) pero no resuelve (Bloque A). */
  puedeResolver: boolean;
  enGestion: MapaEnGestion;
}) {
  return (
    <Panel titulo="Ventas por revisar">
      <EfectivosNoRecibidos efectivos={efectivos} puedeResolver={puedeResolver} enGestion={enGestion} />
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
                  {puedeResolver ? (
                    <VersionDelIntegranteForm
                      key={v.version ?? "sin-version"}
                      transactionId={v.id}
                      actual={v.version}
                      titulo="Versión del Integrante: qué pasó en la consulta"
                    />
                  ) : null}
                  {/* Sin la version no se ofrece resolver: es el soporte que pide contabilidad, y la accion
                      tambien lo exige. */}
                  {puedeResolver && v.version ? (
                    <div className="flex flex-wrap gap-2">
                      <AccionDeVentaButton transactionId={v.id} tipo="segunda_compra" />
                      <AccionDeVentaButton transactionId={v.id} tipo="devuelto" />
                      {v.efectivo === "si" ? <AccionDeVentaButton transactionId={v.id} tipo="efectivo_no_recibido" /> : null}
                    </div>
                  ) : null}
                  <EnGestionForm tipo="revision" transactionId={v.id} vigente={enGestion[`revision:${v.id}`] ?? null} />
                  {v.version && v.efectivo === "no_coinciden" ? (
                    <p className="text-xs text-muted-foreground">
                      Si el efectivo no se recibió: la venta en efectivo que anuló este link no coincide en productos y
                      cantidades, así que resuélvelo con contabilidad.
                    </p>
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
