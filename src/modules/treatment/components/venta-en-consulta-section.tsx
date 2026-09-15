import { bloqueCls } from "@/components/shared/bloque";
import { formatDateTime } from "@/lib/format/date";
import { requireUser } from "@/modules/auth/session";
import * as nutraService from "@/modules/nutraceuticals/services/nutraceuticals-service";
import { getDespachosForTreatment } from "@/modules/nutraceuticals/services/inventory-service";
import { AccionDeVentaButton } from "@/modules/payments/components/accion-de-venta-button";
import { VersionDelIntegranteForm } from "@/modules/payments/components/version-del-integrante-form";
import { CheckoutLink } from "@/modules/payments/components/checkout-link";
import { CHECKOUT_TTL_MS } from "@/modules/payments/data/checkout-reader";
import {
  getProfessionalProfileIdByUser,
  listVentasDeTratamiento,
  type VentaDeTratamiento,
} from "@/modules/payments/data/payments-repository";
import { canDeliverSale } from "@/modules/payments/policies/can-deliver-sale";
import { disponibleParaVender } from "@/modules/payments/services/payments-service";
import { bloqueadaPorRevision } from "@/modules/payments/revision";
import { qrDelLink } from "@/modules/payments/services/qr-del-link";

import type { TreatmentProtocol } from "../data/treatment-reader";
import { EsperandoPago } from "./esperando-pago";
import { VentaEnConsultaForm } from "./venta-en-consulta-form";

// ═══ LA VENTA EN CONSULTA (Bloque 3, sesion 2) ═══
//
// REEMPLAZA A LA SECCION DE DESPACHO. Antes la entrega era un movimiento de inventario suelto que no sabia de
// la venta: un producto podia salir del consultorio sin cobrarse, y una venta de `/pagos` descontaba el
// inventario OTRA VEZ si ademas se registraba su entrega. Ahora es una sola secuencia: se cobra (QR o
// efectivo), el pago descuenta el inventario al sellarse, y la entrega es el ultimo paso, sobre la venta
// pagada, y queda en la auditoria clinica.
//
// LO QUE SE MANTIENE DEL ARCHIVO DE GILDARDO (Regla 0, cotejado contra el ATLAS_v8 del 4 de septiembre): que
// se entrega de lo PRESCRITO y en cuantas unidades. Lo que cambia es comercial (el cobro), que su archivo no
// modela.
//
// Separacion clinico/comercial, la de siempre: la venta liga producto y paciente (lo ve el profesional del
// paciente, por RLS); el saldo del inventario es comercial y se consulta en Mi inventario.

// Venta con el link todavia pagable desde nuestra pagina: `pending` y dentro de las 24 horas.
function linkVivo(v: VentaDeTratamiento, ahoraMs: number): boolean {
  return v.status === "pending" && new Date(v.created_at).getTime() + CHECKOUT_TTL_MS > ahoraMs;
}

function productosDe(v: VentaDeTratamiento): string {
  return v.transaction_items.map((it) => `${it.nutraceuticals?.name ?? "Nutracéutico"} x${it.quantity}`).join(", ");
}

