import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { nutraceuticalStockMovements } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import { revertirDineroDeLaDevolucion } from "./reversas-writer";

// ═══ LA DEVOLUCION FISICA (Bloque 3b, sesion 2, 2026-09-22) ═══
//
// LA DECISION D-3b-3 DE CONTABILIDAD, y su razon es SANITARIA antes que contable: el producto es alimento
// registrado ante INVIMA, y una unidad que salio del control de CNV no tiene cadena de custodia. Asi que:
//
//   1. la unidad que devuelve el paciente NO vuelve al lote vendible: entra a CUARENTENA ("devueltas
//      pendientes de verificacion"), que no es vendible;
//   2. alguien la inspecciona y decide: reincorporar (sellada, integra, sin vencer) o dar de baja;
//   3. y esa decision es HUMANA Y REGISTRADA, nunca automatica: por eso las dos salidas exigen quien y
//      por que, y quedan en el audit.
//
// TODO SON MOVIMIENTOS, que es la fuente de verdad del saldo y son inmutables (append-only): nada se edita.
// Un error se corrige con otro movimiento en sentido contrario, como el resto del inventario.

export class DevolucionNoRegistrableError extends Error {}

/** La ubicacion de cuarentena, que es UNA sola (indice unico en la 0164). */
async function cuarentena(ex: { execute: typeof db.execute }): Promise<string> {
  const [loc] = await ex.execute<{ id: string }>(
    sql`select id from inventory_locations where kind = 'cuarentena' and is_active limit 1`,
  );
  if (!loc) throw new DevolucionNoRegistrableError("No hay una ubicación de devoluciones configurada.");
  return loc.id;
}

/**
 * El paciente devolvio unidades de una LINEA de venta: entran a cuarentena.
 *
 * El lote es el de la salida: se busca en el movimiento de venta de esa linea, porque la unidad que vuelve es
 * la que salio. Si la venta salio de varios lotes, se devuelve contra el primero que tenga suficiente.
 */
