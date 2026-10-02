import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { brutoReconocido } from "@/modules/payments/cobro-reconocido";

// ═══ LO QUE UN PROFESIONAL HA VENDIDO Y SU MARGEN: UN SOLO LECTOR ═══
//
// LO QUE PASO (Santiago, 2026-10-01), y es la SEXTA vez con la misma forma: su /perfil decia 244.700 en 3
// ventas con 51.126 de margen, y la pantalla de admin decia 154.700 en 2 ventas con 36.000. La misma
// persona, el mismo historico, 90.000 y una venta de diferencia.
//
// ── LA CAUSA ERA SUTIL Y VALE APRENDERLA: EL FILTRO DEPENDIA DE LO QUE CADA LECTOR PODIA VER ──
//
// Los dos excluian los pacientes marcados, y los dos lo hacian pidiendo "la lista de pacientes marcados".
// Pero /perfil la pedia BAJO LA RLS DEL PROFESIONAL, y `patients` tiene politica de SELECT: un paciente
// marcado que el no ve NO ENTRABA EN SU LISTA, asi que su venta no se filtraba. La pantalla de admin usaba
// la conexion de sistema y veia todos.
//
// O sea: las dos cumplian la regla y daban distinto, porque el INSUMO de la regla era distinto. Ningun
// candado "cada pantalla aplica el filtro" podia atrapar eso, y por eso ya van seis.
//
// ── POR QUE UN LECTOR COMPARTIDO Y NO DOS FILTROS IGUALES ──
//
// Dos consultas que calculan lo mismo divergen; la unica forma de que no puedan es que haya UNA. Es la misma
// leccion de `brutoReconocido` (la cuenta compartida), llevada un paso mas alla: no basta compartir la
// ARITMETICA si cada lector arma su propio UNIVERSO.
//
// Y EL CANDADO CAMBIA DE FORMA: deja de comprobar que cada pantalla cumpla la regla y comprueba que las dos
// LLAMEN A ESTO. Lo primero no atrapo seis defectos; lo segundo los hace imposibles.
//
// ── POR QUE USA `db` Y NO LA SESION, sin ser un bypass de RLS ──
//
// Precisamente para que el universo no dependa de quien pregunta. Y es seguro porque la funcion recibe UN
// professionalId y solo responde por el: la pantalla del integrante le pasa el suyo (resuelto de su sesion) y
// la de admin ya paso por su policy. Nadie puede pedir el de otro.
//
// ── LA REGLA DEL DINERO, EN UN SITIO ──
//
// El dinero que nunca se facturo NO ES DINERO: no cuenta una venta a un paciente marcado ni una que lleve un
// producto de prueba (el gate del ambiente impide facturar las dos). SI cuenta aunque el profesional sea una
// cuenta de demostracion, porque esta es SU pantalla y vaciarsela le quitaria lo que tiene que demostrar; esa
// diferencia con /direccion la explica el aviso de su pantalla.

export type HistoricoDelProfesional = {
  vendido: { total: number; ventas: number };
  comision: { causada: number; liquidada: number; pendiente: number };
};

/** El filtro del dinero, escrito UNA vez. `t` es la venta. */
const SOLO_DINERO_REAL = sql`
  not exists (select 1 from patients pa where pa.id = t.patient_id and pa.cuenta_como_de_prueba)
  and not exists (
    select 1 from transaction_items ti join nutraceuticals n on n.id = ti.nutraceutical_id
     where ti.transaction_id = t.id and coalesce(n.is_test, false))`;

export async function historicoDelProfesional(professionalId: string): Promise<HistoricoDelProfesional> {
  const pagadas = await db.execute<{ id: string; amount: string }>(sql`
    select t.id, t.amount::text as amount
      from transactions t
     where t.professional_id = ${professionalId}::uuid
       and t.status = 'paid'
       and t.cash_not_received_at is null
       and (t.review_reason is null or t.review_resolution is not null)
       and ${SOLO_DINERO_REAL}`);

  const perdidas = await db.execute<{ transaction_id: string }>(sql`
    select r.transaction_id from sale_reversals r
      join transactions t on t.id = r.transaction_id
     where t.professional_id = ${professionalId}::uuid and r.state = 'perdida'
       and ${SOLO_DINERO_REAL}`);

  const devueltas = await db.execute<{ debited_amount: string | null }>(sql`
    select r.debited_amount::text as debited_amount from sale_reversals r
      join transactions t on t.id = r.transaction_id
     where t.professional_id = ${professionalId}::uuid and r.state = 'devuelta'
       and ${SOLO_DINERO_REAL}`);

  // LA COMISION CON LA MISMA REGLA QUE LAS VENTAS: sin eso, el margen y las ventas de la MISMA tarjeta
  // contaban universos distintos, que es como empezo todo esto.
  const [comisiones] = await db.execute<{ causada: string; liquidada: string; pendiente: string }>(sql`
    select coalesce(sum(r.commission_amount), 0)::text as causada,
           coalesce(sum(r.commission_amount) filter (where r.settlement_id is not null), 0)::text as liquidada,
           coalesce(sum(r.commission_amount) filter (where r.settlement_id is null), 0)::text as pendiente
      from professional_revenue r
      join transactions t on t.id = r.transaction_id
     where r.professional_id = ${professionalId}::uuid
       and ${SOLO_DINERO_REAL}`);

  return {
    // LA CUENTA LA HACE EL MODULO NEUTRO, el mismo de Inicio y Direccion. Lo que cambia es el ALCANCE.
    vendido: {
      total: brutoReconocido({
        pagadas,
        disputasPerdidas: perdidas.map((r) => r.transaction_id),
        devoluciones: devueltas.map((r) => r.debited_amount),
      }),
      ventas: pagadas.length,
    },
    comision: {
      causada: Number(comisiones?.causada ?? 0),
      liquidada: Number(comisiones?.liquidada ?? 0),
      pendiente: Number(comisiones?.pendiente ?? 0),
    },
  };
}
