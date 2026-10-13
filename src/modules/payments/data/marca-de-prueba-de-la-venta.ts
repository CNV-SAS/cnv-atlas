import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { recordAudit } from "@/modules/audit/log";

// ═══ MARCAR UNA VENTA COMO PRUEBA (0217) ═══
//
// EL CASO QUE NO SE PUEDE DERIVAR, y es el unico que le faltaba a la arquitectura de lo de prueba: un
// profesional REAL vendiendole un producto REAL a un paciente REAL, como prueba. La 0203 deriva la marca
// de QUIEN y de QUE, nunca del ACTO, asi que este caso no tenia de donde salir.
//
// Y ES UN CASO REAL, textual de Santiago: *"una venta de luvia que se habia hecho a Maria Camila nunca lo
// habiamos podido borrar ni ocultar"*. Marcar el producto no sirve (LUVIA es el producto real que se vende)
// y marcar a la paciente tampoco (es real, y la marca le arrastraria toda su historia, incluida la clinica).
//
// ── LO QUE ESTA MARCA HACE Y LO QUE NO ──
//
// HACE: la venta deja de contar en las catorce lecturas que leen `cuenta_como_de_prueba`, de una sola vez,
// porque esto es una cuarta ENTRADA de esa derivacion y no un filtro nuevo. El bruto, el ingreso de CNV, los
// insights, el historico del profesional, la liquidacion, la bandeja de ventas por revisar y los avisos
// pendientes salen de ahi.
//
// NO HACE: devolver la unidad al estante. Los movimientos de inventario son inmutables a proposito (describen
// algo que PASO) y la unidad salio de verdad. La correccion fisica es un movimiento de `conciliacion` por
// ubicacion, con su motivo, y lo registra otra persona.
//
// NO HACE: sacar el aviso de "cobrada sin saldo". Esa rama mira el PRODUCTO porque habla de UNIDADES
// FISICAS, y las unidades no entienden de marcas (la razon esta escrita en `avisos-repository.ts`). Si el
// producto era real, la vitrina esta descuadrada DE VERDAD; lo que cierra ese aviso es la conciliacion, o
// descartarlo con su motivo.

export class MarcaDeVentaError extends Error {}

/** El motivo tiene cuerpo: lo exige tambien el CHECK de la 0217, y aqui se dice con palabras. */
const MOTIVO_MINIMO = 10;

/**
 * MARCA una venta como de prueba. Idempotente: marcarla dos veces no cambia nada ni duplica el rastro.
 *
 * LA COLUMNA DERIVADA NO SE TOCA AQUI: la escribe el trigger de la 0217 al ver `marcada_como_prueba_at`.
 * Escribirla a mano seria tener dos autores de la misma respuesta, que es justo lo que la 0203 cerro.
 */
export async function marcarVentaComoPrueba(input: {
  transactionId: string;
  motivo: string;
  actorId: string;
  actorEmail: string | null;
  ip: string | null;
}): Promise<{ yaEstaba: boolean }> {
  const motivo = input.motivo.trim();
  if (motivo.length < MOTIVO_MINIMO) {
    throw new MarcaDeVentaError(
      "Escribe por qué esta venta fue una prueba. Sin motivo, en seis meses la única respuesta sería que alguien la marcó.",
    );
  }
  return db.transaction(async (tx) => {
    const [t] = await tx.execute<{ id: string; marcada: string | null }>(sql`
      select id, marcada_como_prueba_at as marcada from transactions
       where id = ${input.transactionId}::uuid for update`);
    if (!t) throw new MarcaDeVentaError("Esa venta no existe.");
    if (t.marcada) return { yaEstaba: true };

    await tx.execute(sql`
      update transactions
         set marcada_como_prueba_at = now(),
             marcada_como_prueba_por = ${input.actorId}::uuid,
             marcada_como_prueba_motivo = ${motivo}
       where id = ${input.transactionId}::uuid`);

    await recordAudit(tx, {
      event: "venta.marcada_de_prueba",
      entityType: "transaction",
      entityId: input.transactionId,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
      payload: { motivo },
    });
    return { yaEstaba: false };
  });
}

/**
 * LA DESMARCA, porque una marca que no se puede deshacer es una marca que nadie se atreve a poner.
 *
 * Y TAMBIEN EXIGE MOTIVO: desmarcar devuelve plata a las cifras, asi que es tan consecuente como marcar. La
 * asimetria estaria en pedir razones solo para una de las dos direcciones.
 *
 * SI LA VENTA SIGUE SIENDO DE PRUEBA POR OTRA RAZON (su paciente, su profesional o su producto), la columna
 * derivada se queda en true y esta funcion lo DICE en su respuesta, en vez de dejar creer que volvio a
 * contar. Es la clase de contradiccion que si no se dice se descubre mirando una cifra que no cambio.
 */
export async function desmarcarVentaComoPrueba(input: {
  transactionId: string;
  motivo: string;
  actorId: string;
  actorEmail: string | null;
  ip: string | null;
}): Promise<{ noEstaba: boolean; sigueSiendoDePrueba: boolean }> {
  const motivo = input.motivo.trim();
  if (motivo.length < MOTIVO_MINIMO) {
    throw new MarcaDeVentaError("Escribe por qué esta venta sí cuenta.");
  }
  return db.transaction(async (tx) => {
    const [t] = await tx.execute<{ id: string; marcada: string | null }>(sql`
      select id, marcada_como_prueba_at as marcada from transactions
       where id = ${input.transactionId}::uuid for update`);
    if (!t) throw new MarcaDeVentaError("Esa venta no existe.");
    if (!t.marcada) return { noEstaba: true, sigueSiendoDePrueba: false };

    await tx.execute(sql`
      update transactions
         set marcada_como_prueba_at = null, marcada_como_prueba_por = null,
             marcada_como_prueba_motivo = null
       where id = ${input.transactionId}::uuid`);

    // SE RELEE DESPUES del trigger: es la respuesta de la derivacion, no una conjetura nuestra.
    const [despues] = await tx.execute<{ de_prueba: boolean }>(sql`
      select cuenta_como_de_prueba as de_prueba from transactions
       where id = ${input.transactionId}::uuid`);

    await recordAudit(tx, {
      event: "venta.desmarcada_de_prueba",
      entityType: "transaction",
      entityId: input.transactionId,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
      payload: { motivo, sigueSiendoDePrueba: despues?.de_prueba === true },
    });
    return { noEstaba: false, sigueSiendoDePrueba: despues?.de_prueba === true };
  });
}
