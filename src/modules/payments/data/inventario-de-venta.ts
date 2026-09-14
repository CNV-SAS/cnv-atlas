import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { nutraceuticalStockMovements } from "@/db/schema";
import { asignarPorLotes, type LoteDisponible } from "@/modules/nutraceuticals/asignacion-por-lote";

import { CHECKOUT_TTL_MS } from "./checkout-reader";

// ═══ LA VENTA MUEVE INVENTARIO (Bloque 3, sesion 1) ═══
//
// Drizzle con la conexion de sistema (sin RLS), por la misma razon que el sellado del pago: el descuento
// corre en el webhook de Wompi, donde no hay sesion de usuario.
//
// ── LOS TRES MOMENTOS ────────────────────────────────────────────────────────────────────────────
//
//   1. RESERVAR, al crear el checkout, DENTRO de la transaccion que crea la venta. Si no alcanza, la venta
//      no se crea: validar existencias antes de cobrar es el paso 4 del flujo del plan.
//   2. DESCONTAR, al sellar el pago, EN SU PROPIA transaccion y DESPUES del sellado. Nunca dentro: un error
//      de inventario desharia el pago, y el paciente ya pago (decision 4 de Santiago).
//   3. LIBERAR, si el pago falla. Si nadie paga, la reserva vence sola con el link.
//
// ── POR QUE SE BLOQUEAN LAS FILAS DE SALDO ───────────────────────────────────────────────────────
//
// Dos checkouts a la vez por las ultimas unidades leerian el mismo disponible y reservarian las dos. Se
// bloquean las filas de saldo del producto en la ubicacion antes de leer lo disponible: el segundo espera
// al primero y ve su reserva. Siempre en el mismo orden (por producto) para no cruzar bloqueos.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Ejecutor = typeof db | Tx;

/** Error esperable de inventario: el mensaje es para el profesional. */
export class InventarioDeVentaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventarioDeVentaError";
  }
}

/**
 * De donde sale la venta: la ubicacion del profesional de la venta; si no tiene (o la venta no tiene
 * profesional), la bodega central.
 *
 * CONFIRMADO por Santiago (2026-09-13): una venta sin profesional (la crea un administrador para un paciente
 * sin Integrante asignado) sale de la central. Ese paciente no tiene de donde descontar, y la central es de CNV.
 */
export async function ubicacionDeLaVenta(
  ex: Ejecutor,
  professionalId: string | null,
): Promise<string | null> {
  if (professionalId) {
    const [propia] = await ex.execute<{ id: string }>(sql`
      select id from inventory_locations
       where professional_id = ${professionalId} and is_active limit 1`);
    if (propia) return propia.id;
  }
  const [central] = await ex.execute<{ id: string }>(sql`
    select id from inventory_locations where kind = 'central' and is_active limit 1`);
  return central?.id ?? null;
}

type Linea = { id: string; nutraceuticalId: string; cantidad: number; nombre: string };

async function lineasDeLaVenta(tx: Tx, transactionId: string): Promise<Linea[]> {
  const filas = await tx.execute<{ id: string; nutraceutical_id: string; quantity: number; name: string }>(sql`
    select ti.id, ti.nutraceutical_id, ti.quantity, n.name
      from transaction_items ti
      join nutraceuticals n on n.id = ti.nutraceutical_id
     where ti.transaction_id = ${transactionId}
     order by ti.nutraceutical_id, ti.id`);
  return filas.map((f) => ({ id: f.id, nutraceuticalId: f.nutraceutical_id, cantidad: Number(f.quantity), nombre: f.name }));
}

/**
 * Los lotes del producto en la ubicacion con lo que se puede tomar: saldo menos reservas VIVAS de OTRAS
 * ventas. Bloquea antes las filas de saldo (ver la cabecera).
 */
async function lotesDisponibles(
  tx: Tx,
  locationId: string,
  nutraceuticalId: string,
  exceptoVenta: string | null,
): Promise<LoteDisponible[]> {
  await tx.execute(sql`
    select id from nutraceutical_inventory
     where location_id = ${locationId} and nutraceutical_id = ${nutraceuticalId}
     order by lot_id
       for update`);
  const filas = await tx.execute<{ lot_id: string; expires_on: string; disponible: number }>(sql`
    select i.lot_id, l.expires_on::text as expires_on,
           i.stock_quantity - coalesce((
             select sum(r.quantity)
               from inventory_reservations r
               join transaction_items ti on ti.id = r.transaction_item_id
              where r.location_id = i.location_id
                and r.lot_id = i.lot_id
                and r.nutraceutical_id = i.nutraceutical_id
                and r.released_at is null and r.consumed_at is null
                and r.expires_at > now()
                and (${exceptoVenta}::uuid is null or ti.transaction_id <> ${exceptoVenta}::uuid)
           ), 0)::int as disponible
      from nutraceutical_inventory i
      join lots l on l.id = i.lot_id
     where i.location_id = ${locationId} and i.nutraceutical_id = ${nutraceuticalId}`);
  return filas.map((f) => ({ lotId: f.lot_id, vence: f.expires_on, disponible: Number(f.disponible) }));
}

