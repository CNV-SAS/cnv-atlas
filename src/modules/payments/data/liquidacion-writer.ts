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
  /**
   * Lo causado sin liquidar hasta la fecha, ya neteado con las reversiones, Y SIN LO DE PRUEBA (2026-10-09).
   *
   * Es la cifra que se gira, asi que no puede incluir comisiones de ventas que no son ingreso de CNV: el sello
   * contable crea la comision en toda venta de modalidad comision, sin filtro de prueba, mientras la 0203
   * mantiene esa venta fuera del ingreso. Sin esta separacion se giraba dinero real por una venta que no
   * cuenta.
   */
  base: number;
  /** Y lo que NO se gira, aparte: comisiones de ventas a pacientes de prueba. Se muestra, no se esconde. */
  baseDePrueba: number;
  filas: number;
  filasDePrueba: number;
  /** Filas NEGATIVAS pendientes (devoluciones y disputas perdidas). No son comisiones. */
  reversiones: number;
  /** Lo ya pagado en el año calendario de la fecha de corte: decide la tarifa de retencion. */
  acumuladoPrevio: number;
  /**
   * Si es una cuenta de DEMOSTRACION. Se muestra marcada y SIN boton de liquidar: ocultarla esconderia que
   * hay comisiones colgando, y mostrarla igual invitaria a girar plata de una venta que no existio.
   */
  esDePrueba: boolean;
  perfil: PerfilTributario;
};

