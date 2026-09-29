import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

// Lo que la pantalla de reconstruccion necesita para armar una venta que ya ocurrio. Todo por Drizzle (no
// por PostgREST): es una pantalla de Direccion sobre datos de OTRO profesional, y aqui el que autoriza es el
// action con su policy, no la RLS de la sesion.

export type ContextoDeVentaRetroactiva = {
  organizationId: string;
  profesionales: { id: string; nombre: string }[];
  /** `profesionales` son los ids a los que esta asignado: la pantalla filtra por el que se elija. */
  pacientes: { id: string; nombre: string; profesionales: string[] }[];
  productos: { id: string; nombre: string }[];
};

export async function leerContextoDeVentaRetroactiva(): Promise<ContextoDeVentaRetroactiva | null> {
  const [org] = await db.execute<{ id: string }>(sql`select id from organizations limit 1`);
  if (!org) return null;

  const profesionales = await db.execute<{ id: string; nombre: string }>(sql`
    select pp.id, coalesce(p.full_name, p.email, '(sin nombre)') as nombre
      from professional_profiles pp
      join profiles p on p.id = pp.profile_id
     order by 2`);

  // LOS PACIENTES, CON SU DOCUMENTO EN EL ROTULO: dos personas pueden llamarse igual, y equivocarse aqui le
  // cuelga a alguien una compra que no hizo.
  // El NOMBRE esta en `patient_profiles` y el DOCUMENTO en `patients`: son dos tablas porque la PII
  // demografica se separo a proposito. Hay que unirlas, no leer las dos cosas de una.
  // CON SUS PROFESIONALES (smoke del 2026-09-29): la lista traia TODOS los pacientes, y elegir en una lista
  // de cientos a alguien que no es del profesional que vendio es como se le cuelga una compra a quien no la
  // hizo. La pantalla filtra por el profesional elegido.
  const pacientes = await db.execute<{ id: string; nombre: string; profesionales: string[] }>(sql`
    select p.id,
           trim(coalesce(pp.first_name, '') || ' ' || coalesce(pp.last_name, '')) || ' · ' || p.document_number as nombre,
           coalesce(array_agg(r.professional_id::text) filter (where r.professional_id is not null), '{}') as profesionales
      from patients p
      join patient_profiles pp on pp.patient_id = p.id
      left join patient_professional_relationships r on r.patient_id = p.id and r.status = 'active'
     group by p.id, pp.first_name, pp.last_name, p.document_number
     order by 2
     limit 2000`);

  const productos = await db.execute<{ id: string; nombre: string }>(sql`
    select id, name as nombre from nutraceuticals
     where coalesce(is_test, false) = false
     order by name`);

  return {
    organizationId: org.id,
    profesionales: profesionales.map((r) => ({ id: r.id, nombre: r.nombre })),
    pacientes: pacientes.map((r) => ({ id: r.id, nombre: r.nombre, profesionales: r.profesionales ?? [] })),
    productos: productos.map((r) => ({ id: r.id, nombre: r.nombre })),
  };
}