/**
 * RESERVA las lineas de una venta recien creada, en la MISMA transaccion que la crea. Lanza
 * `InventarioDeVentaError` si no alcanza, y la venta entera se revierte.
 */
export async function reservarVenta(tx: Tx, transactionId: string, locationId: string): Promise<void> {
  const ttlSegundos = Math.round(CHECKOUT_TTL_MS / 1000);
  for (const linea of await lineasDeLaVenta(tx, transactionId)) {
    const lotes = await lotesDisponibles(tx, locationId, linea.nutraceuticalId, null);
    const { asignaciones, faltante } = asignarPorLotes(lotes, linea.cantidad);
    if (faltante > 0) {
      const hay = linea.cantidad - faltante;
      throw new InventarioDeVentaError(
        hay === 0
          ? `No hay existencias de "${linea.nombre}" para vender.`
          : `Solo hay ${hay} unidad${hay === 1 ? "" : "es"} de "${linea.nombre}" disponible${hay === 1 ? "" : "s"}, y la venta pide ${linea.cantidad}.`,
      );
    }
    for (const a of asignaciones) {
      // VENCE CON EL LINK: la misma constante que decide si el link todavia se puede pagar.
      await tx.execute(sql`
        insert into inventory_reservations
          (transaction_item_id, location_id, lot_id, nutraceutical_id, quantity, expires_at)
        values (${linea.id}, ${locationId}, ${a.lotId}, ${linea.nutraceuticalId}, ${a.cantidad},
                now() + make_interval(secs => ${ttlSegundos}))`);
    }
  }
  await tx.execute(sql`update transactions set stock_state = 'reservado' where id = ${transactionId}`);
}

export type ResultadoDelDescuento = {
  /** El estado en que quedo la venta, o el que ya tenia si no habia nada que hacer. */
  estado: string | null;
  /** Si este llamado movio inventario. */
  movio: boolean;
  faltantes: { producto: string; faltan: number }[];
};

const DESCONTABLE = ["reservado", "pendiente", "fallido"];

/**
 * DESCUENTA el inventario de una venta YA PAGADA. Idempotente: una venta ya descontada no se toca, y dos
 * llamadas a la vez se serializan por el bloqueo de la fila de la venta.
 *
 * Consume primero las reservas vivas de cada linea; lo que falte (reserva vencida, o venta en efectivo, que
 * no reserva) sale de lo disponible por FEFO. Si aun asi no alcanza, SE DESCUENTA LO QUE HAY y la venta
 * queda `sin_saldo`: el paciente ya pago y el producto ya se entrego, asi que Atlas estaba por debajo de la
 * vitrina; inventar un saldo negativo por la diferencia no lo acercaria a la realidad.
 */
