import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

// ═══ LOS ENVIOS A DOMICILIO POR COORDINAR (2026-09-29, REESCRITO EL 2026-10-05) ═══
//
// ── QUE ERA ESTO ANTES, Y POR QUE SE CAYO ENTERO ───────────────────────────────────────────────────
//
// Era el CONSOLIDADO QUINCENAL de lo que CNV le tenia que pagar al domiciliario, con el cobrado al paciente
// al lado y la diferencia que se llevaba la pasarela. Lo pidio contabilidad por una razon concreta: el pago
// al domiciliario no es deducible sin soporte, asi que pagarle en efectivo y sin papel dejaba a CNV
// tributando sobre un ingreso que no gano.
//
// LA DECISION DEL 2026-10-05 DISOLVIO ESA RAZON, no la resolvio: el flete queda fuera de CNV y el paciente le
// paga al mensajero. CNV no cobra el envio, no lo factura y NO REGISTRA NINGUN GASTO DE DOMICILIO. Sin pago
// al domiciliario no hay soporte que armar, y sin ingreso por flete no hay diferencia que explicar. Asi que
// las tres cifras (costo, flete, diferencia) se van: ninguna existe.
//
// ── Y QUE QUEDA, QUE NO ES NADA ────────────────────────────────────────────────────────────────────
//
// La misma decision pide lo que si hace falta: "dejar la venta con estado pendiente de coordinar envio; y
// admin u soporte tienen la opcion de marcarlo como entregado". Eso es una LISTA DE TRABAJO, no una cuenta.
//
// POR ESO SE REESCRIBE EN VEZ DE BORRARSE: la pantalla de /comercial ya tenia el sitio donde mirar los
// envios, y lo que cambia es lo que se mira ahi. Borrarla habria dejado los envios sin ninguna superficie
// justo cuando pasan a necesitar que alguien los empuje a mano.
//
// Y SE FUE EL CORTE QUINCENAL con las cifras: agrupaba por el calendario del pago al domiciliario, que ya no
// ocurre. Un envio pendiente lo esta hasta que se despacha, sin importar en que quincena se vendio.

export type EnvioPorCoordinar = {
  transactionId: string;
  dia: string;
  ciudad: string | null;
  departamento: string | null;
  direccion: string | null;
  /** Con quien se coordina. Lo sella la venta; null en los envios anteriores al 2026-10-05. */
  celular: string | null;
  /** null = todavia no se ha despachado, que es justo lo que lo deja en esta lista. */
  entregadoEl: string | null;
};

/**
 * Los envios a domicilio PAGADOS que todavia no se han entregado, el mas viejo primero.
 *
 * SOLO LAS PAGADAS: un envio de una venta que nunca se pago no hay que despacharlo, y ponerlo aqui mandaria
 * a despachar producto por el que nadie pago.
 *
 * EL MAS VIEJO PRIMERO, y no el mas nuevo: esta lista es una cola de trabajo, y el paciente que lleva mas
 * tiempo esperando su envio es el que hay que atender antes. Ordenarla al reves esconde justo el caso que
 * duele.
 */
export async function enviosPorCoordinar(): Promise<EnvioPorCoordinar[]> {
  const filas = await db.execute<{
    id: string;
    dia: string;
    ciudad: string | null;
    departamento: string | null;
    direccion: string | null;
    celular: string | null;
  }>(sql`
    select t.id,
           (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date::text as dia,
           t.shipping_city as ciudad, t.shipping_department as departamento, t.shipping_address as direccion,
           t.shipping_phone as celular
      from transactions t
     where t.delivery_mode = 'domicilio'
       and t.status = 'paid'
       and coalesce(t.fulfillment_state, 'pendiente') = 'pendiente'
       and t.cancelled_at is null
     order by dia, t.shipping_city`);
  return filas.map((f) => ({
    transactionId: f.id,
    dia: f.dia,
    ciudad: f.ciudad,
    departamento: f.departamento,
    direccion: f.direccion,
    celular: f.celular,
    entregadoEl: null,
  }));
}

/** Los envios ya despachados, los ultimos primero. Es la constancia de que la cola se atendio. */
export async function enviosDespachados(limite = 30): Promise<EnvioPorCoordinar[]> {
  const filas = await db.execute<{
    id: string;
    dia: string;
    ciudad: string | null;
    departamento: string | null;
    direccion: string | null;
    celular: string | null;
    entregado: string | null;
  }>(sql`
    select t.id,
           (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date::text as dia,
           t.shipping_city as ciudad, t.shipping_department as departamento, t.shipping_address as direccion,
           t.shipping_phone as celular,
           (t.delivered_at at time zone 'America/Bogota')::date::text as entregado
      from transactions t
     where t.delivery_mode = 'domicilio'
       and t.status = 'paid'
       and t.fulfillment_state = 'entregado'
     order by t.delivered_at desc nulls last
     limit ${limite}`);
  return filas.map((f) => ({
    transactionId: f.id,
    dia: f.dia,
    ciudad: f.ciudad,
    departamento: f.departamento,
    direccion: f.direccion,
    celular: f.celular,
    entregadoEl: f.entregado,
  }));
}
