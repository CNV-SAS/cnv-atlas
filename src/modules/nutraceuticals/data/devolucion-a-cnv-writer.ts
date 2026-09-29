import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { nutraceuticalReturns, nutraceuticalStockMovements } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// ═══ LA DEVOLUCION DEL INTEGRANTE A CNV: LOS DOS HECHOS (0187) ═══
//
// DECLARAR no mueve nada (solo escribe la fila). CERRAR mueve el saldo, en UNA transaccion y con los dos
// movimientos: sale de su vitrina y entra a la bodega central. Un traslado que solo escribiera una de las dos
// mitades perderia unidades de CNV sin que nada fallara.
//
// TODO SON MOVIMIENTOS, inmutables: un cierre mal hecho no se edita, se corrige con otro movimiento en
// sentido contrario. Es la misma disciplina de la devolucion fisica del paciente.

export class DevolucionNoRegistrableError extends Error {}

/** El saldo disponible de ese lote en esa ubicacion, MENOS lo ya declarado y todavia sin cerrar. */
async function disponibleParaDevolver(
  ex: { execute: typeof db.execute },
  locationId: string,
  lotId: string,
): Promise<number> {
  const [f] = await ex.execute<{ disponible: number }>(sql`
    select coalesce(i.stock_quantity, 0)::int
           - coalesce((
               select sum(r.declared_quantity)
                 from nutraceutical_returns r
                where r.location_id = ${locationId} and r.lot_id = ${lotId} and r.closed_at is null
             ), 0)::int as disponible
      from nutraceutical_inventory i
     where i.location_id = ${locationId} and i.lot_id = ${lotId}`);
  return f ? Number(f.disponible) : 0;
}

/**
 * EL INTEGRANTE DECLARA lo que despacha de vuelta a CNV. No mueve saldo.
 *
 * SE DESCUENTA LO YA DECLARADO Y SIN CERRAR, no solo el saldo: si no, podria declarar dos veces las mismas
 * cinco unidades y al cerrarlas las dos su saldo quedaria negativo, que es una cifra que no significa nada.
 */
export async function declararDevolucion(input: {
  professionalId: string;
  locationId: string;
  nutraceuticalId: string;
  lotId: string;
  quantity: number;
  reason: string;
  actorId: string;
}): Promise<{ id: string }> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new DevolucionNoRegistrableError("La cantidad tiene que ser un número entero mayor que cero.");
  }
  return db.transaction(async (tx) => {
    // Se bloquea la fila del saldo antes de leerla: dos declaraciones simultaneas del mismo lote podrian
    // pasar las dos por encima del disponible.
    await tx.execute(sql`
      select id from nutraceutical_inventory
       where location_id = ${input.locationId} and lot_id = ${input.lotId}
         for update`);
    const disponible = await disponibleParaDevolver(tx, input.locationId, input.lotId);
    if (input.quantity > disponible) {
      throw new DevolucionNoRegistrableError(
        disponible <= 0
          ? "No tienes unidades de ese lote sin devolver."
          : `Solo tienes ${disponible} ${disponible === 1 ? "unidad" : "unidades"} de ese lote sin devolver.`,
      );
    }
    const [r] = await tx
      .insert(nutraceuticalReturns)
      .values({
        professionalId: input.professionalId,
        locationId: input.locationId,
        nutraceuticalId: input.nutraceuticalId,
        lotId: input.lotId,
        declaredQuantity: input.quantity,
        reason: input.reason,
        declaredBy: input.actorId,
      })
      .returning({ id: nutraceuticalReturns.id });
    return { id: r.id };
  });
}

/**
 * CNV CIERRA la devolucion con lo que DE VERDAD recibio, y ahi si se mueve el saldo.
 *
 * `recibido` 0 cierra sin mover nada: se declaro y no llego. Las unidades siguen en el saldo del Integrante,
 * que es lo correcto: si no llegaron, o no salieron, o se perdieron en el camino, y las dos cosas son suyas
 * hasta que se demuestre otra cosa (aparecera en su conteo, con plazo para justificar).
 */
export async function cerrarDevolucion(input: {
  returnId: string;
  recibido: number;
  nota: string | null;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<{ movidas: number }> {
  if (!Number.isInteger(input.recibido) || input.recibido < 0) {
    throw new DevolucionNoRegistrableError("Las unidades recibidas tienen que ser un número entero, cero o más.");
  }
  return db.transaction(async (tx) => {
    const [r] = await tx.execute<{
      id: string;
      professional_id: string;
      location_id: string;
      nutraceutical_id: string;
      lot_id: string;
      declared_quantity: number;
      closed_at: string | null;
    }>(sql`
      select id, professional_id, location_id, nutraceutical_id, lot_id, declared_quantity, closed_at
        from nutraceutical_returns where id = ${input.returnId}
          for update`);
    if (!r) throw new DevolucionNoRegistrableError("Esa devolución no existe.");
    if (r.closed_at) throw new DevolucionNoRegistrableError("Esa devolución ya estaba cerrada.");

    // CAPADO A LO DECLARADO, como la remesa al reves: recibir de mas no puede bajarle el saldo a alguien por
    // debajo de lo que dijo que mandaba. El excedente lo reconcilia el conteo, como un sobrante.
    const movidas = Math.min(input.recibido, Number(r.declared_quantity));

    let movementOutId: string | null = null;
    let movementInId: string | null = null;

    if (movidas > 0) {
      const [central] = await tx.execute<{ id: string }>(
        sql`select id from inventory_locations where kind = 'central' and is_active limit 1`,
      );
      if (!central) throw new DevolucionNoRegistrableError("No hay bodega central configurada.");

      const [salida] = await tx
        .insert(nutraceuticalStockMovements)
        .values({
          professionalId: r.professional_id,
          nutraceuticalId: r.nutraceutical_id,
          locationId: r.location_id,
          lotId: r.lot_id,
          delta: -movidas,
          type: "devolucion",
          reason: "Devolución a CNV, recibida en bodega central",
          createdBy: input.actorId,
        })
        .returning({ id: nutraceuticalStockMovements.id });
      const [entrada] = await tx
        .insert(nutraceuticalStockMovements)
        .values({
          // La bodega central no tiene dueño: `professional_id` nulo, como en la reincorporacion.
          professionalId: null,
          nutraceuticalId: r.nutraceutical_id,
          locationId: central.id,
          lotId: r.lot_id,
          delta: movidas,
          type: "devolucion",
          reason: "Devolución recibida de un Integrante",
          createdBy: input.actorId,
        })
        .returning({ id: nutraceuticalStockMovements.id });
      movementOutId = salida.id;
      movementInId = entrada.id;
    }

    await tx.execute(sql`
      update nutraceutical_returns
         set received_quantity = ${movidas},
             closed_at = now(),
             closed_by = ${input.actorId},
             close_note = ${input.nota},
             movement_out_id = ${movementOutId},
             movement_in_id = ${movementInId}
       where id = ${input.returnId}`);

    await recordAudit(tx, {
      event: "inventario.devolucion_a_cnv_cerrada",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
      entityType: "nutraceutical_returns",
      entityId: input.returnId,
      payload: {
        declarado: Number(r.declared_quantity),
        recibido: movidas,
        // LA DIFERENCIA SE DEJA ESCRITA, no calculada despues: es la cifra que puede acabar en un faltante.
        sinLlegar: Number(r.declared_quantity) - movidas,
      },
    });

    return { movidas };
  });
}
