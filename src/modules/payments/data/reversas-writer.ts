import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import type { Propiedad, Reversa, TipoDeReversa } from "../reversa";

// La transaccion de BD, para las funciones que corren DENTRO de otra (la devolucion fisica abre la suya).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  /**
   * Lo que el banco debito, YA CONVERTIDO A NUMERO (2026-09-25). Antes viajaba como TEXTO CRUDO hasta el SQL
   * (`::numeric`), asi que "150.000" se guardaba como 150: el validador y Postgres coincidian en la cifra
   * equivocada. La lectura vive ahora en el schema, con `importeTecleado`, y aqui llega un numero.
   */
  montoDebitado: number | null;
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
    // EL CASO VIAJA CON EL NEGATIVO desde la 0176: hasta hoy una fila negativa decia QUE revertia pero no POR
    // QUE, y "de donde salio este menos treinta mil" habia que reconstruirlo. Ahora se lee en la fila.
    await tx.execute(sql`
      insert into professional_revenue (transaction_id, professional_id, commission_rate, commission_amount,
                                        reversal_of, sale_reversal_id)
      select transaction_id, professional_id, commission_rate, -commission_amount, id, ${e.reversaId}
        from professional_revenue where transaction_id = ${r.transaction_id} and reversal_of is null`);
    await tx.execute(sql`
      insert into cnv_revenue (transaction_id, amount, reversal_of, sale_reversal_id)
      select transaction_id, -amount, id, ${e.reversaId}
        from cnv_revenue where transaction_id = ${r.transaction_id} and reversal_of is null`);
    return { transactionId: r.transaction_id, revirtio: true };
  });
}

/**
 * El numero de la nota credito que contabilidad hizo a mano en Alegra. Sobre una reversa PERDIDA o DEVUELTA:
 * las dos corrigen una factura ya emitida, y las dos la piden (la 0175 abrio el CHECK para las dos).
 *
 * DECIA SOLO 'perdida' Y ESO DEJABA LA DEVOLUCION SIN CIERRE: movia el dinero, avisaba que hacia falta la
 * nota credito, y no habia forma de escribir su numero.
 */
