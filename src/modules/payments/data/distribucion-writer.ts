import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { recordAudit } from "@/modules/audit/log";

import {
  armarCuentaQuincenal,
  corteDe,
  plazosDelCorte,
  precioDeFacturacionSellado,
  puedeDespacharse,
  type CuentaQuincenal,
  type LineaDeLaCuenta,
} from "../distribucion";
import { UVT_2026 } from "../liquidacion";

// ═══ LA CUENTA QUINCENAL: LEERLA, EMITIRLA, OBJETARLA Y COBRARLA (0188) ═══
//
// UNA SOLA IMPLEMENTACION DE LA CIFRA, y es la del modulo puro. Aqui solo se leen las lineas SELLADAS y se
// le pasan a `armarCuentaQuincenal`. Ningun SELECT de este archivo suma plata por su cuenta: si lo hiciera,
// habria dos aritmeticas capaces de discrepar, que es exactamente lo que el sellado de la venta evita.
//
// LA UNICA EXCEPCION ES EL SALDO PENDIENTE, que suma en SQL para no traerse todas las lineas de todos los
// cortes abiertos solo para contar. Lleva su candado: un test compara esa suma con la del modulo puro sobre
// los mismos datos.

export class CuentaNoEmitibleError extends Error {}

type FilaDeLinea = {
  transaction_id: string;
  dia: string;
  producto: string;
  cantidad: number;
  base_sellada: string;
  descuento_sellado: string;
};

/**
 * Las lineas de un Integrante SELLADAS como distribucion, dentro del corte y SIN FACTURAR.
 *
 * "Sin facturar" es lo que impide cobrar dos veces la misma venta, y va en la consulta y no en un filtro
 * posterior: un olvido en la aplicacion volveria a cobrar, y eso no lo nota nadie hasta que el Integrante
 * lo reclama.
 */
async function lineasDelCorte(
  ex: { execute: typeof db.execute },
  professionalId: string,
  desde: string,
  hasta: string,
): Promise<LineaDeLaCuenta[]> {
  const filas = await ex.execute<FilaDeLinea>(sql`
    select t.id as transaction_id,
           (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date::text as dia,
           n.name as producto,
           ti.quantity::int as cantidad,
           ti.base_amount as base_sellada,
           ti.commission_amount as descuento_sellado
      from transaction_items ti
      join transactions t on t.id = ti.transaction_id
      join nutraceuticals n on n.id = ti.nutraceutical_id
     where t.professional_id = ${professionalId}
       and ti.modality = 'distribucion'
       and ti.sealed_at is not null
       and t.distribucion_statement_id is null
       and (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date
             between ${desde}::date and ${hasta}::date
     order by dia, n.name`);
  return filas.map((f) => ({
    transactionId: f.transaction_id,
    dia: f.dia,
    producto: f.producto,
    cantidad: Number(f.cantidad),
    baseSellada: Number(f.base_sellada ?? 0),
    descuentoSellado: Number(f.descuento_sellado ?? 0),
  }));
}

/** Si es agente retenedor (codigo 07 del RUT). NULL = sin verificar, y entonces no se anticipa retencion. */
async function esAgenteRetenedor(
  ex: { execute: typeof db.execute },
  professionalId: string,
): Promise<boolean> {
  const [f] = await ex.execute<{ agente: boolean | null }>(sql`
    select tax_is_withholding_agent as agente from professional_profiles where id = ${professionalId}`);
  return f?.agente === true;
}

/**
 * LA CUENTA DE UN CORTE, SIN EMITIRLA. Es lo que ve CNV antes de emitir y lo que ve el Integrante de su
 * cuenta ya emitida: la misma funcion, para que no puedan decir cifras distintas.
 */
export async function cuentaDelCorte(
  professionalId: string,
  dia: string,
  statementId?: string,
): Promise<CuentaQuincenal> {
  const corte = corteDe(dia);
  const lineas = statementId
    ? await lineasDeLaCuenta(statementId)
    : await lineasDelCorte(db, professionalId, corte.desde, corte.hasta);
  return armarCuentaQuincenal({
    corte,
    lineas,
    esAgenteRetenedor: await esAgenteRetenedor(db, professionalId),
    uvt: UVT_2026,
  });
}

