import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { transactionItems, transactions } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import { wompiEnvDeLaLlave } from "../ambiente";
import { ubicacionDeLaVenta } from "./inventario-de-venta";
import { sellarContabilidadDeLaVenta } from "./payments-writer";

// ═══ LA VENTA QUE YA OCURRIO (Bloque R, 2026-09-23) ═══
//
// Una integrante ya vendia con el HTML antes de que Atlas existiera para lo comercial. Esas ventas se
// facturaron A MANO en Alegra, y su saldo de inventario en Atlas dice lo que RECIBIO, no lo que tiene.
//
// LAS TRES COSAS QUE ESTE CAMINO TIENE QUE HACER, y por que cada una:
//
//   1. FECHARLA CUANDO OCURRIO. Una venta con fecha de hoy contradice la factura que ya se emitio con otra
//      fecha, y ese desacuerdo es justo lo que mira una auditoria. La fecha va en `created_at`, que es como
//      toda la app fecha una venta (ver la 0169: una segunda columna seria una segunda verdad).
//   2. NO FACTURARLA. La factura ya existe. Si Atlas emite otra, el mismo hecho queda con dos documentos.
//      Se guarda su NUMERO, que es lo que permite cotejarla, y nunca se llama a Alegra.
//   3. DESCONTAR SU INVENTARIO. Es el proposito del bloque: su saldo queda bien solo si las ventas que ya
//      hizo salen de su vitrina. El descuento corre por el camino de siempre y no por uno propio.
//
// Y NO APARECE COMO "POR COBRAR": el panel de facturacion persigue las emitidas sin pago registrado, y una
// retroactiva tiene su pago recibido fuera de Atlas. El lector la excluye por `registered_retroactively_at`.

export class VentaRetroactivaError extends Error {}

export type LineaRetroactiva = {
  nutraceuticalId: string;
  cantidad: number;
  precioUnitario: number;
};