export async function descontarVenta(transactionId: string): Promise<ResultadoDelDescuento> {
  return db.transaction(async (tx) => {
    const [venta] = await tx.execute<{
      status: string;
      stock_state: string | null;
      location_id: string | null;
      treatment_id: string | null;
      en_revision: boolean;
    }>(sql`
      select status, stock_state, location_id, treatment_id,
             (review_reason is not null and review_resolution is distinct from 'segunda_compra') as en_revision
        from transactions where id = ${transactionId}
         for update`);
    // UNA VENTA EN REVISION NO SE DESCUENTA, aunque su estado lo pareciera: la regla no depende de que nadie
    // haya dejado el inventario en `liberado`.
    if (!venta || venta.status !== "paid" || venta.en_revision || !DESCONTABLE.includes(venta.stock_state ?? "")) {
      return { estado: venta?.stock_state ?? null, movio: false, faltantes: [] };
    }
    if (!venta.location_id) {
      throw new Error("La venta no tiene ubicación de inventario: no se sabe de dónde salió el producto.");
    }
    const [ubicacion] = await tx.execute<{ professional_id: string | null }>(sql`
      select professional_id from inventory_locations where id = ${venta.location_id}`);

    const faltantes: { producto: string; faltan: number }[] = [];
    for (const linea of await lineasDeLaVenta(tx, transactionId)) {
      // Las reservas VENCIDAS de esta linea se liberan: sus unidades pudieron irse a otra venta.
      await tx.execute(sql`
        update inventory_reservations set released_at = now()
         where transaction_item_id = ${linea.id}
           and released_at is null and consumed_at is null and expires_at <= now()`);
      const vivas = await tx.execute<{ id: string; lot_id: string; quantity: number }>(sql`
        select id, lot_id, quantity from inventory_reservations
         where transaction_item_id = ${linea.id}
           and released_at is null and consumed_at is null
         order by lot_id`);

      // El bloqueo va ANTES de tocar el saldo, tambien cuando todo sale de reservas.
      const lotes = await lotesDisponibles(tx, venta.location_id, linea.nutraceuticalId, transactionId);

      const salidas: { lotId: string; cantidad: number }[] = vivas.map((r) => ({
        lotId: r.lot_id,
        cantidad: Number(r.quantity),
      }));
      const reservado = salidas.reduce((s, x) => s + x.cantidad, 0);
      const resta = linea.cantidad - reservado;
      if (resta > 0) {
        // Lo que ya salio de reservas no esta disponible para el resto de la misma linea.
        const tomado = new Map<string, number>();
        for (const s of salidas) tomado.set(s.lotId, (tomado.get(s.lotId) ?? 0) + s.cantidad);
        const libres = lotes.map((l) => ({ ...l, disponible: l.disponible - (tomado.get(l.lotId) ?? 0) }));
        const { asignaciones, faltante } = asignarPorLotes(libres, resta);
        salidas.push(...asignaciones);
        if (faltante > 0) faltantes.push({ producto: linea.nombre, faltan: faltante });
      }

      for (const s of salidas) {
        await tx.insert(nutraceuticalStockMovements).values({
          professionalId: ubicacion?.professional_id ?? null,
          nutraceuticalId: linea.nutraceuticalId,
          locationId: venta.location_id,
          lotId: s.lotId,
          delta: -s.cantidad,
          type: "venta",
          reason: "Venta",
          treatmentId: venta.treatment_id,
          transactionItemId: linea.id,
        });
      }
      if (vivas.length > 0) {
        await tx.execute(sql`
          update inventory_reservations set consumed_at = now()
           where transaction_item_id = ${linea.id} and released_at is null and consumed_at is null`);
      }
    }

    const estado = faltantes.length > 0 ? "sin_saldo" : "descontado";
    const motivo =
      faltantes.length > 0
        ? `Vendida sin saldo suficiente: ${faltantes.map((f) => `${f.producto} (faltaron ${f.faltan})`).join(", ")}. Se descontó lo que había.`
        : null;
    await tx.execute(sql`
      update transactions set stock_state = ${estado}, stock_last_error = ${motivo}, updated_at = now()
       where id = ${transactionId}`);
    return { estado, movio: true, faltantes };
  });
}

/**
 * LIBERA las reservas de una venta cuyo pago FALLO. Solo si la venta esta `failed`: un evento de fallo que
 * llegara tarde sobre una venta ya pagada no puede soltar unidades que se estan vendiendo.
 */
export async function liberarReservasDeVenta(transactionId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [venta] = await tx.execute<{ status: string }>(sql`
      select status from transactions where id = ${transactionId} for update`);
    if (venta?.status !== "failed") return;
    await tx.execute(sql`
      update inventory_reservations r set released_at = now()
        from transaction_items ti
       where ti.id = r.transaction_item_id and ti.transaction_id = ${transactionId}
         and r.released_at is null and r.consumed_at is null`);
    await tx.execute(sql`
      update transactions set stock_state = 'liberado', updated_at = now()
       where id = ${transactionId} and stock_state = 'reservado'`);
  });
}

/** Deja escrito por que fallo el descuento, para la cola y para quien lo mire. */
export async function registrarFalloDeDescuento(transactionId: string, motivo: string): Promise<void> {
  await db.execute(sql`
    update transactions set stock_state = 'fallido', stock_last_error = ${motivo.slice(0, 500)}, updated_at = now()
     where id = ${transactionId} and status = 'paid' and stock_state in ('reservado', 'pendiente', 'fallido')`);
}

/** La cola del descuento: ventas pagadas a las que les falta el inventario. */
export async function listarDescuentosPendientes(limite = 50): Promise<string[]> {
  const filas = await db.execute<{ id: string }>(sql`
    select id from transactions
     where status = 'paid' and stock_state in ('reservado', 'pendiente', 'fallido')
       and (review_reason is null or review_resolution = 'segunda_compra')
     order by created_at asc
     limit ${limite}`);
  return filas.map((f) => f.id);
}
