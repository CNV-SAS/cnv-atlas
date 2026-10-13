import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import {
  CuentaNoEmitibleError,
  anularCuentaDistribucion,
  cuentaDelCorte,
  emitirCuenta,
  estadoDeCredito,
  objetarCuenta,
  profesionalDelUsuario,
  registrarPagoDeCuenta,
  resolverObjecion,
  totalDeLaCuenta,
} from "../data/distribucion-writer";
import {
  corteCerrado,
  corteDe,
  plazosDelCorte,
  type Corte,
  type CuentaQuincenal,
} from "../distribucion";

// ═══ EL RECAUDO DE DISTRIBUCION: LO QUE VEN LAS DOS PANTALLAS (0188) ═══
//
// CNV ve a quien le toca facturar y que cuentas siguen sin pagar; el Integrante ve las suyas con su detalle,
// que es lo que le permite objetar. Las cifras salen del mismo sitio en las dos.

export type CuentaEnPantalla = {
  id: string;
  professionalId: string;
  quien: string;
  corteDesde: string;
  corteHasta: string;
  emitidaEl: string;
  total: number;
  /** Los plazos que corren desde la emision (§4). */
  objetarHasta: string;
  pagarHasta: string;
  moraDesde: string;
  objetadaEl: string | null;
  motivoDeObjecion: string | null;
  objecionResueltaEl: string | null;
  desenlaceDeObjecion: string | null;
  pagadaEl: string | null;
  montoPagado: number | null;
  reemplazadaPor: string | null;
};

type FilaCuenta = {
  id: string;
  professional_id: string;
  quien: string | null;
  corte_desde: string;
  corte_hasta: string;
  emitida: string;
  objetada: string | null;
  objection_note: string | null;
  objecion_resuelta: string | null;
  objection_outcome: string | null;
  pagada: string | null;
  paid_amount: string | null;
  replaced_by_id: string | null;
};

const SELECT_CUENTAS = sql`
  select s.id, s.professional_id, pr.full_name as quien,
         s.corte_desde::text, s.corte_hasta::text,
         (s.emitted_at at time zone 'America/Bogota')::date::text as emitida,
         (s.objected_at at time zone 'America/Bogota')::date::text as objetada,
         s.objection_note,
         (s.objection_resolved_at at time zone 'America/Bogota')::date::text as objecion_resuelta,
         s.objection_outcome,
         (s.paid_at at time zone 'America/Bogota')::date::text as pagada,
         s.paid_amount, s.replaced_by_id
    from distribucion_statements s
    join professional_profiles pp on pp.id = s.professional_id
    left join profiles pr on pr.id = pp.profile_id`;

async function aCuenta(f: FilaCuenta): Promise<CuentaEnPantalla> {
  const p = plazosDelCorte({ desde: f.corte_desde, hasta: f.corte_hasta }, f.emitida);
  return {
    id: f.id,
    professionalId: f.professional_id,
    quien: f.quien ?? "Integrante",
    corteDesde: f.corte_desde,
    corteHasta: f.corte_hasta,
    emitidaEl: f.emitida,
    total: await totalDeLaCuenta(f.id),
    objetarHasta: p.objetarHasta,
    pagarHasta: p.pagarHasta,
    moraDesde: p.moraDesde,
    objetadaEl: f.objetada,
    motivoDeObjecion: f.objection_note,
    objecionResueltaEl: f.objecion_resuelta,
    desenlaceDeObjecion: f.objection_outcome,
    pagadaEl: f.pagada,
    montoPagado: f.paid_amount == null ? null : Number(f.paid_amount),
    reemplazadaPor: f.replaced_by_id,
  };
}

/** Las cuentas vivas (no reemplazadas) de todos: lo que CNV tiene por cobrar. */
export async function cuentasParaCnv(): Promise<CuentaEnPantalla[]> {
  const filas = await db.execute<FilaCuenta>(sql`
    ${SELECT_CUENTAS}
     where s.superseded_at is null
     order by s.paid_at nulls first, s.corte_hasta desc
     limit 60`);
  return Promise.all(filas.map(aCuenta));
}

/** Las cuentas del Integrante. Verlas con su detalle es lo que le permite objetar dentro del plazo. */
export async function misCuentas(userId: string): Promise<CuentaEnPantalla[]> {
  const filas = await db.execute<FilaCuenta>(sql`
    ${SELECT_CUENTAS}
     where pp.profile_id = ${userId} and s.superseded_at is null
     order by s.corte_hasta desc
     limit 24`);
  return Promise.all(filas.map(aCuenta));
}

/** El detalle de una cuenta emitida: las ventas que la componen, que el modelo exige poder referenciar. */
export async function detalleDeLaCuenta(statementId: string): Promise<CuentaQuincenal | null> {
  const [f] = await db.execute<{ professional_id: string; corte_hasta: string }>(sql`
    select professional_id, corte_hasta::text from distribucion_statements where id = ${statementId}`);
  if (!f) return null;
  return cuentaDelCorte(f.professional_id, f.corte_hasta, statementId);
}

