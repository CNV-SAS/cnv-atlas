import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

// Lo que la pantalla de reconstruccion necesita para armar una venta que ya ocurrio. Todo por Drizzle (no
// por PostgREST): es una pantalla de Direccion sobre datos de OTRO profesional, y aqui el que autoriza es el
// action con su policy, no la RLS de la sesion.

export type ContextoDeVentaRetroactiva = {
  organizationId: string;
  profesionales: { id: string; nombre: string }[];
  pacientes: { id: string; nombre: string }[];
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
  const pacientes = await db.execute<{ id: string; nombre: string }>(sql`
    select id,
           trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) || ' · ' || coalesce(document_number, 's/d') as nombre
      from patients
     order by 2
     limit 2000`);

  const productos = await db.execute<{ id: string; nombre: string }>(sql`
    select id, name as nombre from nutraceuticals
     where coalesce(is_test, false) = false
     order by name`);

  return {
    organizationId: org.id,
    profesionales: profesionales.map((r) => ({ id: r.id, nombre: r.nombre })),
    pacientes: pacientes.map((r) => ({ id: r.id, nombre: r.nombre })),
    productos: productos.map((r) => ({ id: r.id, nombre: r.nombre })),
  };
}
