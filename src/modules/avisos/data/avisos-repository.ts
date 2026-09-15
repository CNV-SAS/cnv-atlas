import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { FACTURABLE, LE_FALTA_ALGO } from "@/modules/payments/data/facturacion-repository";

import type { Franja, Pendiente, TipoDePendiente } from "../resumen";

// ═══ LO QUE LOS AVISOS LEEN Y ESCRIBEN (Bloque A) ═══
//
// Conexion de sistema (Drizzle, sin RLS), a proposito: el resumen lo arma una tarea programada, donde no hay
// sesion de usuario. Las pantallas que muestran esto a una persona ya pasaron por su policy.

export type TipoDeMarca = "pendientes_ventas" | "escalamiento_ventas";

/**
 * TODO LO QUE PIDE ACCION HUMANA, con su "en gestion" vigente. Tres tipos, y cada uno con la MISMA condicion que
 * usa su panel: si aqui se escribiera otra, el correo y la pantalla dirian cosas distintas.
 */
export async function listarPendientesDeAccion(): Promise<Pendiente[]> {
  const filas = await db.execute<{
    tipo: TipoDePendiente;
    transaction_id: string;
    desde: string;
    monto: string;
    productos: string | null;
    causa: string;
    en_gestion_hasta: string | null;
    en_gestion_nota: string | null;
    en_gestion_por: string | null;
  }>(sql`
    with pendientes as (
      -- Pagos en revision abiertos (panel "Ventas por revisar").
      select 'revision'::text as tipo, t.id as transaction_id,
             coalesce(t.review_opened_at, t.updated_at) as desde, t.amount,
             case when t.review_professional_version is null
                  then 'Falta la versión del Integrante'
                  else 'Tiene la versión del Integrante: falta decidir' end as causa
        from transactions t
       where t.status = 'paid' and t.review_reason is not null and t.review_resolution is null
      union all
      -- Efectivo que no se recibio, con la nota credito manual pendiente.
      select 'nota_credito', t.id, t.cash_not_received_at, t.amount,
             'Falta registrar la nota crédito manual en Alegra'
        from transactions t
       where t.cash_not_received_at is not null and t.credit_note_manual_number is null
      union all
      -- Ventas cobradas sin factura o sin pago registrado (panel de facturas), con la misma condicion.
      select 'sin_documento', transactions.id, transactions.created_at, transactions.amount,
             case
               when transactions.alegra_invoice_state = 'emitida' then 'Facturada, pago no registrado en Alegra'
               when transactions.alegra_last_error is not null then left(transactions.alegra_last_error, 160)
               else 'Sin intentar facturar'
             end
        from transactions
       where transactions.status = 'paid' and ${LE_FALTA_ALGO} and ${FACTURABLE}
    )
    select p.tipo, p.transaction_id, p.desde::text as desde, p.amount::text as monto,
           (select string_agg(n.name || ' x' || ti.quantity, ', ' order by n.name)
              from transaction_items ti join nutraceuticals n on n.id = ti.nutraceutical_id
             where ti.transaction_id = p.transaction_id) as productos,
           p.causa,
           g.until_date::text as en_gestion_hasta, g.note as en_gestion_nota, g.por as en_gestion_por
      from pendientes p
      left join lateral (
        select f.until_date, f.note, pr.full_name as por
          from pending_followups f join profiles pr on pr.id = f.created_by
         where f.kind = p.tipo and f.transaction_id = p.transaction_id
         order by f.created_at desc limit 1
      ) g on true
     order by p.desde`);
  return filas.map((f) => ({
    tipo: f.tipo,
    transactionId: f.transaction_id,
    desde: String(f.desde),
    monto: String(f.monto),
    productos: f.productos ?? "",
    causa: f.causa,
    enGestionHasta: f.en_gestion_hasta,
    enGestionNota: f.en_gestion_nota,
    enGestionPor: f.en_gestion_por,
  }));
}

/**
 * Los correos de quien tiene la marca, si su cuenta sigue activa y SIGUE teniendo un rol interno. El trigger
 * lo exige al poner la marca; aqui se vuelve a mirar porque el rol se puede quitar despues.
 */