export async function registrarDevolucionFisica(input: {
  transactionItemId: string;
  cantidad: number;
  motivo: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<{ movimientoId: string; alPaciente: number }> {
  if (!Number.isInteger(input.cantidad) || input.cantidad <= 0) {
    throw new DevolucionNoRegistrableError("La cantidad devuelta tiene que ser un número entero mayor que cero.");
  }
  return db.transaction(async (tx) => {
    const salidas = await tx.execute<{ lot_id: string; nutraceutical_id: string; delta: number }>(sql`
      select lot_id, nutraceutical_id, delta from nutraceutical_stock_movements
       where transaction_item_id = ${input.transactionItemId} and type = 'venta'
       order by created_at`);
    if (salidas.length === 0) {
      throw new DevolucionNoRegistrableError(
        "Esa línea de venta no tiene una salida de inventario registrada: no hay nada que devolver.",
      );
    }
    const devueltas = await tx.execute<{ total: number }>(sql`
      select coalesce(sum(delta), 0)::int as total from nutraceutical_stock_movements
       where transaction_item_id = ${input.transactionItemId} and type = 'devolucion_paciente'`);
    const vendidas = salidas.reduce((s, m) => s + Math.abs(Number(m.delta)), 0);
    const yaDevueltas = Number(devueltas[0]?.total ?? 0);
    if (yaDevueltas + input.cantidad > vendidas) {
      throw new DevolucionNoRegistrableError(
        `No se pueden devolver más unidades de las que salieron: se vendieron ${vendidas} y ya volvieron ${yaDevueltas}.`,
      );
    }

    const destino = await cuarentena(tx);
    const [movimiento] = await tx
      .insert(nutraceuticalStockMovements)
      .values({
        // La cuarentena no tiene dueño: la unidad ya no esta en custodia del integrante.
        professionalId: null,
        nutraceuticalId: salidas[0].nutraceutical_id,
        locationId: destino,
        lotId: salidas[0].lot_id,
        delta: input.cantidad,
        type: "devolucion_paciente",
        reason: input.motivo,
        transactionItemId: input.transactionItemId,
        createdBy: input.actorId,
      })
      .returning({ id: nutraceuticalStockMovements.id });

    // ═══ Y EL DINERO, EN LA MISMA TRANSACCION (2026-09-25) ═══
    //
    // El smoke lo destapo: el producto volvia y el ingreso se quedaba. O vuelven los dos o no vuelve ninguno,
    // por eso va aqui dentro y no en un paso aparte que alguien pueda olvidar.
    //
    // Y NO DEPENDE DE LA VERIFICACION: que el frasco sea reincorporable o haya que darlo de baja es otra
    // decision, sobre el producto. El paciente devolvio y su dinero se le devuelve pase lo que pase con el
    // frasco; si no es apto para reventa, eso lo pierde CNV, no el paciente.
    const dinero = await revertirDineroDeLaDevolucion(tx, {
      transactionItemId: input.transactionItemId,
      cantidadDevuelta: input.cantidad,
      actorId: input.actorId,
    });

    await recordAudit(tx, {
      event: "inventario.devolucion_fisica_registrada",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "transaction_item",
      entityId: input.transactionItemId,
      payload: {
        cantidad: input.cantidad,
        motivo: input.motivo,
        movimiento: movimiento.id,
        reversa: dinero.reversaId,
        al_paciente: dinero.alPaciente,
        comision_revertida: dinero.comisionRevertida,
        ingreso_revertido: dinero.ingresoRevertido,
      },
      ip: input.ip,
    });
    return { movimientoId: movimiento.id, alPaciente: dinero.alPaciente };
  });
}

/**
 * La VERIFICACION: lo que estaba en cuarentena se reincorpora al lote vendible o se da de baja.
 *
 * NUNCA AUTOMATICA (D-3b-3): la hace una persona, queda con su nombre y con su motivo. Reincorporar mueve
 * dos veces (sale de cuarentena, entra a la ubicacion destino); dar de baja, una sola.
 */
export async function verificarDevuelta(input: {
  nutraceuticalId: string;
  lotId: string;
  cantidad: number;
  decision: "reincorporar" | "dar_de_baja";
  /** A donde vuelve si se reincorpora: una ubicacion VENDIBLE. */
  destinoId?: string;
  motivo: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<void> {
  if (!Number.isInteger(input.cantidad) || input.cantidad <= 0) {
    throw new DevolucionNoRegistrableError("La cantidad tiene que ser un número entero mayor que cero.");
  }
  if (input.motivo.trim().length < 5) {
    throw new DevolucionNoRegistrableError("Escribe el resultado de la verificación (al menos cinco letras).");
  }
  // ═══ EL PRODUCTO DE TERCERO SI SE REINCORPORA, Y EL BLOQUEO ERA MIO (Santiago, 2026-09-25) ═══
  //
  // Lo bloqueaba leyendo D-3b-3 ("vuelve a la consignacion del proveedor") como si esa consignacion fuera un
  // sitio que Atlas no tiene. Es al reves: EL INVENTARIO DE UN PRODUCTO DE TERCERO EN ATLAS YA ES ESA
  // CONSIGNACION. El producto esta en la vitrina del integrante y sigue siendo del proveedor hasta que se
  // vende (modelo §10.3: cuentas de orden, sin valor contable propio).
  //
  // Y lo que lo confirma es §7.3, la ruta adoptada y vinculante: la compraventa encadenada contra reporte de
  // ventas. Su punto 4 dice que EN EL MOMENTO DE LA VENTA EL PRODUCTO YA ES DE CNV, que es lo que permite
  // facturarle al paciente el PVP completo. Si la venta se deshace, se deshace ese acto: la unidad vuelve a
  // la consignacion, que es justo el lote de donde salio.
  //
  // LO QUE SI QUEDA PENDIENTE, y no es de aqui: esa venta se le REPORTA al proveedor al corte, y contra ese
  // reporte el proveedor factura. Una unidad devuelta tiene que dejar de contar en ese reporte (o restarse
  // en el corte siguiente si ya se reporto). Vive con el reporte al proveedor, en el bloque comercial que lo
  // construya; queda escrito en el plan para que no se pierda.
  const [producto] = await db.execute<{ ownership: string | null }>(sql`
    select ownership from nutraceuticals where id = ${input.nutraceuticalId}`);
  const deTercero = producto?.ownership === "tercero";

  return db.transaction(async (tx) => {
    const origen = await cuarentena(tx);
    const [saldo] = await tx.execute<{ stock_quantity: number }>(sql`
      select stock_quantity from nutraceutical_inventory
       where location_id = ${origen} and nutraceutical_id = ${input.nutraceuticalId} and lot_id = ${input.lotId}`);
    if (Number(saldo?.stock_quantity ?? 0) < input.cantidad) {
      throw new DevolucionNoRegistrableError(
        "En devoluciones pendientes no hay esa cantidad de ese producto y lote.",
      );
    }

    if (input.decision === "reincorporar") {
      if (!input.destinoId) throw new DevolucionNoRegistrableError("Elige a qué ubicación vuelve.");

      const [destino] = await tx.execute<{ id: string; professional_id: string | null; sellable: boolean }>(sql`
        select id, professional_id, sellable from inventory_locations where id = ${input.destinoId} and is_active`);
      if (!destino) throw new DevolucionNoRegistrableError("Esa ubicación no existe o está inactiva.");
      if (!destino.sellable) {
        throw new DevolucionNoRegistrableError("Esa ubicación no es vendible: reincorporar ahí no devuelve la unidad al lote.");
      }
      await tx.insert(nutraceuticalStockMovements).values([
        {
          professionalId: null,
          nutraceuticalId: input.nutraceuticalId,
          locationId: origen,
          lotId: input.lotId,
          delta: -input.cantidad,
          type: "reincorporacion",
          reason: input.motivo,
          createdBy: input.actorId,
        },
        {
          professionalId: destino.professional_id,
          nutraceuticalId: input.nutraceuticalId,
          locationId: destino.id,
          lotId: input.lotId,
          delta: input.cantidad,
          type: "reincorporacion",
          reason: input.motivo,
          createdBy: input.actorId,
        },
      ]);
    } else {
      await tx.insert(nutraceuticalStockMovements).values({
        professionalId: null,
        nutraceuticalId: input.nutraceuticalId,
        locationId: origen,
        lotId: input.lotId,
        delta: -input.cantidad,
        type: "baja",
        reason: input.motivo,
        createdBy: input.actorId,
      });
    }

    await recordAudit(tx, {
      event:
        input.decision === "reincorporar"
          ? "inventario.devuelta_reincorporada"
          : "inventario.devuelta_dada_de_baja",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "nutraceutical",
      entityId: input.nutraceuticalId,
      payload: {
        lote: input.lotId,
        cantidad: input.cantidad,
        motivo: input.motivo,
        destino: input.decision === "reincorporar" ? input.destinoId : null,
        // DE TERCERO O PROPIO: si es de tercero, esta unidad tiene que dejar de contar en el reporte de
        // ventas al proveedor. Queda en el rastro para poder cuadrarlo cuando ese reporte exista.
        de_tercero: deTercero,
      },
      ip: input.ip,
    });
  });
}

export type DevueltaPendiente = {
  nutraceuticalId: string;
  producto: string;
  lotId: string;
  lote: string | null;
  cantidad: number;
  ultimoMotivo: string | null;
};

/** Lo que espera verificacion, por producto y lote. */
export async function listarDevueltasPendientes(): Promise<DevueltaPendiente[]> {
  // LA CUARENTENA VA DENTRO DE LA CONSULTA, no en un viaje aparte (2026-09-24). Preguntarla primero eran DOS
  // idas a la base para una pantalla que ya pide muchas, y cada ida tiene que esperar cupo en un pool de
  // seis. Para ESCRIBIR sigue resolviendose aparte, porque ahi hace falta el mensaje propio si no existe.
  const filas = await db.execute<{
    nutraceutical_id: string;
    producto: string;
    lot_id: string;
    lote: string | null;
    cantidad: number;
    ultimo_motivo: string | null;
  }>(sql`
    select i.nutraceutical_id, n.name as producto, i.lot_id, l.code as lote, i.stock_quantity as cantidad,
           (select m.reason from nutraceutical_stock_movements m
             where m.location_id = i.location_id and m.nutraceutical_id = i.nutraceutical_id
               and m.lot_id = i.lot_id and m.type = 'devolucion_paciente'
             order by m.created_at desc limit 1) as ultimo_motivo
      from nutraceutical_inventory i
      join nutraceuticals n on n.id = i.nutraceutical_id
      join lots l on l.id = i.lot_id
     where i.location_id = (select id from inventory_locations where kind = 'cuarentena' and is_active limit 1)
       and i.stock_quantity > 0
     order by n.name`);
  return filas.map((f) => ({
    nutraceuticalId: f.nutraceutical_id,
    producto: f.producto,
    lotId: f.lot_id,
    lote: f.lote,
    cantidad: Number(f.cantidad),
    ultimoMotivo: f.ultimo_motivo,
  }));
}

/**
 * LO DE LA DEVOLUCION FISICA EN UNA SOLA ENTRADA (2026-09-24), y la razon es de POOL, no de consulta.
 *
 * `/pagos` dispara sus cargas en paralelo y ya iban ocho; la sesion 2 le sumo DOS mas, y la pantalla se paso
 * de los 8 s con "pagos.devueltas no respondio". Medida contra la base, la consulta tarda 0,2 ms con 9.291
 * movimientos: no es que pese, es que cada una ocupa un cupo del pool de transacciones y la decima espera.
 * Es el mismo caso de `pagos.dias-con-ventas-sin-cerrar`.
 *
 * Asi que las dos se piden juntas, y los destinos SOLO cuando hay algo que verificar, que es lo normal que
 * no haya: en el caso comun esto es una consulta, no dos.
 */
export async function leerDevolucionesPendientes(): Promise<{
  items: DevueltaPendiente[];
  destinos: { id: string; nombre: string }[];
}> {
  const items = await listarDevueltasPendientes();
  if (items.length === 0) return { items, destinos: [] };
  return { items, destinos: await listarDestinosVendibles() };
}

/** Las ubicaciones VENDIBLES, para elegir a donde vuelve una unidad reincorporada. */
export async function listarDestinosVendibles(): Promise<{ id: string; nombre: string }[]> {
  const filas = await db.execute<{ id: string; name: string }>(sql`
    select id, name from inventory_locations where is_active and sellable order by kind desc, name`);
  return filas.map((f) => ({ id: f.id, nombre: f.name }));
}