export async function registrarNotaCreditoDeReversa(reversaId: string, numero: string): Promise<boolean> {
  const filas = await db.execute<{ id: string }>(sql`
    update sale_reversals set credit_note_manual_number = ${numero}, updated_at = now()
     where id = ${reversaId} and state in ('perdida', 'devuelta') and credit_note_manual_number is null
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
        -- LAS DOS QUE PIDEN NOTA CREDITO, no solo la perdida: una devolucion tambien corrige una factura ya
        -- emitida. Sin esto desaparecia del panel a los 30 dias con su nota credito sin emitir.
        or (r.state in ('perdida', 'devuelta') and r.credit_note_manual_number is null)
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

// ═══ LA DEVOLUCION TAMBIEN MUEVE EL DINERO (2026-09-25) ═══
//
// EL SMOKE LO DESTAPO: el producto volvia y el ingreso se quedaba. La comision seguia entera en la
// liquidacion y el historial seguia diciendo "Pagado".
//
// NO HAY MAQUINA NUEVA: es la misma reversion de siempre (filas NEGATIVAS que apuntan a las originales) con
// tres diferencias que vienen del hecho, no del codigo:
//
//   1. NO ES UNA DISPUTA. No hay banco al que responderle: el producto ya volvio. Nace 'devuelta', sin pasar
//      por 'abierta', porque no hay nada que esperar.
//   2. ES PROPORCIONAL. Se devuelven UNIDADES de una LINEA. Si el paciente compro dos y devuelve una, se
//      revierte la mitad de ESA linea, no la venta entera.
//   3. Y EL MONTO NO SE RECALCULA: sale del reparto SELLADO en la linea (0143). Recalcularlo con las tasas de
//      hoy daria otra cifra que la que se le liquido al integrante ese dia.

export class DevolucionDeDineroError extends Error {}

export type ReversionDeDevolucion = {
  reversaId: string;
  /** Lo que se le devuelve al paciente por las unidades devueltas (con IVA, que es lo que pago). */
  alPaciente: number;
  comisionRevertida: number;
  ingresoRevertido: number;
};

/**
 * Revierte la parte del dinero que corresponde a las unidades devueltas de UNA linea.
 *
 * Corre DENTRO de la transaccion que registra la devolucion fisica: o vuelven el producto y el dinero, o no
 * vuelve ninguno. Que el producto sea reincorporable o no es OTRA decision (la verificacion) y no cambia
 * esta: el paciente devolvio y su dinero se le devuelve pase lo que pase con el frasco.
 */
export async function revertirDineroDeLaDevolucion(
  tx: Tx,
  input: { transactionItemId: string; cantidadDevuelta: number; actorId: string },
): Promise<ReversionDeDevolucion> {
  const [linea] = await tx.execute<{
    transaction_id: string;
    quantity: number;
    unit_price: string;
    commission_amount: string | null;
    cnv_amount: string | null;
    sealed_at: string | null;
    professional_id: string | null;
    commission_rate: string | null;
  }>(sql`
    select ti.transaction_id, ti.quantity, ti.unit_price::text as unit_price,
           ti.commission_amount::text as commission_amount, ti.cnv_amount::text as cnv_amount,
           ti.sealed_at::text as sealed_at, ti.commission_rate::text as commission_rate,
           t.professional_id
      from transaction_items ti
      join transactions t on t.id = ti.transaction_id
     where ti.id = ${input.transactionItemId}`);
  if (!linea) throw new DevolucionDeDineroError("Esa línea de venta no existe.");

  const vendidas = Number(linea.quantity);
  if (!(input.cantidadDevuelta > 0) || input.cantidadDevuelta > vendidas) {
    throw new DevolucionDeDineroError("Las unidades devueltas no pueden superar las vendidas.");
  }
  const proporcion = input.cantidadDevuelta / vendidas;
  const alPeso = (n: number) => Math.round(n * 100) / 100;

  // LO QUE SE LE DEVUELVE AL PACIENTE es lo que pago por esas unidades: precio con IVA por cantidad. Eso es
  // lo que la nota credito tiene que decir, y no depende del reparto.
  const alPaciente = alPeso(Number(linea.unit_price) * input.cantidadDevuelta);

  // SIN REPARTO SELLADO no se revierte a ciegas: una venta anterior al sellado (0143) no tiene de donde
  // sacar la parte proporcional, y repartirla con las tasas de hoy inventaria una cifra. Se dice y se para.
  if (!linea.sealed_at || linea.commission_amount == null || linea.cnv_amount == null) {
    throw new DevolucionDeDineroError(
      "Esta venta es anterior al reparto sellado por línea, así que no se puede revertir la parte proporcional. Hay que resolverla a mano con contabilidad.",
    );
  }

  const comisionRevertida = alPeso(Number(linea.commission_amount) * proporcion);
  const ingresoRevertido = alPeso(Number(linea.cnv_amount) * proporcion);

  const [reversa] = await tx.execute<{ id: string }>(sql`
    insert into sale_reversals (transaction_id, kind, state, product_ownership, opened_by, resolved_at,
                                resolved_by, transaction_item_id, returned_quantity, debited_amount, note)
    values (${linea.transaction_id}, 'devolucion', 'devuelta',
            (select case when count(*) filter (where n.ownership = 'tercero') > 0
                           and count(*) filter (where n.ownership <> 'tercero') > 0 then 'mixto'
                         when count(*) filter (where n.ownership = 'tercero') > 0 then 'tercero'
                         else 'propio' end
               from transaction_items i join nutraceuticals n on n.id = i.nutraceutical_id
              where i.transaction_id = ${linea.transaction_id}),
            ${input.actorId}, now(), ${input.actorId}, ${input.transactionItemId},
            ${input.cantidadDevuelta}, ${alPaciente}::numeric,
            ${`Devolución de ${input.cantidadDevuelta} de ${vendidas} unidades de la línea.`})
    returning id`);

  // LAS FILAS NEGATIVAS, con la MISMA forma que el contracargo perdido, pero por la parte devuelta. La tasa
  // que se copia es la SELLADA en la linea: es la que explica la cifra.
  if (linea.professional_id && comisionRevertida !== 0) {
    await tx.execute(sql`
      insert into professional_revenue (transaction_id, professional_id, commission_rate, commission_amount,
                                        reversal_of, sale_reversal_id)
      select ${linea.transaction_id}, ${linea.professional_id}, ${linea.commission_rate}::numeric,
             ${-comisionRevertida}::numeric, id, ${reversa.id}
        from professional_revenue
       where transaction_id = ${linea.transaction_id} and reversal_of is null
       limit 1`);
  }
  if (ingresoRevertido !== 0) {
    await tx.execute(sql`
      insert into cnv_revenue (transaction_id, amount, reversal_of, sale_reversal_id)
      select ${linea.transaction_id}, ${-ingresoRevertido}::numeric, id, ${reversa.id}
        from cnv_revenue where transaction_id = ${linea.transaction_id} and reversal_of is null
       limit 1`);
  }

  return { reversaId: reversa.id, alPaciente, comisionRevertida, ingresoRevertido };
}
