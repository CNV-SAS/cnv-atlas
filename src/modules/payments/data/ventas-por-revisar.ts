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
  /** Cuando entro en revision (para el plazo). */
  abierta: string;
  /** La version del Integrante, quien la escribio y cuando. */
  version: string | null;
  versionPor: string | null;
  versionEn: string | null;
  /** Si se puede marcar "el efectivo no se recibio" (0142). */
  efectivo: "si" | "sin_efectivo" | "no_coinciden";
};

export async function listarVentasPorRevisar(): Promise<VentaPorRevisar[]> {
  const filas = await db.execute<{
    id: string;
    amount: string;
    created_at: string;
    productos: string | null;
    motivo: VentaPorRevisar["motivo"];
    detalle: string | null;
    abierta: string;
    version: string | null;
    version_por: string | null;
    version_en: string | null;
    efectivo: VentaPorRevisar["efectivo"];
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
           end as detalle,
           -- Las que entraron en revision antes de la 0141 no tienen la fecha: la aproxima la ultima escritura.
           coalesce(t.review_opened_at, t.updated_at)::text as abierta,
           t.review_professional_version as version,
           p.full_name as version_por,
           t.review_professional_version_at::text as version_en,
           -- LA SALIDA "EL EFECTIVO NO SE RECIBIO" solo si una venta en efectivo, todavia pagada y sin marcar,
           -- anulo este link, Y las dos coinciden en productos y cantidades (Santiago, 2026-09-14).
           case
             when not exists (select 1 from transactions c
                               where c.id = t.cancelled_by_sale_id and c.status = 'paid'
                                 and c.payment_method = 'efectivo' and c.cash_not_received_at is null)
               then 'sin_efectivo'
             when not exists (
               select 1
                 from (select nutraceutical_id, sum(quantity) as q from transaction_items
                        where transaction_id = t.id group by 1) x
                 full outer join (select nutraceutical_id, sum(quantity) as q from transaction_items
                                   where transaction_id = t.cancelled_by_sale_id group by 1) y using (nutraceutical_id)
                where x.q is distinct from y.q)
               then 'si'
             else 'no_coinciden'
           end as efectivo
      from transactions t
      left join profiles p on p.id = t.review_professional_version_by
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
    abierta: String(f.abierta),
    version: f.version,
    versionPor: f.version_por,
    versionEn: f.version_en,
    efectivo: f.efectivo,
  }));
}

export type EfectivoNoRecibido = {
  id: string;
  amount: string;
  marcadaEn: string;
  profesional: string | null;
  factura: string | null;
  notaCredito: string | null;
  /** Casos del mismo Integrante en los ultimos 90 dias. */
  casosEn90Dias: number;
};

/**
 * EFECTIVO REGISTRADO QUE NO SE RECIBIO (0142). Las que tienen la nota credito pendiente, siempre; y las de los
 * ultimos 90 dias, porque es la ventana de la escalada por Integrante.
 */
export async function listarEfectivosNoRecibidos(): Promise<EfectivoNoRecibido[]> {
  const filas = await db.execute<{
    id: string;
    amount: string;
    marcada_en: string;
    profesional: string | null;
    factura: string | null;
    nota_credito: string | null;
    casos: number;
  }>(sql`
    select t.id, t.amount::text as amount, t.cash_not_received_at::text as marcada_en, pr.full_name as profesional,
           t.alegra_invoice_number as factura, t.credit_note_manual_number as nota_credito,
           (select count(*)::int from transactions o
             where o.professional_id is not distinct from t.professional_id
               and o.cash_not_received_at > now() - interval '90 days') as casos
      from transactions t
      left join professional_profiles pp on pp.id = t.professional_id
      left join profiles pr on pr.id = pp.profile_id
     where t.cash_not_received_at is not null
       and (t.credit_note_manual_number is null or t.cash_not_received_at > now() - interval '90 days')
     order by t.cash_not_received_at desc
     limit 100`);
  return filas.map((f) => ({
    id: f.id,
    amount: String(f.amount),
    marcadaEn: String(f.marcada_en),
    profesional: f.profesional,
    factura: f.factura,
    notaCredito: f.nota_credito,
    casosEn90Dias: Number(f.casos),
  }));
}
