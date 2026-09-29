import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import {
  CuentaNoEmitibleError,
  cuentaDelCorte,
  emitirCuenta,
  estadoDeCredito,
  objetarCuenta,
  profesionalDelUsuario,
  registrarPagoDeCuenta,
  resolverObjecion,
  totalDeLaCuenta,
} from "../data/distribucion-writer";
import { corteDe, plazosDelCorte, type CuentaQuincenal } from "../distribucion";

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
     where s.replaced_by_id is null
     order by s.paid_at nulls first, s.corte_hasta desc
     limit 60`);
  return Promise.all(filas.map(aCuenta));
}

/** Las cuentas del Integrante. Verlas con su detalle es lo que le permite objetar dentro del plazo. */
export async function misCuentas(userId: string): Promise<CuentaEnPantalla[]> {
  const filas = await db.execute<FilaCuenta>(sql`
    ${SELECT_CUENTAS}
     where pp.profile_id = ${userId} and s.replaced_by_id is null
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
};

/**
 * A QUIEN HAY QUE FACTURARLE: Integrantes en Distribucion con ventas selladas y sin facturar en el corte que
 * acaba de cerrar. Sin ventas no aparece nadie, que es lo que el modelo pide ("si no hubo ventas, no se
 * emite factura").
 */
export async function cortesPorEmitir(hoy: string): Promise<CorteListo[]> {
  const corte = corteDe(hoy);
  const filas = await db.execute<{ professional_id: string; quien: string | null }>(sql`
    select distinct t.professional_id, pr.full_name as quien
      from transaction_items ti
      join transactions t on t.id = ti.transaction_id
      join professional_profiles pp on pp.id = t.professional_id
      left join profiles pr on pr.id = pp.profile_id
     where ti.modality = 'distribucion'
       and ti.sealed_at is not null
       and t.distribucion_statement_id is null
       and (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date
             between ${corte.desde}::date and ${corte.hasta}::date`);
  const out: CorteListo[] = [];
  for (const f of filas) {
    const c = await cuentaDelCorte(f.professional_id, hoy);
    if (c.ventas === 0) continue;
    out.push({
      professionalId: f.professional_id,
      quien: f.quien ?? "Integrante",
      ventas: c.ventas,
      total: c.total,
      corteDesde: c.corte.desde,
      corteHasta: c.corte.hasta,
    });
  }
  return out;
}

export {
  CuentaNoEmitibleError,
  emitirCuenta,
  estadoDeCredito,
  objetarCuenta,
  profesionalDelUsuario,
  registrarPagoDeCuenta,
  resolverObjecion,
};
