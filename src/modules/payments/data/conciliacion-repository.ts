import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import type { Discrepancia, UltimaCorrida, VentaDeAtlas } from "../conciliacion";

export type { UltimaCorrida };

// ═══ LO QUE EL COTEJO CON WOMPI LEE Y ESCRIBE (Bloque 3b, sesion 3) ═══

/**
 * Las ventas de Wompi del rango que hay que cotejar, con lo que Atlas cree de cada una.
 *
 * ENTRAN TAMBIEN LAS ANULADAS Y LAS FALLIDAS, y eso es a proposito: el caso que mas duele es justamente el pago
 * que cayo sobre un link anulado y cuyo webhook se perdio. Recuperarlo lo deja en revision, que es donde tiene
 * que estar.
 *
 * EL AMBIENTE FILTRA: una venta creada con llaves de prueba no se cruza con la Wompi de produccion ni al reves
 * (regla del Bloque 2a).
 */
export async function ventasParaCotejar(desde: Date, ambiente: "test" | "produccion"): Promise<VentaDeAtlas[]> {
  const filas = await db.execute<{ id: string; status: string; amount: string; wompi_transaction_id: string | null; created_at: string }>(sql`
    select id, status, amount::text as amount, wompi_transaction_id, created_at::text as created_at
      from transactions
     where payment_method = 'wompi'
       and wompi_env = ${ambiente}
       and created_at >= ${desde.toISOString()}::timestamptz
     order by created_at desc
     limit 1000`);
  return filas.map((f) => ({
    id: f.id,
    estado: f.status === "paid" ? "pagada" : "esperando",
    monto: String(f.amount),
    wompiId: f.wompi_transaction_id,
    creada: f.created_at,
  }));
}

export type CorridaDeCotejo = {
  desde: Date;
  hasta: Date;
  ambiente: "test" | "produccion";
  origen: "tarea" | "manual";
  actorId: string | null;
  revisadas: number;
  recuperadas: string[];
  discrepancias: Discrepancia[];
  falloPor: string | null;
};

/** El rastro de la corrida. Sin datos de pacientes: ids de venta, ids de Wompi y el motivo. */
export async function registrarCorrida(c: CorridaDeCotejo): Promise<void> {
  const detalle = JSON.stringify({ recuperadas: c.recuperadas, discrepancias: c.discrepancias });
  await db.execute(sql`
    insert into payment_reconciliation_runs
      (from_date, until_date, wompi_env, origin, actor_id, checked, recovered, mismatched, detail, failed_reason)
    values (${c.desde.toISOString()}::timestamptz, ${c.hasta.toISOString()}::timestamptz, ${c.ambiente}, ${c.origen},
            ${c.actorId}, ${c.revisadas}, ${c.recuperadas.length}, ${c.discrepancias.length}, ${detalle}::jsonb,
            ${c.falloPor})`);
}

/** La ultima corrida, para que la pantalla diga cuando fue y como le fue. Un control que no corre no es control. */
export async function ultimaCorrida(): Promise<UltimaCorrida | null> {
  const [f] = await db.execute<{
    ran_at: string;
    origin: string;
    checked: number;
    recovered: number;
    mismatched: number;
    failed_reason: string | null;
    discrepancias_detalle: unknown;
  }>(sql`
    select ran_at::text as ran_at, origin, checked, recovered, mismatched, failed_reason,
           -- LAS DISCREPANCIAS COMPLETAS A LA PANTALLA: una reportada que nadie sabe cual es no sirve de nada.
           coalesce(detail->'discrepancias', '[]'::jsonb) as discrepancias_detalle
      from payment_reconciliation_runs order by ran_at desc limit 1`);
  return f
    ? {
        ranAt: f.ran_at,
        origen: f.origin,
        revisadas: Number(f.checked),
        recuperadas: Number(f.recovered),
        discrepancias: Number(f.mismatched),
        detalle: Array.isArray(f.discrepancias_detalle) ? (f.discrepancias_detalle as Discrepancia[]) : [],
        falloPor: f.failed_reason,
      }
    : null;
}
