import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { corteDe, type Corte } from "../distribucion";

// ═══ EL CONSOLIDADO DE DESPACHOS DEL PERIODO (2026-09-29) ═══
//
// POR QUE EXISTE, y lo pidio contabilidad: el pago al domiciliario NO ES DEDUCIBLE SIN SOPORTE. Si se le paga
// en efectivo y sin papel, CNV registra el ingreso del flete y no puede restar lo que pago, asi que tributa
// sobre un ingreso que no gano (a 35%, unos 3.500 por envio).
//
// EL DOCUMENTO LO EMITE ALEGRA, no Atlas: documento soporte si el domiciliario es persona natural no obligada
// a facturar, o su factura si es una empresa de mensajeria. Lo que Atlas aporta es LO QUE VA DENTRO: que se
// despacho, a donde, cuando y cuanto cobro cada uno.
//
// Y EL CORTE ES EL MISMO QUE EL DE DISTRIBUCION (dias 15 y ultimo), a proposito: contabilidad recomendo pago
// QUINCENAL al domiciliario en vez de por envio, para alinear la salida con el desembolso de la pasarela y
// consolidar el soporte en un solo documento. Un calendario distinto obligaria a llevar dos.

export type Despacho = {
  transactionId: string;
  dia: string;
  ciudad: string | null;
  departamento: string | null;
  direccion: string | null;
  /** Lo que se le paga al domiciliario por este envio. */
  costo: number;
  /** Lo que se le cobro al paciente por el envio. */
  flete: number;
  entregadoEl: string | null;
};

export type ConsolidadoDeDespachos = {
  corte: Corte;
  despachos: Despacho[];
  /** Lo que hay que pagarle al domiciliario por el periodo. Es la cifra del soporte. */
  totalCosto: number;
  /** Lo que se le cobro a los pacientes. */
  totalFlete: number;
  /** La diferencia, que se la lleva la pasarela por cobrar el flete. No es margen de CNV. */
  diferencia: number;
};

async function despachosEntre(desde: string, hasta: string): Promise<Despacho[]> {
  const filas = await db.execute<{
    id: string;
    dia: string;
    ciudad: string | null;
    departamento: string | null;
    direccion: string | null;
    costo: string | null;
    flete: string | null;
    entregado: string | null;
  }>(sql`
    select t.id,
           (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date::text as dia,
           t.shipping_city as ciudad, t.shipping_department as departamento, t.shipping_address as direccion,
           t.shipping_cost::text as costo, t.shipping_fee::text as flete,
           (t.delivered_at at time zone 'America/Bogota')::date::text as entregado
      from transactions t
     where t.delivery_mode = 'domicilio'
       -- SOLO LAS PAGADAS: un envio de una venta que nunca se pago no se despacho, y meterlo en el soporte
       -- seria pedirle a contabilidad que pague un flete que nadie causo.
       and t.status = 'paid'
       and (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date
             between ${desde}::date and ${hasta}::date
     order by dia, t.shipping_city`);
  return filas.map((f) => ({
    transactionId: f.id,
    dia: f.dia,
    ciudad: f.ciudad,
    departamento: f.departamento,
    direccion: f.direccion,
    costo: f.costo == null ? 0 : Number(f.costo),
    flete: f.flete == null ? 0 : Number(f.flete),
    entregadoEl: f.entregado,
  }));
}

/** El consolidado del corte al que pertenece `dia`. */
export async function consolidadoDeDespachos(dia: string): Promise<ConsolidadoDeDespachos> {
  const corte = corteDe(dia);
  const despachos = await despachosEntre(corte.desde, corte.hasta);
  const totalCosto = despachos.reduce((s, d) => s + d.costo, 0);
  const totalFlete = despachos.reduce((s, d) => s + d.flete, 0);
  return { corte, despachos, totalCosto, totalFlete, diferencia: totalFlete - totalCosto };
}

/** El consolidado del corte ANTERIOR, que suele ser el que se paga. */
export async function consolidadoDelCorteAnterior(dia: string): Promise<ConsolidadoDeDespachos> {
  const corte = corteDe(dia);
  // Un dia antes del inicio de este corte cae siempre dentro del anterior, sea quincena o fin de mes.
  const anterior = new Date(`${corte.desde}T12:00:00`);
  anterior.setDate(anterior.getDate() - 1);
  const y = anterior.getFullYear();
  const m = String(anterior.getMonth() + 1).padStart(2, "0");
  const d = String(anterior.getDate()).padStart(2, "0");
  return consolidadoDeDespachos(`${y}-${m}-${d}`);
}
