import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

// ═══ VER LA OPERACION DE UN INTEGRANTE DESDE ADMIN (Santiago, 2026-09-25) ═══
//
// LA NECESIDAD SALIO DEL SMOKE ACUMULADO: "no hay forma de mirarlo desde admin: inventario actual, ventas,
// pacientes. Sin eso no se puede verificar nada." Todo lo del integrante se veia SOLO desde su propia sesion
// (/mi-inventario lee lo suyo), asi que comprobar "devolvi una unidad, ¿le bajo el inventario?" obligaba a
// entrar con su cuenta.
//
// LEE CON LA CONEXION DE SISTEMA, NO BAJO RLS, y es a proposito: la RLS del inventario acota al DUEÑO, que es
// justo lo que esta pantalla necesita saltarse. Lo que autoriza aqui es la policy del lado del server
// (`canAccessAdmin`), no la sesion del profesional.
//
// NO ES UNA PANTALLA DE ACCION: no mueve nada ni corrige nada. Si algo esta mal, se arregla por el camino que
// ya existe (una devolucion, un conteo, una remesa). Aqui solo se mira.

export type DetalleDelIntegrante = {
  nombre: string;
  correo: string;
  profesion: string;
  inventario: { producto: string; lote: string; ubicacion: string; vendible: boolean; cantidad: number }[];
  ventas: {
    id: string;
    fecha: string;
    total: number;
    estado: string;
    medio: string;
    inventario: string | null;
    productos: string | null;
  }[];
  comision: { causada: number; liquidada: number; pendiente: number };
  faltantesAbiertos: { producto: string; unidades: number; estado: string; reportado: string }[];
  pacientes: number;
};

export async function leerIntegrante(professionalId: string): Promise<DetalleDelIntegrante | null> {
  const quienes = await db.execute<{ nombre: string; correo: string; profesion: string }>(sql`
    select p.full_name as nombre, p.email as correo, pp.profession::text as profesion
      from professional_profiles pp
      join profiles p on p.id = pp.profile_id
     where pp.id = ${professionalId}::uuid`);
  const quien = quienes[0];
  if (!quien) return null;

  // EL INVENTARIO POR PRODUCTO, LOTE Y UBICACION, que es como se cuenta en la vitrina. Agregado por producto
  // esconde justo lo que hay que mirar cuando algo no cuadra: de que lote salio o entro una unidad, y si lo
  // que quedo esta en la vitrina o en la cuarentena de devoluciones (que no es vendible).
  const inventario = await db.execute<{
    producto: string;
    lote: string;
    ubicacion: string;
    vendible: boolean;
    cantidad: number;
  }>(sql`
    select n.name as producto, l.code as lote, loc.name as ubicacion, loc.sellable as vendible,
           i.stock_quantity as cantidad
      from nutraceutical_inventory i
      join nutraceuticals n on n.id = i.nutraceutical_id
      join lots l on l.id = i.lot_id
      join inventory_locations loc on loc.id = i.location_id
     where i.professional_id = ${professionalId}::uuid and i.stock_quantity <> 0
     order by n.name, l.code`);

  const ventas = await db.execute<{
    id: string;
    fecha: string;
    total: string;
    estado: string;
    medio: string;
    inventario: string | null;
    productos: string | null;
  }>(sql`
    select t.id, t.created_at::text as fecha, t.amount::text as total, t.status::text as estado,
           t.payment_method::text as medio, t.stock_state as inventario,
           (select string_agg(n.name || ' x' || ti.quantity, ', ' order by n.name)
              from transaction_items ti
              join nutraceuticals n on n.id = ti.nutraceutical_id
             where ti.transaction_id = t.id) as productos
      from transactions t
     where t.professional_id = ${professionalId}::uuid
     order by t.created_at desc
     limit 30`);

  // CAUSADA, LIQUIDADA Y PENDIENTE de una sola consulta: las tres salen de las mismas filas y separarlas
  // abriria la puerta a que no sumen. Las reversiones son filas negativas, asi que restan solas.
  const comisiones = await db.execute<{ causada: string; liquidada: string; pendiente: string }>(sql`
    select coalesce(sum(commission_amount), 0)::text as causada,
           coalesce(sum(commission_amount) filter (where settlement_id is not null), 0)::text as liquidada,
           coalesce(sum(commission_amount) filter (where settlement_id is null), 0)::text as pendiente
      from professional_revenue
     where professional_id = ${professionalId}::uuid`);

  // ABIERTOS = los que todavia esperan algo de alguien. Un justificado o un injustificado ya confirmado
  // estan cerrados (el segundo con su cargo), y mostrarlos aqui haria ruido sobre lo que hay que atender.
  const faltantes = await db.execute<{
    producto: string;
    unidades: number;
    estado: string;
    reportado: string;
  }>(sql`
    select n.name as producto, f.quantity as unidades, f.status::text as estado,
           f.reported_at::text as reportado
      from nutraceutical_faltante_cases f
      join nutraceuticals n on n.id = f.nutraceutical_id
     where f.professional_id = ${professionalId}::uuid
       and f.status in ('reportado', 'en_revision', 'injustificado_pendiente')
     order by f.reported_at desc
     limit 20`);

  const pacientes = await db.execute<{ n: number }>(sql`
    select count(*)::int as n
      from patient_professional_relationships
     where professional_id = ${professionalId}::uuid and status = 'active'`);

  return {
    nombre: quien.nombre,
    correo: quien.correo,
    profesion: quien.profesion,
    inventario: inventario.map((f) => ({
      producto: f.producto,
      lote: f.lote,
      ubicacion: f.ubicacion,
      vendible: f.vendible,
      cantidad: Number(f.cantidad),
    })),
    ventas: ventas.map((f) => ({
      id: f.id,
      fecha: f.fecha,
      total: Number(f.total),
      estado: f.estado,
      medio: f.medio,
      inventario: f.inventario,
      productos: f.productos,
    })),
    comision: {
      causada: Number(comisiones[0]?.causada ?? 0),
      liquidada: Number(comisiones[0]?.liquidada ?? 0),
      pendiente: Number(comisiones[0]?.pendiente ?? 0),
    },
    faltantesAbiertos: faltantes.map((f) => ({
      producto: f.producto,
      unidades: Number(f.unidades),
      estado: f.estado,
      reportado: f.reportado,
    })),
    pacientes: Number(pacientes[0]?.n ?? 0),
  };
}
