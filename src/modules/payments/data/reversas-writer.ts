import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import type { Propiedad, Reversa, TipoDeReversa } from "../reversa";

// ═══ LA REVERSA CONTRA LA BASE (Bloque 3b, sesion 1) ═══
//
// Abrir y resolver un contracargo. La regla de contabilidad manda: al ABRIR no se toca el ingreso (la disputa se
// puede ganar y la factura sigue valida); solo al PERDER se revierten ingreso y comision, con filas NEGATIVAS que
// apuntan a las originales, igual que el efectivo no recibido de la 0142. No se borra nada: el rastro de que
// existio y se revirtio es parte del control.

export class ReversaError extends Error {}

/** De quien era lo vendido, congelado al abrir el caso: importa para reclamarle al proveedor si se pierde. */
async function propiedadDeLaVenta(txId: string): Promise<Propiedad> {
  const [f] = await db.execute<{ propios: number; terceros: number }>(sql`
    select count(*) filter (where coalesce(n.ownership, 'propio') = 'propio')::int as propios,
           count(*) filter (where n.ownership = 'tercero')::int as terceros
      from transaction_items ti join nutraceuticals n on n.id = ti.nutraceutical_id
     where ti.transaction_id = ${txId}`);
  const propios = Number(f?.propios ?? 0);
  const terceros = Number(f?.terceros ?? 0);
  if (propios === 0 && terceros === 0) return "desconocido";
  if (terceros === 0) return "propio";
  if (propios === 0) return "tercero";
  return "mixto";
}

export type AbrirReversa = {
  transactionId: string;
  tipo: TipoDeReversa;
  referenciaDeLaDisputa: string | null;
  montoDebitado: string | null;
  debitadoEn: string | null;
  nota: string | null;
  /** null cuando la abre Atlas solo (un VOIDED por webhook o por el cotejo). */
  actorId: string | null;
};

/**
 * Abre el caso. Devuelve el id, o null si esa venta YA tenia una reversa abierta (el indice unico lo impide:
 * dos casos vivos sobre la misma venta revertirian el ingreso dos veces).
 */
export async function abrirReversa(e: AbrirReversa): Promise<string | null> {
  const [venta] = await db.execute<{ status: string }>(sql`
    select status::text as status from transactions where id = ${e.transactionId}`);
  if (!venta) throw new ReversaError("Esa venta no existe.");
  // Solo se revierte lo que se cobro: una venta pendiente o fallida no tiene ingreso que devolver.
  if (venta.status !== "paid") throw new ReversaError("Solo se abre una reversa sobre una venta pagada.");

  const propiedad = await propiedadDeLaVenta(e.transactionId);
  const filas = await db.execute<{ id: string }>(sql`
    insert into sale_reversals (transaction_id, kind, state, dispute_reference, debited_amount, debited_at,
                                product_ownership, opened_by, note)
    values (${e.transactionId}, ${e.tipo}, 'abierta', ${e.referenciaDeLaDisputa},
            ${e.montoDebitado}::numeric, ${e.debitadoEn}::date, ${propiedad}, ${e.actorId}, ${e.nota})
    on conflict do nothing
    returning id`);
  return filas.length > 0 ? filas[0].id : null;
}

/**
 * Resuelve el caso. GANADA cierra sin efecto economico. PERDIDA revierte ingreso y comision en la MISMA
 * transaccion que el cierre: o se mueven las dos cosas, o no se mueve ninguna.
 */