/** Las lineas que YA quedaron dentro de una cuenta emitida. */
async function lineasDeLaCuenta(statementId: string): Promise<LineaDeLaCuenta[]> {
  const filas = await db.execute<FilaDeLinea>(sql`
    select t.id as transaction_id,
           (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date::text as dia,
           n.name as producto,
           ti.quantity::int as cantidad,
           ti.base_amount as base_sellada,
           ti.commission_amount as descuento_sellado
      from transaction_items ti
      join transactions t on t.id = ti.transaction_id
      join nutraceuticals n on n.id = ti.nutraceutical_id
     where t.distribucion_statement_id = ${statementId}
     order by dia, n.name`);
  return filas.map((f) => ({
    transactionId: f.transaction_id,
    dia: f.dia,
    producto: f.producto,
    cantidad: Number(f.cantidad),
    baseSellada: Number(f.base_sellada ?? 0),
    descuentoSellado: Number(f.descuento_sellado ?? 0),
  }));
}

/**
 * EMITE la cuenta de un corte: crea la fila y MARCA las ventas que se lleva, en una sola transaccion.
 *
 * SIN VENTAS NO SE EMITE, y no es una comodidad: el modelo lo dice textual, "si no hubo ventas, no se emite
 * factura". Una factura en cero es un documento fiscal por nada.
 */
export async function emitirCuenta(input: {
  professionalId: string;
  /** Un dia cualquiera del corte que se va a emitir. */
  dia: string;
  actorId: string;
  actorEmail: string | null;
  ip: string | null;
}): Promise<{ statementId: string; ventas: number }> {
  const corte = corteDe(input.dia);
  return db.transaction(async (tx) => {
    // Se bloquean las ventas antes de leerlas: dos emisiones simultaneas del mismo corte se llevarian las
    // mismas ventas y quedarian dos facturas por lo mismo.
    await tx.execute(sql`
      select t.id from transactions t
        join transaction_items ti on ti.transaction_id = t.id
       where t.professional_id = ${input.professionalId}
         and ti.modality = 'distribucion'
         and t.distribucion_statement_id is null
           for update of t`);

    const lineas = await lineasDelCorte(tx, input.professionalId, corte.desde, corte.hasta);
    if (lineas.length === 0) {
      throw new CuentaNoEmitibleError(
        `No hay ventas sin facturar en el corte del ${corte.desde} al ${corte.hasta}. Si no hubo ventas, no se emite factura.`,
      );
    }

    const [s] = await tx.execute<{ id: string }>(sql`
      insert into distribucion_statements (professional_id, corte_desde, corte_hasta, emitted_by)
      values (${input.professionalId}, ${corte.desde}::date, ${corte.hasta}::date, ${input.actorId})
      returning id`);

    const ids = [...new Set(lineas.map((l) => l.transactionId))];
    for (const id of ids) {
      await tx.execute(sql`
        update transactions set distribucion_statement_id = ${s.id} where id = ${id}`);
    }

    const cuenta = armarCuentaQuincenal({
      corte,
      lineas,
      esAgenteRetenedor: await esAgenteRetenedor(tx, input.professionalId),
      uvt: UVT_2026,
    });

    await recordAudit(tx, {
      event: "distribucion.cuenta_emitida",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
      entityType: "distribucion_statements",
      entityId: s.id,
      payload: {
        corte: `${corte.desde}..${corte.hasta}`,
        ventas: ids.length,
        base: cuenta.base,
        iva: cuenta.iva,
        total: cuenta.total,
        // EL TOTAL QUEDA EN EL AUDIT, no en la tabla: asi hay rastro de lo que se afirmo el dia de la
        // emision sin crear una segunda fuente que la pantalla pueda leer y contradecir a las lineas.
      },
    });

    return { statementId: s.id, ventas: ids.length };
  });
}

/** EL INTEGRANTE OBJETA, con motivo. El modelo pide que sea "de forma sustentada". */
export async function objetarCuenta(input: {
  statementId: string;
  professionalId: string;
  motivo: string;
  actorId: string;
  actorEmail: string | null;
}): Promise<void> {
  const filas = await db.execute<{ id: string }>(sql`
    update distribucion_statements
       set objected_at = now(), objection_note = ${input.motivo}
     where id = ${input.statementId}
       and professional_id = ${input.professionalId}
       and objected_at is null
       and paid_at is null
       and replaced_by_id is null
    returning id`);
  if (filas.length === 0) {
    throw new CuentaNoEmitibleError("Esa cuenta no es tuya, ya la objetaste, o ya está pagada.");
  }
  await db.transaction(async (tx) => {
    await recordAudit(tx, {
      event: "distribucion.cuenta_objetada",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "distribucion_statements",
      entityId: input.statementId,
      payload: { motivo: input.motivo },
    });
  });
}

/**
 * CNV RESUELVE la objecion. 'sostenida' deja la cuenta como estaba; 'corregida' la retira devolviendo sus
 * ventas al pozo de lo no facturado, para que el corte se pueda volver a emitir.
 *
 * LA CUENTA CORREGIDA NO SE EDITA, SE REEMPLAZA: editarla dejaria una factura cuyo contenido cambio despues
 * de entregada, y es justo lo que una objecion tiene que poder demostrar que no pasa.
 */
