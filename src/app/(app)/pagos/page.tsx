import { redirect } from "next/navigation";

import { conLimite } from "@/lib/observability/con-limite";
import { CotejoConWompi } from "@/modules/payments/components/cotejo-con-wompi";
import { ReversasDeVenta } from "@/modules/payments/components/reversas-de-venta";
import { listarReversas } from "@/modules/payments/data/reversas-writer";
import { ultimaCorrida } from "@/modules/payments/data/conciliacion-repository";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TituloPantalla, TituloSeccion } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { formatDateTime } from "@/lib/format/date";
import * as nutraService from "@/modules/nutraceuticals/services/nutraceuticals-service";
import { AccionDeVentaButton } from "@/modules/payments/components/accion-de-venta-button";
import { CheckoutLink } from "@/modules/payments/components/checkout-link";
import {
  CreateCheckoutForm,
  type CheckoutNutraceutical,
  type CheckoutPatient,
} from "@/modules/payments/components/create-checkout-form";
import { RegisterCashSaleForm } from "@/modules/payments/components/register-cash-sale-form";
import {
  getProfessionalProfileIdByUser,
  listSelectablePatients,
  listTransactions,
} from "@/modules/payments/data/payments-repository";
import {
  contarVentasSinDocumentoPorDia,
  listarVentasSinDocumento,
} from "@/modules/payments/data/facturacion-repository";
import { FacturasPendientes } from "@/modules/payments/components/facturas-pendientes";
import { VentasPorRevisar } from "@/modules/payments/components/ventas-por-revisar";
import { bloqueadaPorRevision } from "@/modules/payments/revision";
import { VersionDelIntegranteForm } from "@/modules/payments/components/version-del-integrante-form";
import { listarEfectivosNoRecibidos, listarVentasPorRevisar } from "@/modules/payments/data/ventas-por-revisar";
import { canCreateCheckout } from "@/modules/payments/policies/can-create-checkout";
import { canDeliverSale } from "@/modules/payments/policies/can-deliver-sale";
import { canViewRevenue } from "@/modules/payments/policies/can-view-revenue";
import { listarPendientesDeAccion } from "@/modules/avisos/data/avisos-repository";
import { canAtenderPendientesVentas } from "@/modules/avisos/policies/can-atender-pendientes";
import type { TransactionStatus, TransactionWithItems } from "@/modules/payments/types";

export const metadata = { title: "Pagos - Atlas" };

// DURACION MAXIMA DE LA FUNCION (2026-09-14). Las acciones de esta pagina facturan (venta en efectivo y "Reintentar"): la emision en Alegra espera el sellado de la
// DIAN con un timeout de 60 s, y alrededor van el contacto, la relectura y el pago (15 s cada uno). Se declara
// explicito para no depender del valor por defecto del proyecto en Vercel: con Fluid compute es 300 s en todo
// plan; si el plan no admitiera este valor, el deployment falla con error en vez de cortar la funcion a mitad
// de una factura.
export const maxDuration = 180;


// Estado de la transaccion como badge con los tintes clinicos reutilizados.
const STATUS_META: Record<TransactionStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-clinical-warning-bg text-clinical-warning" },
  paid: { label: "Pagado", className: "bg-clinical-optimal-bg text-clinical-optimal" },
  failed: { label: "Fallido", className: "bg-clinical-critical-bg text-clinical-critical" },
  refunded: { label: "Reembolsado", className: "bg-muted text-muted-foreground" },
};

// UN LINK ANULADO NO ES UN PAGO FALLIDO, y en la lista se tienen que distinguir: "Fallido" le dice al
// profesional que la tarjeta del paciente no paso; "Anulado", que lo cerro alguien de Atlas. Y una venta
// EN REVISION esta pagada pero no se factura ni se descuenta hasta que CNV la revise.
function TxStatusBadge({ tx }: { tx: TransactionWithItems }) {
  const meta =
    tx.cash_not_received_at
      ? { label: "Anulada por CNV", className: "bg-muted text-muted-foreground" }
      : tx.status === "failed" && tx.cancelled_at
      ? { label: "Anulado", className: "bg-muted text-muted-foreground" }
      : tx.status === "paid" && tx.review_reason && !tx.review_resolution
        ? { label: "En revisión", className: "bg-clinical-warning-bg text-clinical-warning" }
        : STATUS_META[tx.status as TransactionStatus];
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  );
}