export async function destinatarios(tipo: TipoDeMarca): Promise<string[]> {
  const filas = await db.execute<{ email: string }>(sql`
    select distinct pr.email
      from notification_subscriptions s
      join profiles pr on pr.id = s.profile_id
     where s.kind = ${tipo} and pr.status = 'active'
       and exists (select 1 from user_roles ur join roles r on r.id = ur.role_id
                    where ur.user_id = pr.id and r.name::text in ('admin', 'direccion', 'soporte'))
     order by pr.email`);
  return filas.map((f) => f.email);
}

/**
 * Las claves del envio ANTERIOR a este dia y franja, o null si nunca hubo uno. Sin los que quedaron reclamados y
 * sin cerrar (la tarea murio a mitad): esos no dicen que se aviso.
 */
export async function clavesDelEnvioAnterior(dia: string, franja: Franja): Promise<string[] | null> {
  const [f] = await db.execute<{ item_keys: string[] }>(sql`
    select item_keys from alert_digest_runs
     where reason is distinct from 'reclamado'
       -- "Antes" escrito a mano: un dia anterior, o la manana del mismo dia si esta es la tarde. No se confia en
       -- que 'am' < 'pm' por orden alfabetico.
       and (run_date < ${dia}::date or (run_date = ${dia}::date and slot = 'am' and ${franja} = 'pm'))
     order by run_date desc, case slot when 'pm' then 1 else 0 end desc limit 1`);
  return f ? f.item_keys : null;
}

/** Cuanto se espera a una corrida reclamada que no cerro antes de darla por muerta. La ruta vive 60 segundos. */
const RECLAMO_MUERTO = "5 minutes";

/**
 * RECLAMA el envio de un dia y una franja ANTES de enviar. Si ya estaba reclamado (la tarea corrio dos veces, o
 * alguien la disparo a mano), devuelve false y no se envia nada: un mismo resumen no llega dos veces.
 *
 * EL RECLAMO NO ES "YA SE ENVIO" (smoke del Bloque A, 2026-09-15). Una corrida que FALLO queda escrita con su
 * motivo, y la siguiente la puede reclamar otra vez; lo mismo una que quedo reclamada y murio a mitad. Antes, un
 * fallo dejaba la fila tomada y el reintento respondia "ya_enviado": ese correo se perdia. Solo bloquean las que
 * cerraron (enviadas, o sin envio por un motivo) y las reclamadas que siguen vivas.
 */
export async function reclamarEnvio(dia: string, franja: Franja): Promise<boolean> {
  const filas = await db.execute<{ id: string }>(sql`
    insert into alert_digest_runs (run_date, slot, sent, reason)
    values (${dia}::date, ${franja}, false, 'reclamado')
    on conflict (run_date, slot) do update
       set reason = 'reclamado', sent = false, ran_at = now()
     where alert_digest_runs.sent = false
       and (alert_digest_runs.reason like 'Falló:%'
            or (alert_digest_runs.reason = 'reclamado' and alert_digest_runs.ran_at < now() - ${RECLAMO_MUERTO}::interval))
    returning id`);
  return filas.length > 0;
}

export async function cerrarEnvio(
  dia: string,
  franja: Franja,
  r: { claves: string[]; enviado: boolean; motivo: string | null; destinatarios: number },
): Promise<void> {
  // Las claves viajan como JSON y se convierten a arreglo en la base: un arreglo de JS dentro de la plantilla se
  // expandiria como lista de parametros.
  await db.execute(sql`
    update alert_digest_runs
       set item_keys = array(select jsonb_array_elements_text(${JSON.stringify(r.claves)}::jsonb)),
           sent = ${r.enviado}, reason = ${r.motivo ?? "enviado"}, recipients = ${r.destinatarios}, ran_at = now()
     where run_date = ${dia}::date and slot = ${franja}`);
}

/** "En gestion hasta": una fila nueva; la ultima es la vigente. */
export async function registrarEnGestion(e: {
  tipo: TipoDePendiente;
  transactionId: string;
  nota: string;
  hasta: string;
  actorId: string;
}): Promise<void> {
  await db.execute(sql`
    insert into pending_followups (kind, transaction_id, note, until_date, created_by)
    values (${e.tipo}, ${e.transactionId}, ${e.nota}, ${e.hasta}::date, ${e.actorId})`);
}

