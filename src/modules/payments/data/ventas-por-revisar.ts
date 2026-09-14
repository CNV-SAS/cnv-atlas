import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

// ═══ LO QUE HAY QUE MIRAR DE LAS VENTAS, ADEMAS DE SU FACTURA (Bloque 3, sesion 2) ═══
//
// Lectura con la conexion de sistema, igual que `listarVentasSinDocumento`: es un panel de quien ve el
// ingreso de CNV (admin y direccion), y la pagina lo pide solo con esa policy.
//
// TRES AVISOS, Y NO SON LO MISMO:
//   · PAGO SOBRE LINK ANULADO: una decision pendiente. Hasta que alguien diga si fue una segunda compra o si
//     se devolvio, la venta no se descuenta, no se factura y no se entrega.
//   · SIN SALDO: se desconto lo que habia y faltaron unidades. No se "resuelve" en Atlas: dice que el saldo
//     de esa ubicacion no cuadra con la vitrina, y lo arregla un conteo o una recepcion que falto.
//   · FALLIDO: el descuento no corrio. El boton de reintentar lo vuelve a intentar.
//
// Los de inventario se muestran de los ultimos 30 dias: son avisos, y una lista que crece para siempre deja
// de leerse. El dato no se pierde: queda en la venta.

export type VentaPorRevisar = {
  id: string;
  amount: string;
  fecha: string;
  productos: string;
  motivo: "pago_sobre_link_anulado" | "sin_saldo" | "fallido";
  detalle: string | null;
};

export async function listarVentasPorRevisar(): Promise<VentaPorRevisar[]> {
  const filas = await db.execute<{
    id: string;
    amount: string;
    created_at: string;
    productos: string | null;
    motivo: VentaPorRevisar["motivo"];
    detalle: string | null;
  }>(sql`
    select t.id, t.amount::text as amount, t.created_at::text as created_at,
           (select string_agg(n.name || ' x' || ti.quantity, ', ' order by n.name)
              from transaction_items ti join nutraceuticals n on n.id = ti.nutraceutical_id
             where ti.transaction_id = t.id) as productos,
           case
             when t.review_reason is not null and t.review_resolution is null then t.review_reason
             else t.stock_state
           end as motivo,
           case
             when t.review_reason is not null and t.review_resolution is null then null
             else t.stock_last_error
           end as detalle
      from transactions t
     where t.status = 'paid'
       and (
         (t.review_reason is not null and t.review_resolution is null)
         or (t.stock_state in ('sin_saldo', 'fallido') and t.created_at > now() - interval '30 days')
       )
     order by (t.review_reason is not null and t.review_resolution is null) desc, t.created_at desc
     limit 100`);
  return filas.map((f) => ({
    id: f.id,
    amount: String(f.amount),
    fecha: String(f.created_at),
    productos: f.productos ?? "",
    motivo: f.motivo,
    detalle: f.detalle,
  }));
}