// Medio de pago: distingue una venta en efectivo de una de la pasarela (se ven iguales en la lista, y
// con la liquidacion viniendo, distinguirlas importa).
const METODO_LABEL: Record<string, string> = { wompi: "Pasarela", efectivo: "Efectivo" };

// LA ENTREGA DE LA VENTA (Bloque 3, sesion 2). Una venta pagada muestra si el paciente ya se llevo el producto
// y, a quien puede entregarla, el boton. Aqui entrega el paciente que vuelve SOLO A COMPRAR, sin consulta: sin
// esto, su venta no tendria donde registrarse como entregada.
function EntregaDeLaVenta({ tx, puedeEntregar }: { tx: TransactionWithItems; puedeEntregar: boolean }) {
  if (tx.cash_not_received_at) {
    return (
      <span className="text-xs text-muted-foreground">
        CNV determinó que el efectivo de esta venta no se recibió. La venta válida es el pago de Wompi del mismo producto.
      </span>
    );
  }
  if (tx.fulfillment_state === "entregado" && tx.delivered_at) {
    // CON LA HORA, no solo el dia (Santiago, smoke del 2026-09-14): orienta al profesional sobre en que
    // momento de la consulta se entrego.
    return <span className="text-xs text-muted-foreground">Entregado el {formatDateTime(tx.delivered_at)}</span>;
  }
  if (tx.fulfillment_state !== "pendiente" || tx.status !== "paid") return null;
  if (bloqueadaPorRevision(tx)) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs text-clinical-warning">
          Pago en revisión por CNV: no entregues el producto hasta que se resuelva.
        </span>
        {/* El profesional de la venta cuenta que paso: es lo que Direccion necesita para resolver. */}
        {puedeEntregar ? (
          <VersionDelIntegranteForm
            key={tx.review_professional_version ?? "sin-version"}
            transactionId={tx.id}
            actual={tx.review_professional_version}
            titulo="Cuéntale a CNV qué pasó en la consulta"
          />
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-clinical-warning">Pagado, sin entregar</span>
      {tx.stock_state === "sin_saldo" ? (
        <span className="text-xs text-clinical-warning">· tu inventario en Atlas no alcanzaba; CNV lo revisa</span>
      ) : null}
      {puedeEntregar ? <AccionDeVentaButton transactionId={tx.id} tipo="entregar" /> : null}
    </div>
  );
}

function itemsLabel(tx: TransactionWithItems): string {
  if (tx.transaction_items.length === 0) return "Sin items";
  return tx.transaction_items
    .map((it) => `${it.nutraceuticals?.name ?? "Nutracéutico"} x${it.quantity}`)
    .join(", ");
}

// Pagos: crear checkout de nutraceuticos (professional/admin) y ver el historial de
// transacciones (la RLS filtra: el profesional ve las suyas, admin/direccion todas).
const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function PagosPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const user = await requireUser();
  // El dia del reporte de ventas sin documento. Un valor que no es fecha se ignora: se muestran todas.
  const sp = await searchParams;
  const dia = sp.dia && DIA_RE.test(sp.dia) ? sp.dia : null;
  const canCreate = canCreateCheckout(user);
  const canView = canViewRevenue(user);
  // SOPORTE ATIENDE LOS PENDIENTES (Bloque A): con la marca de avisos le llegan por correo, y un correo que lleva
  // a una pantalla que no puede abrir no sirve. Ve los paneles y marca "en gestion"; no resuelve ni reintenta.
  const canAtender = canAtenderPendientesVentas(user);
  const verPaneles = canView || canAtender;
  if (!canCreate && !verPaneles) redirect("/no-autorizado");

  // CADA CARGA CON SU LIMITE Y SU NOMBRE (2026-09-16). Esta pantalla arma ocho consultas y se colgo entera por
  // una sola: Vercel la corto con un 504 y no quedo ni error ni rastro de cual fue. Ahora la que no llegue se
  // reporta con su nombre y la pantalla sigue con lo demas, avisando de lo que falto.
  const [transacciones, perfil] = await Promise.all([
    conLimite("pagos.transacciones", listTransactions, [] as TransactionWithItems[]),
    conLimite("pagos.perfil-propio", () => getProfessionalProfileIdByUser(user.id), null as string | null),
  ]);
  const transactions = transacciones.dato;
  const perfilPropio = perfil.dato;
  // Solo para quien ve el ingreso: el panel muestra lo que se cobro y no tiene documento, que es
  // informacion contable. Un profesional no tiene nada que hacer con ella y si tendria con la lista de sus
  // transacciones, que se muestra igual.
  const paneles = verPaneles
    ? await Promise.all([
        conLimite("pagos.ventas-sin-documento", () => listarVentasSinDocumento(50, dia), []),
        conLimite("pagos.ventas-por-revisar", listarVentasPorRevisar, []),
        conLimite("pagos.efectivos-no-recibidos", listarEfectivosNoRecibidos, []),
        conLimite("pagos.dias-con-ventas-sin-cerrar", contarVentasSinDocumentoPorDia, []),
        conLimite("pagos.pendientes-de-accion", listarPendientesDeAccion, []),
        conLimite("pagos.reversas", listarReversas, []),
      ])
    : [];
  // El cotejo con Wompi lo ve quien responde por el dinero (no soporte): recuperar un pago sella ingreso,
  // comision y factura.
  const cotejo = canView ? await conLimite("pagos.ultimo-cotejo", ultimaCorrida, null) : null;
  const ventasSinDocumento = paneles[0]?.dato ?? [];
  const ventasPorRevisar = paneles[1]?.dato ?? [];
  const efectivosNoRecibidos = paneles[2]?.dato ?? [];
  const sinDocumentoPorDia = paneles[3]?.dato ?? [];
  const pendientes = paneles[4]?.dato ?? [];
  const reversas = paneles[5]?.dato ?? [];
  // EL ESTADO DE LA REVERSA, TAMBIEN EN LA LISTA (smoke del 2026-09-17): una venta con la disputa perdida se veia
  // ahi como cualquier otra, con su factura y su entrega, sin rastro de que el dinero se habia devuelto.
  const reversaDe = new Map(reversas.map((r) => [r.transactionId, r]));
  const algoNoCargo = transacciones.fallo || perfil.fallo || paneles.some((p) => p.fallo);
  // El "en gestion" VIGENTE (hasta hoy o despues) de cada pendiente. Uno vencido ya no se muestra como en gestion.
  const hoyBogota = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const enGestion = Object.fromEntries(
    pendientes
      .filter((p) => p.enGestionHasta && p.enGestionHasta >= hoyBogota && p.enGestionNota)
      .map((p) => [`${p.tipo}:${p.transactionId}`, { hasta: p.enGestionHasta!, nota: p.enGestionNota!, por: p.enGestionPor }]),
  );
  // Para recuperar el enlace de un checkout pendiente sin generar otro: el link es derivable del id
  // (misma forma que buildCheckoutUrl). Horas restantes del TTL de 24h contra el created_at.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  // Date.now es "impuro" para la regla de pureza, pero esta es una pagina DINAMICA (requireUser, sin
  // cache): el tiempo de request es exactamente lo que se quiere mostrar. Se acota a esta linea.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const hoursLeftOf = (createdAt: string) =>
    Math.floor((new Date(createdAt).getTime() + 24 * 60 * 60 * 1000 - nowMs) / (60 * 60 * 1000));

  let patients: CheckoutPatient[] = [];
  let nutraceuticals: CheckoutNutraceutical[] = [];
  if (canCreate) {
    const [pts, catalog] = await Promise.all([
      listSelectablePatients(),
      nutraService.listCatalog(),
    ]);
    patients = pts;
    // ═══ LA DISPONIBILIDAD TAMBIEN GATEA LA VENTA, NO SOLO LA ENTREGA (2026-09-11) ═══
    //
    // EL HUECO: este filtro miraba SOLO si el producto tiene precio. La entrega si comprueba la
    // disponibilidad (`recordDespacho` bloquea todo lo que no sea `en_consultorio`), asi que un producto
    // marcado `no_disponible` no se podia entregar... y si se podia VENDER desde aqui. La bandera gateaba
    // media puerta.
    //
    // POR QUE IMPORTA AHORA: LUVIA entra al catalogo como producto de tercero y NO puede venderse hasta
    // que Gildardo firme las equivalencias de alergenos. `no_disponible` es lo que tenia que impedirlo, y
    // sin esta linea no lo impedia.
    //
    // `solo_tienda` TAMBIEN QUEDA FUERA, y es la otra mitad del arreglo: ese producto lo compra el
    // paciente en la tienda, asi que cobrarlo aqui seria cobrarle dos veces por el mismo producto.
    nutraceuticals = catalog
      .filter((n) => n.unit_price != null && n.commercial_availability === "en_consultorio")
      .map((n) => ({ id: n.id, name: n.name, unitPrice: Number(n.unit_price) }));
  }

  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-6">
      {/* SIN SUBTITULO: enumeraba las dos secciones que la pantalla ya muestra. */}
      <TituloPantalla titulo="Pagos" />

      {algoNoCargo ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Parte de esta pantalla no cargó. Lo que ves está bien, pero puede faltar información: vuelve a intentarlo
          en un momento. Ya quedó reportado.
        </p>
      ) : null}

      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Crear checkout</CardTitle>
            <CardDescription>
              Genera un link de pago (vale 24 horas) para que el paciente pague en Wompi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateCheckoutForm patients={patients} nutraceuticals={nutraceuticals} />
          </CardContent>
        </Card>
      ) : null}

      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Registrar venta en efectivo</CardTitle>
            <CardDescription>
              Cobro en efectivo, ya pagado. El precio y el producto son de CNV; el dinero que recaudas es de
              CNV y lo custodias hasta consignar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterCashSaleForm patients={patients} nutraceuticals={nutraceuticals} />
          </CardContent>
        </Card>
      ) : null}

      {/* VA ANTES DE LA LISTA DE TRANSACCIONES a proposito: es lo que hay que mirar y resolver, y al
          final de la pagina no lo mira nadie. Contabilidad lo quiere en CERO al cierre de cada dia. */}
      {verPaneles && reversas.length > 0 ? (
        <ReversasDeVenta reversas={reversas} puedeResolver={canView} enGestion={enGestion} />
      ) : null}
      {verPaneles && (
        <VentasPorRevisar
          ventas={ventasPorRevisar}
          efectivos={efectivosNoRecibidos}
          ahora={new Date(nowMs)}
          puedeResolver={canView}
          enGestion={enGestion}
        />
      )}
      {canView ? <CotejoConWompi ultima={cotejo?.dato ?? null} /> : null}
      {verPaneles && (
        <FacturasPendientes
          ventas={ventasSinDocumento}
          dia={dia}
          porDia={sinDocumentoPorDia}
          puedeReintentar={canView}
          enGestion={enGestion}
        />
      )}

      <section className="flex flex-col gap-3">
        <TituloSeccion>Transacciones</TituloSeccion>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aun no hay transacciones.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {transactions.map((tx) => (
              <Card key={tx.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <CardTitle className="text-base">
                        {Number(tx.amount).toLocaleString("es-CO")} {tx.currency}
                      </CardTitle>
                      <CardDescription>{itemsLabel(tx)}</CardDescription>
                      <span className="text-xs text-muted-foreground">
                        {/* Con la hora (smoke del 2026-09-14): aqui nunca la hubo, era solo la fecha. */}
                        {formatDateTime(tx.created_at)}
                        {" · "}
                        {METODO_LABEL[tx.payment_method] ?? tx.payment_method}
                        {tx.alegra_invoice_id ? ` · Factura Alegra ${tx.alegra_invoice_id}` : ""}
                      </span>
                      {tx.status === "pending" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <CheckoutLink
                            url={`${appUrl}/checkout/${tx.id}`}
                            hoursLeft={hoursLeftOf(tx.created_at)}
                          />
                          {canCreate && tx.payment_method === "wompi" ? <AccionDeVentaButton transactionId={tx.id} tipo="anular" /> : null}
                        </div>
                      ) : null}
                      <EntregaDeLaVenta tx={tx} puedeEntregar={canDeliverSale(user, tx, perfilPropio)} />
                      {reversaDe.has(tx.id) ? (
                        <span className="text-xs text-destructive">
                          {reversaDe.get(tx.id)!.estado === "abierta"
                            ? "Contracargo abierto: el banco devolvió el dinero y la disputa sigue viva."
                            : reversaDe.get(tx.id)!.estado === "perdida"
                              ? `Disputa PERDIDA: el ingreso y la comisión se revirtieron${reversaDe.get(tx.id)!.notaCredito ? `, nota crédito ${reversaDe.get(tx.id)!.notaCredito}` : "; falta la nota crédito"}.`
                              : "Disputa ganada: el dinero volvió y la venta sigue en pie."}
                        </span>
                      ) : null}
                      {/* EL CONTRACARGO LLEGA POR CORREO DE WOMPI, no por Atlas: por eso se registra desde la
                          venta. Solo sobre una pagada de Wompi, que es la unica que el banco puede devolver. */}
                      {canView && tx.status === "paid" && tx.payment_method === "wompi" ? (
                        <AccionDeVentaButton transactionId={tx.id} tipo="contracargo" />
                      ) : null}
                    </div>
                    <TxStatusBadge tx={tx} />
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
