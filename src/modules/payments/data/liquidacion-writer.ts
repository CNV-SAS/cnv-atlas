import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { recordAudit } from "@/modules/audit/log";

import { liquidarComision, type PerfilTributario } from "../liquidacion";

// ═══ LIQUIDAR LA COMISION DE UN INTEGRANTE (Bloque 4) ═══
//
// LA REGLA QUE JUSTIFICA EL BLOQUE ENTERO: una comision causada se paga UNA VEZ. Por eso la liquidacion no
// recalcula nada (la comision de cada venta ya quedo sellada con la tasa de su dia): AGRUPA las filas
// causadas que todavia no tienen liquidacion y las marca. Lo que impide pagar dos veces no es una pantalla,
// es que la fila ya tenga dueño.
//
// Y POR ESO LAS REVERSIONES CUADRAN SOLAS (D-3b-2, "la comision ya liquidada se descuenta en la liquidacion
// siguiente"): la fila negativa nace sin liquidar, asi que entra en la proxima y netea. Si el neteo deja el
// periodo en negativo, el neto es negativo y arrastra: es una deuda, no un giro.

export class LiquidacionError extends Error {}

export type ResumenParaLiquidar = {
  professionalId: string;
  nombre: string;
  /** Lo causado sin liquidar hasta la fecha, ya neteado con las reversiones. */
  base: number;
  filas: number;
  /** Lo ya pagado en el año calendario de la fecha de corte: decide la tarifa de retencion. */
  acumuladoPrevio: number;
  perfil: PerfilTributario;
};

/** Lo que cada Integrante tiene pendiente hasta una fecha (inclusive), en hora de Colombia. */
export async function listarPendientesDeLiquidar(hasta: string): Promise<ResumenParaLiquidar[]> {
  const filas = await db.execute<{
    professional_id: string;
    nombre: string;
    base: string;
    filas: number;
    acumulado: string;
    tax_person_type: string | null;
    tax_is_vat_responsible: boolean | null;
    tax_must_invoice: boolean | null;
  }>(sql`
    select pp.id as professional_id,
           coalesce(p.full_name, p.email, '(sin nombre)') as nombre,
           coalesce(sum(r.commission_amount) filter (where r.settlement_id is null), 0)::text as base,
           count(r.id) filter (where r.settlement_id is null)::int as filas,
           -- EL ACUMULADO DEL AÑO son las liquidaciones ya PAGADAS de ese mismo año calendario: es lo que la
           -- DIAN cuenta para la tarifa, y se reinicia el 1 de enero.
           coalesce((select sum(s.base_amount) from commission_settlements s
                      where s.professional_id = pp.id and s.paid_at is not null
                        and extract(year from s.period_to) = extract(year from ${hasta}::date)), 0)::text as acumulado,
           pp.tax_person_type, pp.tax_is_vat_responsible, pp.tax_must_invoice
      from professional_profiles pp
      join profiles p on p.id = pp.profile_id
      left join professional_revenue r on r.professional_id = pp.id
       and (r.created_at at time zone 'America/Bogota')::date <= ${hasta}::date
     group by pp.id, p.full_name, p.email, pp.tax_person_type, pp.tax_is_vat_responsible, pp.tax_must_invoice
    having count(r.id) filter (where r.settlement_id is null) > 0
     order by 2`);

  return filas.map((f) => ({
    professionalId: f.professional_id,
    nombre: f.nombre,
    base: Number(f.base),
    filas: Number(f.filas),
    acumuladoPrevio: Number(f.acumulado),
    perfil: {
      tipoDePersona:
        f.tax_person_type === "natural" || f.tax_person_type === "juridica" ? f.tax_person_type : null,
      responsableDeIva: f.tax_is_vat_responsible,
      obligadoAFacturar: f.tax_must_invoice,
    },
  }));
}

/**
 * Crea la liquidacion de un Integrante hasta una fecha. NO gira dinero: deja la cuenta hecha y las filas
 * marcadas. El pago se registra despues, con su referencia (`registrarPagoDeLiquidacion`).
 */