export async function resolverReversa(e: {
  reversaId: string;
  resultado: "ganada" | "perdida";
  referenciaDeLaRespuesta: string | null;
  actorId: string;
}): Promise<{ transactionId: string; revirtio: boolean }> {
  return db.transaction(async (tx) => {
    const [r] = await tx.execute<{ transaction_id: string; state: string }>(sql`
      select transaction_id, state from sale_reversals where id = ${e.reversaId} for update`);
    if (!r) throw new ReversaError("Esa reversa no existe.");
    if (r.state !== "abierta") throw new ReversaError("Esa reversa ya estaba resuelta.");

    await tx.execute(sql`
      update sale_reversals
         set state = ${e.resultado}, resolved_at = now(), resolved_by = ${e.actorId},
             resolution_reference = ${e.referenciaDeLaRespuesta}, updated_at = now()
       where id = ${e.reversaId}`);

    if (e.resultado !== "perdida") return { transactionId: r.transaction_id, revirtio: false };

    // LA REVERSION, con la misma forma que el efectivo no recibido: una fila negativa por cada fila de ingreso,
    // apuntando a la que revierte. `reversal_of is null` evita revertir una reversion.
    await tx.execute(sql`
      insert into professional_revenue (transaction_id, professional_id, commission_rate, commission_amount, reversal_of)
      select transaction_id, professional_id, commission_rate, -commission_amount, id
        from professional_revenue where transaction_id = ${r.transaction_id} and reversal_of is null`);
    await tx.execute(sql`
      insert into cnv_revenue (transaction_id, amount, reversal_of)
      select transaction_id, -amount, id from cnv_revenue where transaction_id = ${r.transaction_id} and reversal_of is null`);
    return { transactionId: r.transaction_id, revirtio: true };
  });
}

/** El numero de la nota credito que contabilidad hizo a mano en Alegra. Solo sobre una reversa PERDIDA. */
export async function registrarNotaCreditoDeReversa(reversaId: string, numero: string): Promise<boolean> {
  const filas = await db.execute<{ id: string }>(sql`
    update sale_reversals set credit_note_manual_number = ${numero}, updated_at = now()
     where id = ${reversaId} and state = 'perdida' and credit_note_manual_number is null
    returning id`);
  return filas.length > 0;
}

export type ReversaEnPantalla = Reversa & {
  referenciaDeLaDisputa: string | null;
  productos: string | null;
  abiertaPor: string | null;
  resueltaPor: string | null;
  nota: string | null;
};

/** Las reversas que todavia piden algo, y las resueltas recientes, para el panel. */
export async function listarReversas(limite = 50): Promise<ReversaEnPantalla[]> {
  const filas = await db.execute<{
    id: string;
    transaction_id: string;
    kind: string;
    state: string;
    monto: string;
    debitado: string | null;
    propiedad: string;
    abierta_en: string;
    resuelta_en: string | null;
    nota_credito: string | null;
    referencia: string | null;
    productos: string | null;
    abierta_por: string | null;
    resuelta_por: string | null;
    nota: string | null;
  }>(sql`
    select r.id, r.transaction_id, r.kind, r.state, t.amount::text as monto,
           r.debited_amount::text as debitado, r.product_ownership as propiedad,
           r.opened_at::text as abierta_en, r.resolved_at::text as resuelta_en,
           r.credit_note_manual_number as nota_credito, r.dispute_reference as referencia,
           (select string_agg(n.name || ' x' || ti.quantity, ', ' order by n.name)
              from transaction_items ti join nutraceuticals n on n.id = ti.nutraceutical_id
             where ti.transaction_id = t.id) as productos,
           pa.full_name as abierta_por, pr.full_name as resuelta_por, r.note as nota
      from sale_reversals r
      join transactions t on t.id = r.transaction_id
      left join profiles pa on pa.id = r.opened_by
      left join profiles pr on pr.id = r.resolved_by
     where r.state = 'abierta'
        or (r.state = 'perdida' and r.credit_note_manual_number is null)
        or r.resolved_at > now() - interval '30 days'
     order by r.opened_at desc
     limit ${limite}`);
  return filas.map((f) => ({
    id: f.id,
    transactionId: f.transaction_id,
    tipo: f.kind as TipoDeReversa,
    estado: f.state as Reversa["estado"],
    montoDeLaVenta: String(f.monto),
    montoDebitado: f.debitado,
    propiedad: f.propiedad as Propiedad,
    abiertaEn: f.abierta_en,
    resueltaEn: f.resuelta_en,
    notaCredito: f.nota_credito,
    referenciaDeLaDisputa: f.referencia,
    productos: f.productos,
    abiertaPor: f.abierta_por,
    resueltaPor: f.resuelta_por,
    nota: f.nota,
  }));
}