export async function VentaEnConsultaSection({
  evaluationId,
  protocol,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
}) {
  // LA VENTA CUELGA DE HABER ENTREGADO LA PRESCRIPCION, igual que colgaba la entrega (2026-09-09): es un acto
  // POSTERIOR a prescribir, y lo que marca ese momento es haberla entregado (impresa o por correo). Un gate
  // por la confirmacion del diagnostico la dejaria inalcanzable sin dar ningun error.
  if (protocol.emisiones.length === 0) return null;

  // Vendibles = prescritos que son en_consultorio, sin duplicados por producto.
  const availById = new Map(protocol.catalog.map((c) => [c.id, c.commercialAvailability]));
  const byId = new Map<string, string>();
  for (const n of protocol.nutraceuticals) {
    if (availById.get(n.nutraceuticalId) === "en_consultorio") byId.set(n.nutraceuticalId, n.name);
  }

  // CUANDO NO HAY NADA QUE VENDER AQUI, SE DICE POR QUE (la leccion de la ausencia contra la fila vacia: un
  // bloque que no esta no informa de nada).
  if (byId.size === 0) {
    const noVendibles = protocol.nutraceuticals.filter((n) => availById.get(n.nutraceuticalId) !== "en_consultorio");
    const soloTienda = noVendibles.filter((n) => availById.get(n.nutraceuticalId) === "solo_tienda");
    const noDisponibles = noVendibles.filter((n) => availById.get(n.nutraceuticalId) !== "solo_tienda");
    return (
      <section className={bloqueCls("derivado")}>
        <h3 className="text-sm font-semibold text-foreground">Venta y entrega de nutracéuticos</h3>
        {noVendibles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay nada que vender: todavía no has prescrito ningún nutracéutico.
          </p>
        ) : (
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>Lo que prescribiste no se vende en consultorio:</p>
            <ul className="ml-4 list-disc">
              {soloTienda.map((n) => (
                <li key={n.nutraceuticalId}>
                  <span className="text-foreground">{n.name}</span> · se compra en la tienda
                </li>
              ))}
              {noDisponibles.map((n) => (
                <li key={n.nutraceuticalId}>
                  <span className="text-foreground">{n.name}</span> · aún no está disponible
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  const user = await requireUser();
  const ids = [...byId.keys()];
  const [catalogo, disponible, ventas, despachos, perfilPropio] = await Promise.all([
    nutraService.listCatalog(),
    disponibleParaVender(user, ids),
    listVentasDeTratamiento(protocol.treatmentId),
    getDespachosForTreatment(protocol.treatmentId),
    getProfessionalProfileIdByUser(user.id),
  ]);
  const precio = new Map(catalogo.map((c) => [c.id, c.unit_price == null ? null : Number(c.unit_price)]));
  const productos = ids.map((id) => ({
    id,
    name: byId.get(id) ?? "",
    unitPrice: precio.get(id) ?? null,
    disponible: disponible[id] ?? 0,
  }));

  // La pagina es dinamica (requireUser): el tiempo del request es el que se quiere mostrar.
  // eslint-disable-next-line react-hooks/purity
  const ahoraMs = Date.now();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const qrs = new Map(
    await Promise.all(
      ventas
        .filter((v) => linkVivo(v, ahoraMs))
        .map(async (v) => [v.id, await qrDelLink(`${appUrl}/checkout/${v.id}`)] as const),
    ),
  );
  const hayLinkVivo = qrs.size > 0;

  return (
    <section className={bloqueCls("derivado")}>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-foreground">Venta y entrega de nutracéuticos</h3>
        <p className="max-w-prose text-sm text-muted-foreground">
          Marca lo que el paciente se lleva de lo prescrito y cobra. Cuando el pago esté recibido, registra la
          entrega. El inventario se descuenta solo al pagarse.
        </p>
      </div>

      <VentaEnConsultaForm
        evaluationId={evaluationId}
        treatmentId={protocol.treatmentId}
        patientId={protocol.patientId}
        productos={productos}
      />

      {ventas.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ventas de esta consulta</h4>
          {hayLinkVivo ? <EsperandoPago /> : null}
          <ul className="flex flex-col gap-2">
            {ventas.map((v) => (
              <li key={v.id} className="flex flex-col gap-2 rounded-md border border-border px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{productosDe(v)}</span>
                  <span className="text-sm tabular-nums text-foreground">
                    {Number(v.amount).toLocaleString("es-CO")} COP
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(v.created_at)} · {v.payment_method === "efectivo" ? "Efectivo" : "QR"}
                </span>
                <EstadoDeLaVenta
                  venta={v}
                  qr={qrs.get(v.id) ?? null}
                  url={`${appUrl}/checkout/${v.id}`}
                  horasRestantes={Math.floor((new Date(v.created_at).getTime() + CHECKOUT_TTL_MS - ahoraMs) / 3_600_000)}
                  puedeEntregar={canDeliverSale(user, v, perfilPropio)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Las entregas registradas ANTES de la venta en consulta: son historia y se siguen viendo. */}
      {despachos.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Entregas registradas antes de la venta en consulta
          </h4>
          <ul className="ml-4 list-disc text-sm text-foreground">
            {despachos.map((m) => (
              <li key={m.id}>
                <span className="text-muted-foreground">{m.createdAt.slice(0, 10)}</span> {m.nutraceuticalName}:{" "}
                <span className="font-medium">{Math.abs(m.delta)} unidad(es)</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function EstadoDeLaVenta({
  venta: v,
  qr,
  url,
  horasRestantes,
  puedeEntregar,
}: {
  venta: VentaDeTratamiento;
  qr: string | null;
  url: string;
  horasRestantes: number;
  puedeEntregar: boolean;
}) {
  if (v.status === "pending") {
    return (
      <div className="flex flex-col gap-2">
        {qr ? (
          <>
            {/* Imagen data: generada en el servidor; nada de HTML insertado. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Código QR del link de pago" width={240} height={240} className="rounded-md border border-border bg-white p-1" />
            <CheckoutLink url={url} hoursLeft={horasRestantes} />
          </>
        ) : (
          <span className="text-sm text-muted-foreground">El link venció sin pagarse.</span>
        )}
        <div>
          <AccionDeVentaButton transactionId={v.id} tipo="anular" />
        </div>
      </div>
    );
  }
  if (v.status === "failed") {
    return (
      <span className="text-sm text-muted-foreground">
        {v.cancelled_at ? "Link anulado." : "Pago rechazado. Puedes cobrar de nuevo."}
      </span>
    );
  }
  if (v.cash_not_received_at) {
    return (
      <span className="text-sm text-muted-foreground">
        Anulada por CNV: el efectivo no se recibió. La venta válida es el pago con QR del mismo producto.
      </span>
    );
  }
  if (v.status === "refunded") {
    return <span className="text-sm text-muted-foreground">Pago devuelto al paciente.</span>;
  }
  if (bloqueadaPorRevision(v)) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-sm text-clinical-warning">
          Pago en revisión por CNV: llegó sobre un link anulado y puede ser un cobro doble. No entregues el producto
          hasta que se resuelva.
        </span>
        {puedeEntregar ? (
          <VersionDelIntegranteForm
            key={v.review_professional_version ?? "sin-version"}
            transactionId={v.id}
            actual={v.review_professional_version}
            titulo="Cuéntale a CNV qué pasó en la consulta"
          />
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-clinical-optimal">Pago recibido.</span>
      {v.stock_state === "sin_saldo" ? (
        <span className="text-xs text-clinical-warning">
          Tu inventario en Atlas no alcanzaba para esta venta. CNV lo va a revisar; puedes entregar el producto.
        </span>
      ) : v.stock_state === "fallido" ? (
        <span className="text-xs text-clinical-warning">
          No se pudo descontar el inventario todavía. CNV lo reintenta; puedes entregar el producto.
        </span>
      ) : null}
      {v.fulfillment_state === "entregado" && v.delivered_at ? (
        <span className="text-sm text-muted-foreground">Entregado el {formatDateTime(v.delivered_at)}.</span>
      ) : v.fulfillment_state === "pendiente" ? (
        puedeEntregar ? (
          <div>
            <AccionDeVentaButton transactionId={v.id} tipo="entregar" />
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Pendiente de entrega.</span>
        )
      ) : null}
    </div>
  );
}