export async function resolverObjecion(input: {
  statementId: string;
  desenlace: "corregida" | "sostenida";
  actorId: string;
  actorEmail: string | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [s] = await tx.execute<{ id: string; objected_at: string | null; paid_at: string | null }>(sql`
      select id, objected_at, paid_at from distribucion_statements where id = ${input.statementId} for update`);
    if (!s) throw new CuentaNoEmitibleError("Esa cuenta no existe.");
    if (!s.objected_at) throw new CuentaNoEmitibleError("Esa cuenta no está objetada.");
    if (s.paid_at) throw new CuentaNoEmitibleError("Esa cuenta ya está pagada.");

    await tx.execute(sql`
      update distribucion_statements
         set objection_resolved_at = now(), objection_outcome = ${input.desenlace}
       where id = ${input.statementId}`);

    if (input.desenlace === "corregida") {
      // Las ventas vuelven a estar sin facturar. No se borran ni se editan: la cuenta retirada queda con su
      // rastro y el corte se emite de nuevo, con lo que corresponda.
      await tx.execute(sql`
        update transactions set distribucion_statement_id = null
         where distribucion_statement_id = ${input.statementId}`);
    }

    await recordAudit(tx, {
      event: "distribucion.objecion_resuelta",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "distribucion_statements",
      entityId: input.statementId,
      payload: { desenlace: input.desenlace },
    });
  });
}

/** CNV registra el pago de la cuenta. El monto es la cifra que contabilidad concilia contra el extracto. */
export async function registrarPagoDeCuenta(input: {
  statementId: string;
  monto: number;
  nota: string | null;
  actorId: string;
  actorEmail: string | null;
}): Promise<void> {
  const filas = await db.execute<{ id: string }>(sql`
    update distribucion_statements
       set paid_at = now(), paid_amount = ${String(input.monto)}, paid_note = ${input.nota}
     where id = ${input.statementId} and paid_at is null and replaced_by_id is null
    returning id`);
  if (filas.length === 0) throw new CuentaNoEmitibleError("Esa cuenta ya estaba pagada o fue reemplazada.");
  await db.transaction(async (tx) => {
    await recordAudit(tx, {
      event: "distribucion.cuenta_pagada",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "distribucion_statements",
      entityId: input.statementId,
      payload: { monto: input.monto, nota: input.nota },
    });
  });
}

export type EstadoDeCredito = {
  /** Lo VENDIDO y no pagado, que incluye lo que todavia no se ha facturado (corregido el 2026-10-06). */
  saldoPendiente: number;
  cupo: number | null;
  enMoraDesde: string | null;
  puede: boolean;
  motivo: string | null;
  /** El aviso para admin cuando paso el cupo. El cupo AVISA, no bloquea (Santiago, 2026-10-06). */
  avisoDeCupo: string | null;
};

/**
 * EL ESTADO DE CREDITO de un Integrante: cuanto debe, cual es su cupo y si esta en mora.
 *
 * LA SUMA VA EN SQL, y es la unica cifra de plata de este archivo que no pasa por el modulo puro: traerse
 * todas las lineas de todos los cortes abiertos para contar seria caro y esto se consulta en cada despacho.
 * Por eso lleva candado: un test compara esta suma con la del modulo puro sobre los mismos datos.
 *
 * La aritmetica es la misma, renglon por renglon: base descontada al peso, IVA al peso sobre ella, y la
 * suma de los dos. Redondear al final daria otra cifra.
 */
