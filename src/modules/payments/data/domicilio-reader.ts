import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { ofertaDeDomicilio, type CiudadHabilitada, type OfertaDeDomicilio } from "../domicilio";

// ═══ LO QUE EL DOMICILIO NECESITA SABER ANTES DE COBRAR (0190) ═══
//
// La tarifa y la cobertura viven en Atlas y no en los documentos contractuales (§5.4), asi que se leen aqui y
// la decision la toma el modulo puro, que tiene candado.

/** La tarifa vigente. null = no se ofrece domicilio. */
export async function tarifaDeFlete(): Promise<number | null> {
  const [f] = await db.execute<{ tarifa: string | null }>(
    sql`select flete_tarifa as tarifa from commercial_config limit 1`,
  );
  return f?.tarifa == null ? null : Number(f.tarifa);
}

export async function ciudadesConCobertura(): Promise<CiudadHabilitada[]> {
  const filas = await db.execute<{ city: string; department: string; dane_code: string | null }>(sql`
    select city, department, dane_code from delivery_cities where is_active order by city`);
  return filas.map((f) => ({ city: f.city, department: f.department, daneCode: f.dane_code }));
}

/** ¿Se ofrece domicilio, y a este destino? Lo resuelve el modulo puro con lo que hay configurado. */
export async function ofertaVigente(destino?: {
  ciudad?: string | null;
  departamento?: string | null;
}): Promise<OfertaDeDomicilio> {
  const [tarifa, ciudades] = await Promise.all([tarifaDeFlete(), ciudadesConCobertura()]);
  return ofertaDeDomicilio({ tarifa, ciudades, ciudad: destino?.ciudad, departamento: destino?.departamento });
}

/** El codigo DANE de una ciudad habilitada, para sellarlo en la venta (el analisis de ICA lo necesita). */
export async function daneDe(ciudad: string, departamento?: string | null): Promise<string | null> {
  const [f] = await db.execute<{ dane_code: string | null }>(sql`
    select dane_code from delivery_cities
     where lower(city) = lower(${ciudad.trim()})
       and (${departamento ?? null}::text is null or lower(department) = lower(${(departamento ?? "").trim()}))
       and is_active
     limit 1`);
  return f?.dane_code ?? null;
}

/** El departamento de una ciudad habilitada, cuando la pantalla no lo manda. */
export async function departamentoDe(ciudad: string): Promise<string | null> {
  const [f] = await db.execute<{ department: string }>(sql`
    select department from delivery_cities where lower(city) = lower(${ciudad.trim()}) and is_active limit 1`);
  return f?.department ?? null;
}