export type UsuarioConMarcas = { id: string; email: string; nombre: string; roles: string[]; marcas: TipoDeMarca[] };

/** Los usuarios internos (admin, direccion, soporte) con sus marcas, para la pantalla de administracion. */
export async function listarUsuariosInternosConMarcas(): Promise<UsuarioConMarcas[]> {
  const filas = await db.execute<{ id: string; email: string; nombre: string; roles: string[]; marcas: string[] | null }>(sql`
    select pr.id, pr.email, pr.full_name as nombre,
           array_agg(distinct r.name::text order by r.name::text) as roles,
           (select array_agg(s.kind order by s.kind) from notification_subscriptions s where s.profile_id = pr.id) as marcas
      from profiles pr
      join user_roles ur on ur.user_id = pr.id
      join roles r on r.id = ur.role_id
     where r.name::text in ('admin', 'direccion', 'soporte') and pr.status = 'active'
     group by pr.id
     order by pr.full_name`);
  return filas.map((f) => ({
    id: f.id,
    email: f.email,
    nombre: f.nombre,
    roles: f.roles,
    marcas: (f.marcas ?? []) as TipoDeMarca[],
  }));
}

export async function ponerMarca(profileId: string, tipo: TipoDeMarca, actorId: string): Promise<void> {
  await db.execute(sql`
    insert into notification_subscriptions (profile_id, kind, created_by)
    values (${profileId}, ${tipo}, ${actorId})
    on conflict (profile_id, kind) do nothing`);
}

export async function quitarMarca(profileId: string, tipo: TipoDeMarca): Promise<void> {
  await db.execute(sql`delete from notification_subscriptions where profile_id = ${profileId} and kind = ${tipo}`);
}

export async function tieneMarca(profileId: string, tipo: TipoDeMarca): Promise<boolean> {
  const [f] = await db.execute<{ si: boolean }>(sql`
    select exists (select 1 from notification_subscriptions where profile_id = ${profileId} and kind = ${tipo}) as si`);
  return Boolean(f?.si);
}

/** Si alguien recibe los pendientes. Si nadie, el control no tiene destinatario. */
export async function hayQuienRecibaPendientes(): Promise<boolean> {
  return (await destinatarios("pendientes_ventas")).length > 0;
}

export type DatosDelAvisoAlIntegrante = {
  email: string;
  nombre: string;
  monto: string;
  productos: string;
  fecha: string;
  avisado: boolean;
};

/** Lo que dice el correo al Integrante. Sin datos del paciente: producto, monto y fecha de la venta. */
export async function datosDelAvisoAlIntegrante(txId: string): Promise<DatosDelAvisoAlIntegrante | null> {
  const [f] = await db.execute<{
    email: string;
    nombre: string;
    monto: string;
    productos: string | null;
    fecha: string;
    avisado: boolean;
  }>(sql`
    select pr.email, pr.full_name as nombre, t.amount::text as monto, t.created_at::text as fecha,
           t.review_notified_at is not null as avisado,
           (select string_agg(n.name || ' x' || ti.quantity, ', ' order by n.name)
              from transaction_items ti join nutraceuticals n on n.id = ti.nutraceutical_id
             where ti.transaction_id = t.id) as productos
      from transactions t
      join professional_profiles pp on pp.id = t.professional_id
      join profiles pr on pr.id = pp.profile_id
     where t.id = ${txId} and t.review_reason is not null and pr.status = 'active'`);
  return f ? { ...f, productos: f.productos ?? "", monto: String(f.monto), fecha: String(f.fecha) } : null;
}

/** Marca el aviso al Integrante como enviado, una vez. Devuelve false si ya estaba. */
export async function marcarIntegranteAvisado(txId: string): Promise<boolean> {
  const filas = await db.execute<{ id: string }>(sql`
    update transactions set review_notified_at = now() where id = ${txId} and review_notified_at is null returning id`);
  return filas.length > 0;
}