export type CorteListo = {
  professionalId: string;
  quien: string;
  ventas: number;
  total: number;
  corteDesde: string;
  corteHasta: string;
  /**
   * La cuenta VIVA que ya tiene este corte, si la tiene. Emitir entonces la REEMPLAZA (0215), y la pantalla
   * tiene que decirlo: no es lo mismo facturar un corte que rehacer una factura que el Integrante ya recibio.
   */
  cuentaVigenteId: string | null;
  cuentaVigenteEmitidaEl: string | null;
  /**
   * Y si esa cuenta ya esta PAGADA, estas ventas no se pueden facturar aqui: la pagada no se reemplaza. Se
   * dice y no se ofrece boton, en vez de ofrecerlo y reventar contra la base.
   */
  cuentaVigentePagadaEl: string | null;
};

export type CortesDeDistribucion = {
  /** Cortes CERRADOS con ventas sin facturar: lo que CNV puede emitir hoy. */
  porEmitir: CorteListo[];
  /**
   * EL CORTE EN CURSO, solo para verlo. Va a la pantalla porque la pregunta que deja su ausencia es peor:
   * sin el, admin ve ventas registradas y ningun corte, y no sabe si el sistema las perdio.
   */
  enCurso: CorteListo[];
};

/**
 * A QUIEN HAY QUE FACTURARLE, Y DE QUE CORTE.
 *
 * ── POR QUE SE AGRUPA POR EL CORTE DE CADA VENTA Y NO POR EL DE HOY ──
 *
 * Porque una venta pertenece al corte de SU fecha, no al de la fecha en que alguien abre la pantalla. Leer
 * solo el corte de hoy escondia dos cosas: el corte que acaba de cerrar (el unico que de verdad se puede
 * facturar) y cualquier corte viejo que nadie emitio. Una venta que no aparece en ninguna parte es una
 * venta que no se le va a cobrar a nadie.
 *
 * LA AGRUPACION LA HACE `corteDe`, el modulo puro, y no un `case` en SQL: el calendario del modelo tiene
 * una sola implementacion con candado, y dos seria como se descuadra una factura entera.
 *
 * Sin ventas no aparece nadie, que es lo que el modelo pide ("si no hubo ventas, no se emite factura").
 */
export async function cortesDeDistribucion(hoy: string): Promise<CortesDeDistribucion> {
  const filas = await db.execute<{ professional_id: string; quien: string | null; dia: string }>(sql`
    select distinct t.professional_id, pr.full_name as quien,
           (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date::text as dia
      from transaction_items ti
      join transactions t on t.id = ti.transaction_id
      join professional_profiles pp on pp.id = t.professional_id
      left join profiles pr on pr.id = pp.profile_id
     where ti.modality = 'distribucion'
       and ti.sealed_at is not null
       and t.distribucion_statement_id is null`);

  // Un grupo por (Integrante, corte). El dia que lo representa es el `hasta` del corte, que es el que
  // `cuentaDelCorte` necesita para derivar el mismo periodo.
  const grupos = new Map<string, { professionalId: string; quien: string; corte: Corte }>();
  for (const f of filas) {
    const corte = corteDe(f.dia);
    const clave = `${f.professional_id}|${corte.hasta}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        professionalId: f.professional_id,
        quien: f.quien ?? "Integrante",
        corte,
      });
    }
  }

  const porEmitir: CorteListo[] = [];
  const enCurso: CorteListo[] = [];
  for (const g of grupos.values()) {
    const c = await cuentaDelCorte(g.professionalId, g.corte.hasta);
    if (c.ventas === 0) continue;
    const [viva] = await db.execute<{ id: string; emitida: string; pagada: string | null }>(sql`
      select id, (emitted_at at time zone 'America/Bogota')::date::text as emitida,
             (paid_at at time zone 'America/Bogota')::date::text as pagada
        from distribucion_statements
       where professional_id = ${g.professionalId}
         and corte_hasta = ${g.corte.hasta}::date
         and superseded_at is null`);
    const fila: CorteListo = {
      professionalId: g.professionalId,
      quien: g.quien,
      ventas: c.ventas,
      total: c.total,
      corteDesde: c.corte.desde,
      corteHasta: c.corte.hasta,
      cuentaVigenteId: viva?.id ?? null,
      cuentaVigenteEmitidaEl: viva?.emitida ?? null,
      cuentaVigentePagadaEl: viva?.pagada ?? null,
    };
    (corteCerrado(g.corte, hoy) ? porEmitir : enCurso).push(fila);
  }
  porEmitir.sort((a, b) => a.corteHasta.localeCompare(b.corteHasta) || a.quien.localeCompare(b.quien));
  enCurso.sort((a, b) => a.quien.localeCompare(b.quien));
  return { porEmitir, enCurso };
}

export {
  CuentaNoEmitibleError,
  anularCuentaDistribucion,
  emitirCuenta,
  estadoDeCredito,
  objetarCuenta,
  profesionalDelUsuario,
  registrarPagoDeCuenta,
  resolverObjecion,
};