export async function liquidarHasta(input: {
  professionalId: string;
  hasta: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<{ id: string; neto: number }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.hasta)) {
    throw new LiquidacionError("La fecha de corte tiene que ser un día (aaaa-mm-dd).");
  }
  return db.transaction(async (tx) => {
    // SE BLOQUEAN LAS FILAS QUE VAN A ENTRAR. Dos liquidaciones a la vez sobre el mismo Integrante podrian
    // llevarse las mismas comisiones; con el bloqueo, la segunda espera y ya no las ve pendientes.
    const pendientes = await tx.execute<{ id: string; monto: string }>(sql`
      select id, commission_amount::text as monto from professional_revenue
       where professional_id = ${input.professionalId}
         and settlement_id is null
         and (created_at at time zone 'America/Bogota')::date <= ${input.hasta}::date
       for update`);
    if (pendientes.length === 0) {
      throw new LiquidacionError("Ese integrante no tiene comisiones pendientes hasta esa fecha.");
    }

    const [perfilFila] = await tx.execute<{
      tax_person_type: string | null;
      tax_is_vat_responsible: boolean | null;
      tax_must_invoice: boolean | null;
    }>(sql`
      select tax_person_type, tax_is_vat_responsible, tax_must_invoice
        from professional_profiles where id = ${input.professionalId}`);
    if (!perfilFila) throw new LiquidacionError("Ese integrante no existe.");

    const perfil: PerfilTributario = {
      tipoDePersona:
        perfilFila.tax_person_type === "natural" || perfilFila.tax_person_type === "juridica"
          ? perfilFila.tax_person_type
          : null,
      responsableDeIva: perfilFila.tax_is_vat_responsible,
      obligadoAFacturar: perfilFila.tax_must_invoice,
    };

    const [acum] = await tx.execute<{ total: string }>(sql`
      select coalesce(sum(base_amount), 0)::text as total from commission_settlements
       where professional_id = ${input.professionalId} and paid_at is not null
         and extract(year from period_to) = extract(year from ${input.hasta}::date)`);

    const base = pendientes.reduce((s, f) => s + Number(f.monto), 0);
    const cuenta = liquidarComision({ base, perfil, acumuladoPrevio: Number(acum?.total ?? 0) });

    // SIN LOS DATOS TRIBUTARIOS NO SE LIQUIDA. Asumirlos es girar de menos o de mas, y las dos se arreglan
    // con plata de por medio; el mensaje dice exactamente cual falta para que alguien lo complete.
    if (cuenta.faltantes.length > 0) {
      throw new LiquidacionError(
        `Faltan datos tributarios de este integrante para poder liquidarle: ${cuenta.faltantes.join(", ")}. Se completan en su perfil.`,
      );
    }

    const [liquidacion] = await tx.execute<{ id: string }>(sql`
      insert into commission_settlements
        (professional_id, period_to, base_amount, vat_amount, withholding_rate, withholding_amount,
         net_amount, accumulated_year, document_kind, tax_person_type, tax_vat_responsible, tax_must_invoice,
         created_by)
      values (${input.professionalId}, ${input.hasta}::date, ${cuenta.base}, ${cuenta.iva},
              ${cuenta.tarifaDeRetencion}, ${cuenta.retencion}, ${cuenta.neto}, ${cuenta.acumuladoDelAno},
              ${cuenta.documento}, ${perfil.tipoDePersona}, ${perfil.responsableDeIva},
              ${perfil.obligadoAFacturar}, ${input.actorId})
      returning id`);

    await tx.execute(sql`
      update professional_revenue set settlement_id = ${liquidacion.id}
       where id in (${sql.join(pendientes.map((f) => sql`${f.id}`), sql`, `)})`);

    await recordAudit(tx, {
      event: "comision.liquidada",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "professional_profile",
      entityId: input.professionalId,
      payload: {
        liquidacion: liquidacion.id,
        hasta: input.hasta,
        comisiones: pendientes.length,
        base: cuenta.base,
        retencion: cuenta.retencion,
        neto: cuenta.neto,
        tarifa: cuenta.tarifaDeRetencion,
      },
      ip: input.ip,
    });

    return { id: liquidacion.id, neto: cuenta.neto };
  });
}