export async function estadoDeCredito(professionalId: string, hoy: string): Promise<EstadoDeCredito> {
  const [f] = await db.execute<{ cupo: string | null }>(sql`
    select credit_limit as cupo from professional_profiles where id = ${professionalId}`);
  const cupo = f?.cupo == null ? null : Number(f.cupo);

  // ═══ LO VENDIDO Y NO PAGADO, NO SOLO LO FACTURADO (corregido el 2026-10-06) ═══
  //
  // ── EL HUECO QUE TENIA, y lo encontre al mirar de donde salia la cifra ──
  //
  // Esta suma solo contaba las ventas que YA ESTABAN EN UNA CUENTA EMITIDA y sin pagar (el `join` con
  // `distribucion_statements`). O sea que una venta registrada antes de emitir la cuenta del corte NO CONTABA.
  //
  // Con un cupo de 3 millones y una quincena de 3, el Integrante podia tener 6 sin pagar y el aviso no decia
  // nada, porque la mitad todavia no estaba facturada. El aviso llegaba tarde, que es lo que lo volveria
  // inutil.
  //
  // ── Y EL ASESOR LEGAL PIDIO LO CONTRARIO, textual ──
  //
  // "El cupo cubre el saldo ya VENDIDO y no pagado." Vendido, no facturado. Son dos momentos distintos y el
  // codigo usaba el segundo.
  //
  // ── LAS DOS MITADES, y por que van en una sola consulta ──
  //
  //   · lo FACTURADO y sin pagar: las lineas de cuentas emitidas, no pagadas y no reemplazadas;
  //   · y lo VENDIDO sin facturar todavia: las lineas selladas como distribucion sin cuenta
  //     (`distribucion_statement_id is null`), que es el mismo criterio con el que `lineasDelCorte` arma el
  //     corte. Si fueran dos consultas sumadas en TypeScript, una venta podria entrar en las dos durante la
  //     emision y contarse doble.
  //
  // LA ARITMETICA ES LA MISMA del modulo puro, renglon por renglon (base descontada al peso, IVA al peso sobre
  // ella), y su candado la compara.
  const [suma] = await db.execute<{ total: string | null }>(sql`
    select sum(round(ti.base_amount - ti.commission_amount)
             + round(round(ti.base_amount - ti.commission_amount) * 0.19)) as total
      from transaction_items ti
      join transactions t on t.id = ti.transaction_id
      left join distribucion_statements s on s.id = t.distribucion_statement_id
     where ti.modality = 'distribucion'
       and ti.sealed_at is not null
       and t.professional_id = ${professionalId}
       and (
         -- FACTURADO Y SIN PAGAR
         (s.id is not null and s.paid_at is null and s.replaced_by_id is null)
         -- O VENDIDO Y TODAVIA SIN FACTURAR
         or t.distribucion_statement_id is null
       )`);
  const saldoPendiente = suma?.total == null ? 0 : Number(suma.total);

  // LA MORA SE DEDUCE DE LOS PLAZOS, no de una columna: una columna "en mora" habria que mantenerla al dia
  // con una tarea, y el dia que la tarea falle el sistema despacharia a quien no debe.
  const abiertas = await db.execute<{ id: string; corte_desde: string; corte_hasta: string; emitida: string }>(sql`
    select id, corte_desde::text, corte_hasta::text,
           (emitted_at at time zone 'America/Bogota')::date::text as emitida
      from distribucion_statements
     where professional_id = ${professionalId} and paid_at is null and replaced_by_id is null
     order by corte_hasta`);
  let enMoraDesde: string | null = null;
  for (const a of abiertas) {
    const p = plazosDelCorte({ desde: a.corte_desde, hasta: a.corte_hasta }, a.emitida);
    if (hoy >= p.moraDesde && (enMoraDesde == null || p.moraDesde < enMoraDesde)) enMoraDesde = p.moraDesde;
  }

  const r = puedeDespacharse({ saldoPendiente, cupo, enMoraDesde });
  return { saldoPendiente, cupo, enMoraDesde, puede: r.puede, motivo: r.motivo, avisoDeCupo: r.avisoDeCupo };
}

/** Lo que una cuenta emitida vale hoy, derivado de sus lineas. Para las dos pantallas. */
export async function totalDeLaCuenta(statementId: string): Promise<number> {
  const lineas = await lineasDeLaCuenta(statementId);
  return lineas.reduce((s, l) => {
    const p = precioDeFacturacionSellado(l.baseSellada, l.descuentoSellado);
    return s + p.total;
  }, 0);
}

/**
 * El estado de credito SOLO SI ESTA EN DISTRIBUCION. null = no aplica (esta en Comision).
 *
 * POR QUE LA MODALIDAD DECIDE SI APLICA: bajo Comision el paciente le paga a CNV, asi que el Integrante no
 * le debe nada y no hay saldo que topar. Suspenderle el despacho por un cupo seria inventarle una deuda.
 */
export async function estadoDeCreditoDeDistribucion(professionalId: string): Promise<EstadoDeCredito | null> {
  const { leerModalidad } = await import("./modalidad-writer");
  const { modalidad } = await leerModalidad(professionalId);
  if (modalidad !== "distribucion") return null;
  const [f] = await db.execute<{ hoy: string }>(
    sql`select (now() at time zone 'America/Bogota')::date::text as hoy`,
  );
  return estadoDeCredito(professionalId, f.hoy);
}

/** El `professional_profiles.id` del usuario. null si no es profesional. */
export async function profesionalDelUsuario(userId: string): Promise<string | null> {
  const [f] = await db.execute<{ id: string }>(sql`
    select id from professional_profiles where profile_id = ${userId}`);
  return f ? f.id : null;
}
