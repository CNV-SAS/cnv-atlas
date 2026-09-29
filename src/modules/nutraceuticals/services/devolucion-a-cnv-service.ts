import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import {
  cerrarDevolucion,
  declararDevolucion,
  DevolucionNoRegistrableError,
} from "../data/devolucion-a-cnv-writer";

// ═══ LA DEVOLUCION DEL INTEGRANTE A CNV: LECTURAS Y LOS DOS ACTOS (0187) ═══
//
// El writer hace los dos actos; aqui viven las lecturas de las dos pantallas y la resolucion de "quien soy"
// a partir del usuario, que es lo que ninguna de las dos debe teclear.

export type LoteDevolvible = {
  lotId: string;
  codigo: string;
  nutraceuticalId: string;
  producto: string;
  vence: string;
  disponible: number;
};

/**
 * Lo que el Integrante puede devolver: sus lotes con saldo, YA DESCONTADO lo declarado y sin cerrar.
 *
 * SE MUESTRA POR LOTE y no por producto porque una devolucion siempre es de un lote: el motivo mas comun es
 * el vencimiento, y ese es del lote, no del producto.
 */
export async function misLotesDevolvibles(userId: string): Promise<LoteDevolvible[]> {
  const filas = await db.execute<{
    lot_id: string;
    codigo: string;
    nutraceutical_id: string;
    producto: string;
    vence: string;
    disponible: number;
  }>(sql`
    select i.lot_id, l.code as codigo, i.nutraceutical_id, n.name as producto,
           l.expires_on::text as vence,
           (i.stock_quantity - coalesce((
              select sum(r.declared_quantity) from nutraceutical_returns r
               where r.location_id = i.location_id and r.lot_id = i.lot_id and r.closed_at is null
            ), 0))::int as disponible
      from nutraceutical_inventory i
      join inventory_locations loc on loc.id = i.location_id
      join professional_profiles pp on pp.id = loc.professional_id
      join lots l on l.id = i.lot_id
      join nutraceuticals n on n.id = i.nutraceutical_id
     where pp.profile_id = ${userId}
       and i.stock_quantity > 0
     order by l.expires_on, n.name`);
  return filas
    .map((f) => ({
      lotId: f.lot_id,
      codigo: f.codigo,
      nutraceuticalId: f.nutraceutical_id,
      producto: f.producto,
      vence: f.vence,
      disponible: Number(f.disponible),
    }))
    .filter((l) => l.disponible > 0);
}

export type DevolucionEnPantalla = {
  id: string;
  producto: string;
  codigo: string;
  declaradas: number;
  motivo: string;
  declaradaEl: string;
  quien: string | null;
  recibidas: number | null;
  cerradaEl: string | null;
  notaDeCierre: string | null;
};

const SELECT_DEVOLUCIONES = sql`
  select r.id, n.name as producto, l.code as codigo,
         r.declared_quantity, r.reason,
         (r.declared_at at time zone 'America/Bogota')::date::text as declarada_el,
         pr.full_name as quien,
         r.received_quantity,
         (r.closed_at at time zone 'America/Bogota')::date::text as cerrada_el,
         r.close_note
    from nutraceutical_returns r
    join nutraceuticals n on n.id = r.nutraceutical_id
    join lots l on l.id = r.lot_id
    left join professional_profiles pp on pp.id = r.professional_id
    left join profiles pr on pr.id = pp.profile_id`;

type FilaDevolucion = {
  id: string;
  producto: string;
  codigo: string;
  declared_quantity: number;
  reason: string;
  declarada_el: string;
  quien: string | null;
  received_quantity: number | null;
  cerrada_el: string | null;
  close_note: string | null;
};

const aDevolucion = (f: FilaDevolucion): DevolucionEnPantalla => ({
  id: f.id,
  producto: f.producto,
  codigo: f.codigo,
  declaradas: Number(f.declared_quantity),
  motivo: f.reason,
  declaradaEl: f.declarada_el,
  quien: f.quien,
  recibidas: f.received_quantity == null ? null : Number(f.received_quantity),
  cerradaEl: f.cerrada_el,
  notaDeCierre: f.close_note,
});

/** Las devoluciones del Integrante: las abiertas y las cerradas recientes, para que vea en qué quedaron. */
export async function misDevoluciones(userId: string): Promise<DevolucionEnPantalla[]> {
  const filas = await db.execute<FilaDevolucion>(sql`
    ${SELECT_DEVOLUCIONES}
     where pp.profile_id = ${userId}
     order by r.closed_at nulls first, r.declared_at desc
     limit 30`);
  return filas.map(aDevolucion);
}

/** Las devoluciones ABIERTAS, de todos: lo que CNV tiene que reconocer al recibirlo. */
export async function devolucionesAbiertas(): Promise<DevolucionEnPantalla[]> {
  const filas = await db.execute<FilaDevolucion>(sql`
    ${SELECT_DEVOLUCIONES}
     where r.closed_at is null
     order by r.declared_at`);
  return filas.map(aDevolucion);
}

/** El `professional_profiles.id` y su ubicacion, a partir del usuario. */
async function miCustodia(userId: string): Promise<{ professionalId: string; locationId: string } | null> {
  const [f] = await db.execute<{ professional_id: string; location_id: string }>(sql`
    select pp.id as professional_id, loc.id as location_id
      from professional_profiles pp
      join inventory_locations loc on loc.professional_id = pp.id
     where pp.profile_id = ${userId}`);
  return f ? { professionalId: f.professional_id, locationId: f.location_id } : null;
}

export async function declararMiDevolucion(input: {
  userId: string;
  lotId: string;
  nutraceuticalId: string;
  quantity: number;
  reason: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const custodia = await miCustodia(input.userId);
  if (!custodia) return { ok: false, message: "No tienes una ubicación de inventario." };
  try {
    await declararDevolucion({
      professionalId: custodia.professionalId,
      locationId: custodia.locationId,
      nutraceuticalId: input.nutraceuticalId,
      lotId: input.lotId,
      quantity: input.quantity,
      reason: input.reason,
      actorId: input.userId,
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof DevolucionNoRegistrableError) return { ok: false, message: e.message };
    throw e;
  }
}

export async function cerrarUnaDevolucion(input: {
  returnId: string;
  recibido: number;
  nota: string | null;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<{ ok: true; movidas: number } | { ok: false; message: string }> {
  try {
    const { movidas } = await cerrarDevolucion(input);
    return { ok: true, movidas };
  } catch (e) {
    if (e instanceof DevolucionNoRegistrableError) return { ok: false, message: e.message };
    throw e;
  }
}