/** Registra que la liquidacion ya se giro. Una vez registrado, no se cambia (trigger de la 0171). */
export async function registrarPagoDeLiquidacion(input: {
  settlementId: string;
  referencia: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<void> {
  const referencia = input.referencia.trim();
  if (referencia.length < 3) {
    throw new LiquidacionError("Escribe la referencia del giro: sin ella no se puede cotejar con el banco.");
  }
  await db.transaction(async (tx) => {
    const filas = await tx.execute<{ id: string; neto: string }>(sql`
      update commission_settlements
         set paid_at = now(), payment_reference = ${referencia}
       where id = ${input.settlementId} and paid_at is null
      returning id, net_amount::text as neto`);
    if (filas.length === 0) {
      throw new LiquidacionError("Esa liquidación no existe o ya tiene el pago registrado.");
    }
    await recordAudit(tx, {
      event: "comision.liquidacion_pagada",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "commission_settlement",
      entityId: input.settlementId,
      payload: { referencia, neto: Number(filas[0].neto) },
      ip: input.ip,
    });
  });
}

export type LiquidacionListada = {
  id: string;
  profesional: string;
  hasta: string;
  base: number;
  iva: number;
  retencion: number;
  tarifa: number;
  neto: number;
  documento: string;
  pagadaEn: string | null;
  referencia: string | null;
};

/** Las liquidaciones, para la pantalla. Con `professionalId`, solo las de esa persona. */
export async function listarLiquidaciones(professionalId?: string): Promise<LiquidacionListada[]> {
  const filas = await db.execute<{
    id: string;
    profesional: string;
    hasta: string;
    base: string;
    iva: string;
    retencion: string;
    tarifa: string;
    neto: string;
    documento: string;
    pagada: string | null;
    referencia: string | null;
  }>(sql`
    select s.id, coalesce(p.full_name, p.email, '(sin nombre)') as profesional,
           s.period_to::text as hasta, s.base_amount::text as base, s.vat_amount::text as iva,
           s.withholding_amount::text as retencion, s.withholding_rate::text as tarifa,
           s.net_amount::text as neto, s.document_kind as documento,
           s.paid_at::text as pagada, s.payment_reference as referencia
      from commission_settlements s
      join professional_profiles pp on pp.id = s.professional_id
      join profiles p on p.id = pp.profile_id
     where ${professionalId ? sql`s.professional_id = ${professionalId}` : sql`true`}
     order by s.created_at desc
     limit 200`);
  return filas.map((f) => ({
    id: f.id,
    profesional: f.profesional,
    hasta: f.hasta,
    base: Number(f.base),
    iva: Number(f.iva),
    retencion: Number(f.retencion),
    tarifa: Number(f.tarifa),
    neto: Number(f.neto),
    documento: f.documento,
    pagadaEn: f.pagada,
    referencia: f.referencia,
  }));
}

/**
 * El dia de HOY en hora de Colombia, segun la BASE.
 *
 * Lo decide la base y no el proceso a proposito: el servidor de Vercel corre en UTC, y a las 19:00 de
 * Bogota alla ya es el dia siguiente. Un corte de liquidacion calculado con el reloj del proceso dejaria
 * fuera (o dentro) las comisiones de las ultimas cinco horas segun a que hora se pulse el boton.
 */
export async function hoyEnBogota(): Promise<string> {
  const [f] = await db.execute<{ dia: string }>(
    sql`select (now() at time zone 'America/Bogota')::date::text as dia`,
  );
  return f.dia;
}

/**
 * Descarta una liquidacion TODAVIA NO GIRADA: sus comisiones vuelven a quedar pendientes.
 *
 * EXISTE PORQUE UNA LIQUIDACION MAL HECHA RETIENE COMISIONES. Mientras viva, sus filas tienen dueño y no
 * entran en la siguiente, asi que un calculo equivocado no es solo un numero feo: deja a alguien sin cobrar
 * hasta que se resuelva. Una ya PAGADA no se descarta (el trigger de la 0171 lo impide): ahi el dinero salio
 * y lo que corresponde es la liquidacion siguiente, no borrar la constancia.
 */
export async function descartarLiquidacion(input: {
  settlementId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [liq] = await tx.execute<{ id: string; pagada: string | null; neto: string }>(sql`
      select id, paid_at::text as pagada, net_amount::text as neto
        from commission_settlements where id = ${input.settlementId}`);
    if (!liq) throw new LiquidacionError("Esa liquidación no existe.");
    if (liq.pagada) {
      throw new LiquidacionError(
        "Esa liquidación ya se giró, así que no se descarta: el dinero salió. Lo que corresponde es ajustarlo en la siguiente.",
      );
    }
    await recordAudit(tx, {
      event: "comision.liquidacion_descartada",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "commission_settlement",
      entityId: liq.id,
      payload: { neto: Number(liq.neto) },
      ip: input.ip,
    });
    // Las comisiones vuelven a quedar libres por el ON DELETE SET NULL de la 0171: no hay que soltarlas a
    // mano, y por eso no puede quedar ninguna atada a una liquidacion que ya no existe.
    await tx.execute(sql`delete from commission_settlements where id = ${liq.id}`);
  });
}