/** Lo que cada Integrante tiene pendiente hasta una fecha (inclusive), en hora de Colombia. */
export async function listarPendientesDeLiquidar(hasta: string): Promise<ResumenParaLiquidar[]> {
  const filas = await db.execute<{
    professional_id: string;
    nombre: string;
    base: string;
    base_de_prueba: string;
    filas: number;
    filas_de_prueba: number;
    reversiones: number;
    acumulado: string;
    tax_person_type: string | null;
    tax_is_vat_responsible: boolean | null;
    tax_must_invoice: boolean | null;
    es_de_prueba: boolean;
  }>(sql`
    select pp.id as professional_id,
           coalesce(p.full_name, p.email, '(sin nombre)') as nombre,
           -- ═══ LA BASE SE PARTE EN DOS: LO REAL Y LO DE PRUEBA (Santiago, 2026-10-09) ═══
           --
           -- SU CRITERIO, QUE ES EL QUE MANDA: *"hoy alguien que entre a /comercial ve que hay pendiente por
           -- girarle X a un profesional que NO esta marcado de prueba, y se los gira pensando que son ventas
           -- reales, cuando esas ventas se las hizo a un paciente con el que estaba haciendo pruebas. Eso NO
           -- puede pasar."*
           --
           -- EL SELLO CONTABLE CREA LA COMISION EN TODA VENTA de modalidad comision, sin filtro de prueba. Y la
           -- 0203 mantiene esa venta FUERA del ingreso de CNV. Asi que hoy CNV no cuenta la venta como ingreso
           -- y si debe su comision: se giraria dinero real por una venta que no es ingreso.
           --
           -- POR QUE SE SEPARA Y NO SE FILTRA, que era la salida facil: es la MISMA razon que Santiago dio el
           -- 2026-10-01 para la marca del PROFESIONAL ("ocultar la cuenta de demostracion esconde que hay
           -- 51.042 colgando en el sistema"). Filtrar aqui haria desaparecer 15 comisiones ya selladas sin que
           -- nadie sepa que existieron. Se muestran, rotuladas, y el giro no las alcanza.
           --
           -- Y LA MARCA ES LA DERIVADA DE LA VENTA (0203), no la del paciente leida aparte: es una sola
           -- respuesta guardada que ya cuenta las tres marcas (paciente, profesional y producto). Mirar
           -- la marca del paciente leida aqui seria una segunda definicion capaz de discrepar de las cifras.
           coalesce(sum(r.commission_amount) filter (
             where r.settlement_id is null and coalesce(t.cuenta_como_de_prueba, false) = false
           ), 0)::text as base,
           coalesce(sum(r.commission_amount) filter (
             where r.settlement_id is null and coalesce(t.cuenta_como_de_prueba, false) = true
           ), 0)::text as base_de_prueba,
           -- SE CUENTAN LAS COMISIONES, NO LAS FILAS (smoke del 2026-09-29): una reversion es OTRA fila,
           -- negativa, apuntando a la original. Contandolas todas, una venta con su devolucion decia "2
           -- comisiones", y tres asi decian "$0 en 6 comisiones", que no significa nada.
           -- LA CUENTA VA CON LA CIFRA (leccion del "7 pagos / 428.400" del 2026-10-07): si la base excluye lo
           -- de prueba y el conteo no, la linea dice "15 comisiones" al lado de un importe que vale 12, y eso
           -- se lee como un descuadre aunque las dos cifras esten bien.
           count(r.id) filter (
             where r.settlement_id is null and r.reversal_of is null
               and coalesce(t.cuenta_como_de_prueba, false) = false
           )::int as filas,
           count(r.id) filter (
             where r.settlement_id is null and r.reversal_of is not null
               and coalesce(t.cuenta_como_de_prueba, false) = false
           )::int as reversiones,
           count(r.id) filter (
             where r.settlement_id is null and r.reversal_of is null
               and coalesce(t.cuenta_como_de_prueba, false) = true
           )::int as filas_de_prueba,
           -- EL ACUMULADO DEL AÑO son las liquidaciones ya PAGADAS de ese mismo año calendario: es lo que la
           -- DIAN cuenta para la tarifa, y se reinicia el 1 de enero.
           coalesce((select sum(s.base_amount) from commission_settlements s
                      where s.professional_id = pp.id and s.paid_at is not null
                        and extract(year from s.period_to) = extract(year from ${hasta}::date)), 0)::text as acumulado,
           pp.tax_person_type, pp.tax_is_vat_responsible, pp.tax_must_invoice,
           -- SE TRAE LA MARCA EN VEZ DE FILTRARLA (Santiago, 2026-10-01). Esta es la pantalla donde alguien
           -- GIRA DE VERDAD, asi que las dos salidas faciles estan mal: ocultar la cuenta de demostracion
           -- esconde que hay 51.042 colgando en el sistema, y mostrarla igual que las demas invita a
           -- girarlos. Se muestra MARCADA y sin boton: se ve que existe y no se puede pagar.
           coalesce(pp.is_test, false) as es_de_prueba
      from professional_profiles pp
      join profiles p on p.id = pp.profile_id
      left join professional_revenue r on r.professional_id = pp.id
       and (r.created_at at time zone 'America/Bogota')::date <= ${hasta}::date
      -- LA VENTA DE CADA COMISION, solo por su marca derivada. Es left join y no inner: una comision sin
      -- venta (no deberia existir) no puede desaparecer de la cuenta en silencio, se cuenta como real.
      left join transactions t on t.id = r.transaction_id
     group by pp.id, p.full_name, p.email, pp.tax_person_type, pp.tax_is_vat_responsible, pp.tax_must_invoice
    having count(r.id) filter (where r.settlement_id is null) > 0
     order by 2`);

  return filas.map((f) => ({
    professionalId: f.professional_id,
    nombre: f.nombre,
    base: Number(f.base),
    baseDePrueba: Number(f.base_de_prueba),
    filasDePrueba: Number(f.filas_de_prueba),
    filas: Number(f.filas),
    reversiones: Number(f.reversiones),
    acumuladoPrevio: Number(f.acumulado),
    esDePrueba: Boolean(f.es_de_prueba),
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

    // ═══ LOS CARGOS POR FALTANTE, CON EL MISMO BLOQUEO (2026-09-28) ═══
    //
    // EL HUECO QUE ESTO CIERRA: un faltante injustificado materializaba su cargo y NADIE LO COBRABA; esa columna
    // solo se leia para mostrarla. La Clausula 5.5 dice que entra en la liquidacion del periodo.
    //
    // SE BLOQUEAN IGUAL, y con mas razon que las comisiones: cobrar dos veces el mismo frasco es cobrarle a una
    // persona una deuda que ya pago.
    const cargos = await tx.execute<{ id: string; monto: string }>(sql`
      -- SE COBRA sealed_charge, NO sealed_total (0191): el total es el valor de VENTA de lo faltante y el
      -- cargo es la INDEMNIZACION (base sin IVA menos el descuento del Integrante). Cobrar el total seria
      -- cobrar un IVA que no se causo y un margen que nadie gano.
      select id, coalesce(sealed_charge, sealed_total)::text as monto from nutraceutical_faltante_cases
       where professional_id = ${input.professionalId}::uuid
         and settlement_id is null
         and charge_status <> 'sin_cargo'
         and (reported_at at time zone 'America/Bogota')::date <= ${input.hasta}::date
       for update`);

    // SE LIQUIDA SI HAY COMISIONES **O** CARGOS. Antes exigia comisiones, y eso dejaba sin cobrar el cargo de
    // quien no vendio nada ese periodo, que es justo el caso que el modelo llama normal ("un faltante puede
    // superar la comision de quien vende poco"). Negarse a liquidar ahi seria no cobrar nunca ese frasco.
    if (pendientes.length === 0 && cargos.length === 0) {
      throw new LiquidacionError(
        "Ese integrante no tiene comisiones ni cargos por faltante pendientes hasta esa fecha.",
      );
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
    const cargosDeFaltante = cargos.reduce((s, f) => s + Number(f.monto), 0);
    const cuenta = liquidarComision({
      base,
      perfil,
      acumuladoPrevio: Number(acum?.total ?? 0),
      cargosDeFaltante,
    });

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

    if (pendientes.length > 0) {
      await tx.execute(sql`
        update professional_revenue set settlement_id = ${liquidacion.id}
         where id in (${sql.join(pendientes.map((f) => sql`${f.id}`), sql`, `)})`);
    }
    // LOS CARGOS SE MARCAN EN LA MISMA TRANSACCION. Si esto quedara fuera, un cargo se descontaria del neto y
    // seguiria pendiente: se cobraria otra vez en la liquidacion siguiente.
    if (cargos.length > 0) {
      await tx.execute(sql`
        update nutraceutical_faltante_cases set settlement_id = ${liquidacion.id}::uuid
         where id in (${sql.join(cargos.map((f) => sql`${f.id}::uuid`), sql`, `)})`);
    }

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
        // LOS CARGOS VAN AL AUDIT, con su cuenta y su numero: es plata que se le descuenta a una persona, y el
        // registro tiene que poder explicar de donde salio un neto mas bajo sin reconstruirlo a mano.
        cargosDeFaltante: cuenta.cargosDeFaltante,
        faltantesCobrados: cargos.length,
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
  /** Los cargos por faltante que se llevo esta liquidacion. Se suman de los casos ligados, no hay columna. */
  cargosDeFaltante: number;
  faltantesCobrados: number;
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
    cargos: string;
    faltantes_cobrados: number;
  }>(sql`
    select s.id, coalesce(p.full_name, p.email, '(sin nombre)') as profesional,
           s.period_to::text as hasta, s.base_amount::text as base, s.vat_amount::text as iva,
           s.withholding_amount::text as retencion, s.withholding_rate::text as tarifa,
           s.net_amount::text as neto, s.document_kind as documento,
           s.paid_at::text as pagada, s.payment_reference as referencia,
           -- LOS CARGOS POR FALTANTE de esta liquidacion, sumados de los casos que se llevo. No hay columna a
           -- proposito: seria un segundo numero capaz de contradecir a los casos, y el neto ya esta guardado.
           coalesce((select sum(coalesce(f.sealed_charge, f.sealed_total)) from nutraceutical_faltante_cases f
                      where f.settlement_id = s.id), 0)::text as cargos,
           coalesce((select count(*) from nutraceutical_faltante_cases f
                      where f.settlement_id = s.id), 0)::int as faltantes_cobrados
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
    cargosDeFaltante: Number(f.cargos),
    faltantesCobrados: Number(f.faltantes_cobrados),
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