export type NuevaVentaRetroactiva = {
  organizationId: string;
  patientId: string;
  professionalId: string;
  /** El dia en que ocurrio, en hora de Colombia (YYYY-MM-DD). */
  fecha: string;
  /** El consecutivo de la factura que YA existe en Alegra. Sin el, registrarla no sirve para nada. */
  numeroDeFactura: string;
  medioDePago: "efectivo" | "wompi";
  lineas: LineaRetroactiva[];
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

/** El instante que se guarda: el dia dado, al mediodia de Bogota, igual que las consultas importadas. */
function instanteDelDia(fecha: string): Date {
  return new Date(`${fecha.slice(0, 10)}T17:00:00.000Z`);
}

export async function registrarVentaRetroactiva(
  input: NuevaVentaRetroactiva,
): Promise<{ id: string; total: number }> {
  const numero = input.numeroDeFactura.trim();
  if (numero.length === 0) {
    throw new VentaRetroactivaError("Escribe el número de la factura que ya se emitió por esta venta.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) {
    throw new VentaRetroactivaError("La fecha de la venta tiene que ser un día (aaaa-mm-dd).");
  }
  const cuando = instanteDelDia(input.fecha);
  if (Number.isNaN(cuando.getTime())) {
    throw new VentaRetroactivaError("Esa fecha no existe.");
  }
  // UNA VENTA RETROACTIVA OCURRIO ANTES, NUNCA DESPUES. Una fecha futura no es un descuido inofensivo: la
  // venta quedaria fuera de todos los cortes y aparecia sola semanas despues.
  if (cuando.getTime() > Date.now()) {
    throw new VentaRetroactivaError("La fecha de una venta que ya ocurrió no puede estar en el futuro.");
  }
  if (input.lineas.length === 0) {
    throw new VentaRetroactivaError("La venta necesita al menos un producto.");
  }
  for (const l of input.lineas) {
    if (!Number.isInteger(l.cantidad) || l.cantidad <= 0) {
      throw new VentaRetroactivaError("Las cantidades tienen que ser números enteros mayores que cero.");
    }
    if (!(l.precioUnitario > 0)) {
      throw new VentaRetroactivaError("Los precios tienen que ser mayores que cero.");
    }
  }

  // EL PRECIO ES EL DE ESE DIA, NO EL DEL CATALOGO DE HOY: se teclea con la venta, porque es lo que dice la
  // factura que ya se emitio. El catalogo cambio desde entonces y usarlo reescribiria la historia.
  const total = input.lineas.reduce((s, l) => s + l.precioUnitario * l.cantidad, 0);

  const { id } = await db.transaction(async (tx) => {
    const yaEsta = await tx.execute<{ id: string }>(sql`
      select id from transactions
       where registered_retroactively_at is not null and alegra_invoice_number = ${numero}`);
    if (yaEsta.length > 0) {
      throw new VentaRetroactivaError(
        `La factura ${numero} ya está registrada en Atlas. Registrarla dos veces contaría la misma venta dos veces.`,
      );
    }

    const locationId = await ubicacionDeLaVenta(tx, input.professionalId);
    if (!locationId) {
      throw new VentaRetroactivaError(
        "Ese profesional no tiene una ubicación de inventario: la venta no tendría de dónde salir.",
      );
    }

    const [t] = await tx
      .insert(transactions)
      .values({
        organizationId: input.organizationId,
        patientId: input.patientId,
        professionalId: input.professionalId,
        status: "paid",
        paymentMethod: input.medioDePago,
        amount: String(total),
        currency: "COP",
        // LA FECHA REAL DE LA VENTA. Es la unica escritura de `createdAt` en la app, y por eso existe este
        // camino: en cualquier otro, la venta ocurre cuando se registra.
        createdAt: cuando,
        // El ambiente con que esta configurado el sistema, como en la venta en efectivo. NO decide nada
        // aqui: lo que impide facturarla es ser retroactiva, y eso lo mira la puerta de facturacion.
        wompiEnv: wompiEnvDeLaLlave(process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY),
        locationId,
        deliveryMode: "en_consulta",
        operatedAt: cuando,
        stockState: "pendiente",
        // SU ENTREGA YA OCURRIO: el paciente se llevo el producto hace meses. Dejarla "pendiente" la pondria
        // en la lista de lo que hay que entregar, y nadie tiene nada que entregarle.
        fulfillmentState: "entregado",
        deliveredAt: cuando,
        // LA FACTURA QUE YA EXISTE. Sin id interno de Alegra a proposito (lo prohibe un CHECK de la 0169):
        // ese id lo asigna Alegra cuando ATLAS crea el documento, y ponerlo haria que la cola de facturacion
        // creyera que puede releerla y registrarle un pago sobre un documento que Atlas nunca creo.
        alegraInvoiceState: "emitida",
        alegraInvoiceNumber: numero,
        alegraEmittedAt: cuando,
        registeredRetroactivelyAt: new Date(),
        registeredRetroactivelyBy: input.actorId,
        idempotencyKey: `retroactiva-${numero}`,
      })
      .returning({ id: transactions.id });

    await tx.insert(transactionItems).values(
      input.lineas.map((l) => ({
        transactionId: t.id,
        nutraceuticalId: l.nutraceuticalId,
        quantity: l.cantidad,
        unitPrice: String(l.precioUnitario),
      })),
    );

    // EL REPARTO, CON LAS VIGENCIAS DE ESE DIA. Sellarlo con las de hoy le pondria una tasa de comision y una
    // participacion de proveedor que no eran las de entonces, y la liquidacion no cuadraria con lo que ya se
    // le pago a mano.
    await sellarContabilidadDeLaVenta(tx, { id: t.id, amount: String(total), professionalId: input.professionalId }, cuando);

    await recordAudit(tx, {
      event: "venta.registrada_retroactivamente",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "transaction",
      entityId: t.id,
      payload: {
        fecha_de_la_venta: input.fecha,
        factura: numero,
        total,
        lineas: input.lineas.length,
        profesional: input.professionalId,
      },
      ip: input.ip,
    });
    return { id: t.id };
  });

  return { id, total };
}

/** Las ventas retroactivas ya registradas, para la pantalla. */
export async function listarVentasRetroactivas(limite = 100): Promise<
  {
    id: string;
    fecha: string;
    factura: string;
    total: string;
    paciente: string | null;
    estadoDelInventario: string | null;
  }[]
> {
  const filas = await db.execute<{
    id: string;
    fecha: string;
    factura: string;
    total: string;
    paciente: string | null;
    stock_state: string | null;
  }>(sql`
    select t.id, t.created_at::text as fecha, t.alegra_invoice_number as factura, t.amount::text as total,
           nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '') as paciente,
           t.stock_state
      from transactions t
      left join patients p on p.id = t.patient_id
     where t.registered_retroactively_at is not null
     order by t.created_at desc
     limit ${limite}`);
  return filas.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    factura: f.factura,
    total: f.total,
    paciente: f.paciente,
    estadoDelInventario: f.stock_state,
  }));
}

/** Deshacer una venta retroactiva mal registrada, mientras no haya movido nada mas. */
export async function borrarVentaRetroactiva(input: {
  transactionId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [venta] = await tx.execute<{ id: string; stock_state: string | null; factura: string }>(sql`
      select id, stock_state, alegra_invoice_number as factura from transactions
       where id = ${input.transactionId} and registered_retroactively_at is not null`);
    if (!venta) {
      throw new VentaRetroactivaError("Esa venta no existe o no es una venta registrada retroactivamente.");
    }
    // SI YA MOVIO INVENTARIO, NO SE BORRA. Los movimientos son append-only (registro de custodia) y borrar la
    // venta dejaria movimientos apuntando a una linea que ya no existe. Se corrige con una devolucion, como
    // cualquier otra venta, no borrando el hecho.
    if (venta.stock_state === "descontado" || venta.stock_state === "sin_saldo") {
      throw new VentaRetroactivaError(
        "Esta venta ya descontó inventario, así que no se borra: su rastro de custodia quedaría suelto. Corrígela con una devolución.",
      );
    }
    await recordAudit(tx, {
      event: "venta.retroactiva_borrada",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "transaction",
      entityId: venta.id,
      payload: { factura: venta.factura },
      ip: input.ip,
    });
    await tx.execute(sql`delete from cnv_revenue where transaction_id = ${venta.id}`);
    await tx.execute(sql`delete from professional_revenue where transaction_id = ${venta.id}`);
    await tx.delete(transactions).where(eq(transactions.id, venta.id));
  });
}
