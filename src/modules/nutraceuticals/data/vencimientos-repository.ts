import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { DIAS_DE_ALERTA_POR_DEFECTO, type LoteEnCustodia, type RegistroDeAlerta } from "../vencimientos";

// ═══ LO QUE LEE Y ESCRIBE LA ALERTA DE VENCIMIENTO (0186) ═══
//
// Conexion de sistema (Drizzle, sin RLS) por la misma razon que el repositorio de avisos: quien genera las
// alertas es una tarea programada, donde no hay sesion. Las pantallas que muestran esto a una persona pasan
// por su policy (y la tabla tiene RLS para eso).

/** Los dias de anticipacion VIGENTES. Salen de configuracion, no del codigo (principio 2 del modelo). */
export async function diasDeAlerta(): Promise<number> {
  const [f] = await db.execute<{ dias: number }>(
    sql`select dias_alerta_vencimiento as dias from commercial_config limit 1`,
  );
  // Sin fila de configuracion se usa el defecto del modelo. No se lanza: una configuracion que falta no
  // puede ser la razon de que nadie se entere de un vencimiento.
  return f ? Number(f.dias) : DIAS_DE_ALERTA_POR_DEFECTO;
}

export type CustodiaConLotes = {
  locationId: string;
  locationName: string;
  /** null = bodega central (sin dueño). */
  professionalId: string | null;
  professionalName: string | null;
  professionalEmail: string | null;
  lotes: LoteEnCustodia[];
};

/**
 * TODO el saldo por lote, agrupado por ubicacion, con saldo positivo. Sin filtrar por fecha a proposito: la
 * ventana la aplica el modulo puro, para que la regla viva en un solo sitio y se pueda probar sin base.
 */
export async function custodiasConLotes(): Promise<CustodiaConLotes[]> {
  const filas = await db.execute<{
    location_id: string;
    location_name: string;
    professional_id: string | null;
    professional_name: string | null;
    professional_email: string | null;
    lot_id: string;
    codigo: string;
    nutraceutical_id: string;
    producto: string;
    vence: string;
    unidades: number;
  }>(sql`
    select i.location_id, loc.name as location_name,
           loc.professional_id,
           pr.full_name as professional_name, pr.email as professional_email,
           i.lot_id, l.code as codigo,
           i.nutraceutical_id, n.name as producto,
           l.expires_on::text as vence,
           i.stock_quantity::int as unidades
      from nutraceutical_inventory i
      join inventory_locations loc on loc.id = i.location_id
      join lots l on l.id = i.lot_id
      join nutraceuticals n on n.id = i.nutraceutical_id
      -- El dueño de la ubicacion, por su perfil. Se resuelve por la UBICACION y no por
      -- nutraceutical_inventory.professional_id, que es un cache verificado y no la fuente.
      left join professional_profiles pp on pp.id = loc.professional_id
      left join profiles pr on pr.id = pp.profile_id
     where i.stock_quantity > 0
       and loc.is_active
       -- La cuarentena no se vende ni se avisa: lo que esta ahi ya salio del circuito (0164).
       and loc.sellable
     order by loc.name, l.expires_on, n.name`);

  const porUbicacion = new Map<string, CustodiaConLotes>();
  for (const f of filas) {
    const actual =
      porUbicacion.get(f.location_id) ??
      ({
        locationId: f.location_id,
        locationName: f.location_name,
        professionalId: f.professional_id,
        professionalName: f.professional_name,
        professionalEmail: f.professional_email,
        lotes: [],
      } satisfies CustodiaConLotes);
    actual.lotes.push({
      lotId: f.lot_id,
      codigo: f.codigo,
      nutraceuticalId: f.nutraceutical_id,
      producto: f.producto,
      vence: f.vence,
      unidades: Number(f.unidades),
    });
    porUbicacion.set(f.location_id, actual);
  }
  return [...porUbicacion.values()];
}

export type AlertaGenerada = {
  id: string;
  lotId: string;
  locationId: string;
  esNueva: boolean;
};

/**
 * REGISTRA la alerta de un lote en una ubicacion. Idempotente por el indice unico (lote, ubicacion): correrla
 * dos veces no genera dos avisos y, sobre todo, NO REINICIA el reloj de la anticipacion. Devuelve si la fila se
 * creo ahora, que es lo que decide si hay que mandar correo.
 */
export async function registrarAlerta(a: {
  lotId: string;
  locationId: string;
  nutraceuticalId: string;
  professionalId: string | null;
  expiresOn: string;
  unitsAtAlert: number;
  daysAhead: number;
}): Promise<AlertaGenerada> {
  // `on conflict do nothing` no devuelve la fila existente, asi que se pide con un segundo select. Dos
  // consultas en vez de un `do update` porque un update, aunque no cambiara nada, dejaria la puerta abierta a
  // tocar `created_at` o `days_ahead`, que son la prueba (el trigger lo prohibe, pero mejor no intentarlo).
  const insertadas = await db.execute<{ id: string }>(sql`
    insert into lot_expiry_alerts
      (lot_id, location_id, nutraceutical_id, professional_id, expires_on, units_at_alert, days_ahead)
    values (${a.lotId}, ${a.locationId}, ${a.nutraceuticalId}, ${a.professionalId},
            ${a.expiresOn}::date, ${a.unitsAtAlert}, ${a.daysAhead})
    on conflict (lot_id, location_id) do nothing
    returning id`);
  if (insertadas.length > 0) {
    return { id: insertadas[0].id, lotId: a.lotId, locationId: a.locationId, esNueva: true };
  }
  const [existente] = await db.execute<{ id: string }>(sql`
    select id from lot_expiry_alerts where lot_id = ${a.lotId} and location_id = ${a.locationId}`);
  return { id: existente.id, lotId: a.lotId, locationId: a.locationId, esNueva: false };
}

export type AlertaEnPantalla = {
  id: string;
  lotId: string;
  locationId: string;
  professionalId: string | null;
  professionalName: string | null;
  nutraceuticalId: string;
  producto: string;
  codigo: string;
  expiresOn: string;
  unitsAtAlert: number;
  daysAhead: number;
  generadaEl: string;
  vistaEl: string | null;
  /** Unidades que QUEDAN hoy en esa ubicacion y lote. 0 = se atendio (se vendio o se devolvio). */
  unidadesHoy: number;
};

const SELECT_ALERTAS = sql`
  select a.id, a.lot_id, a.location_id, a.professional_id,
         pr.full_name as professional_name,
         a.nutraceutical_id, n.name as producto, l.code as codigo,
         a.expires_on::text as expires_on, a.units_at_alert, a.days_ahead,
         -- LAS FECHAS SE PASAN A COLOMBIA EN SQL, no con toISOString: una alerta generada a las 8 p. m.
         -- de Bogota es del dia siguiente en UTC, y ese dia de diferencia entra en la cuenta de cuantos
         -- dias tuvo el Integrante para actuar, que es justo lo que se le puede discutir.
         (a.created_at at time zone 'America/Bogota')::date::text as generada_el,
         (a.seen_at at time zone 'America/Bogota')::date::text as vista_el,
         coalesce(i.stock_quantity, 0)::int as unidades_hoy
    from lot_expiry_alerts a
    join lots l on l.id = a.lot_id
    join nutraceuticals n on n.id = a.nutraceutical_id
    left join professional_profiles pp on pp.id = a.professional_id
    left join profiles pr on pr.id = pp.profile_id
    -- El saldo de HOY de ese lote en esa ubicacion. Ausente = cero, que es lo mismo que atendido.
    left join nutraceutical_inventory i
           on i.lot_id = a.lot_id and i.location_id = a.location_id`;

type FilaDeAlerta = {
  id: string;
  lot_id: string;
  location_id: string;
  professional_id: string | null;
  professional_name: string | null;
  nutraceutical_id: string;
  producto: string;
  codigo: string;
  expires_on: string;
  units_at_alert: number;
  days_ahead: number;
  generada_el: string;
  vista_el: string | null;
  unidades_hoy: number;
};

const aAlerta = (f: FilaDeAlerta): AlertaEnPantalla => ({
  id: f.id,
  lotId: f.lot_id,
  locationId: f.location_id,
  professionalId: f.professional_id,
  professionalName: f.professional_name,
  nutraceuticalId: f.nutraceutical_id,
  producto: f.producto,
  codigo: f.codigo,
  expiresOn: f.expires_on,
  unitsAtAlert: Number(f.units_at_alert),
  daysAhead: Number(f.days_ahead),
  generadaEl: f.generada_el,
  vistaEl: f.vista_el,
  unidadesHoy: Number(f.unidades_hoy),
});

/** Las alertas de un Integrante que TODAVIA tienen unidades: lo que le queda por resolver. */
export async function alertasAbiertasDelProfesional(professionalId: string): Promise<AlertaEnPantalla[]> {
  const filas = await db.execute<FilaDeAlerta>(sql`
    ${SELECT_ALERTAS}
     where a.professional_id = ${professionalId}
       and coalesce(i.stock_quantity, 0) > 0
     order by a.expires_on`);
  return filas.map(aAlerta);
}

/** TODAS las alertas con unidades pendientes, de todas las ubicaciones. Para CNV. */
export async function alertasAbiertas(): Promise<AlertaEnPantalla[]> {
  const filas = await db.execute<FilaDeAlerta>(sql`
    ${SELECT_ALERTAS}
     where coalesce(i.stock_quantity, 0) > 0
     order by a.expires_on`);
  return filas.map(aAlerta);
}

/** El registro de la alerta de un lote en una ubicacion, para decidir quien asume su vencido. */
export async function alertaDe(lotId: string, locationId: string): Promise<RegistroDeAlerta | null> {
  const [f] = await db.execute<{ generada_el: string; days_ahead: number; vista_el: string | null }>(sql`
    select (created_at at time zone 'America/Bogota')::date::text as generada_el,
           days_ahead,
           (seen_at at time zone 'America/Bogota')::date::text as vista_el
      from lot_expiry_alerts
     where lot_id = ${lotId} and location_id = ${locationId}`);
  if (!f) return null;
  return {
    generadaEl: f.generada_el,
    diasDeAnticipacion: Number(f.days_ahead),
    vistaEl: f.vista_el,
  };
}

/**
 * BORRA una alerta cuyo correo NO salio. La unica escritura destructiva de esta tabla, y su razon esta en la
 * cabecera del servicio: la fila es lo que determina quien asume un vencido, asi que una fila que afirma un
 * aviso que nunca se entrego podria costarle plata a alguien que nunca se entero.
 *
 * SOLO SI NADIE LA VIO. La guarda no es de confianza en quien llama: si esta vista, la fila describe algo que
 * si paso y se queda, pase lo que pase con el correo.
 */
export async function borrarAlertaNoEntregada(id: string): Promise<void> {
  await db.execute(sql`delete from lot_expiry_alerts where id = ${id} and seen_at is null`);
}

/**
 * MARCA VISTA una alerta, y solo si es de la ubicacion del profesional que la marca. La comprobacion va en el
 * WHERE y no en la aplicacion: es la misma condicion que la policy, y asi no hay dos sitios que puedan
 * discrepar. Devuelve si se marco (false = no era suya, o ya estaba vista).
 *
 * `seen_at is null` no es cortesia: el trigger PROHIBE mover una fecha ya puesta (moverla hacia adelante es
 * justo lo que le conviene a quien quiera discutir el cargo), asi que sin esta condicion la consulta lanzaria.
 */
export async function marcarVista(alertId: string, professionalId: string, profileId: string): Promise<boolean> {
  const filas = await db.execute<{ id: string }>(sql`
    update lot_expiry_alerts
       set seen_at = now(), seen_by = ${profileId}
     where id = ${alertId}
       and professional_id = ${professionalId}
       and seen_at is null
    returning id`);
  return filas.length > 0;
}

/** El `professional_profiles.id` del usuario, o null si no es profesional. */
export async function profesionalDelUsuario(profileId: string): Promise<string | null> {
  const [f] = await db.execute<{ id: string }>(sql`
    select id from professional_profiles where profile_id = ${profileId}`);
  return f ? f.id : null;
}

export type LoteProvisional = {
  lotId: string;
  codigo: string;
  producto: string;
  vence: string;
  unidades: number;
  donde: string;
};

/**
 * LOS LOTES CON VENCIMIENTO PROVISIONAL, con saldo. Es el hueco por el que la alerta NO puede funcionar.
 *
 * DE DONDE SALEN: cuando el Integrante reconoce una recepcion de un lote que CNV no habia dado de alta,
 * `resolverLoteDeRecepcion` lo CREA (negarlo alejaria el saldo de la vitrina, que es peor) con un
 * vencimiento inventado a un año y la nota que lo marca. Un lote asi nunca entra en la ventana de alerta
 * aunque en la realidad venza el mes que viene: el aviso existe y no se dispara, que es la peor forma de
 * no tener un control.
 */
export async function lotesProvisionalesConSaldo(): Promise<LoteProvisional[]> {
  const filas = await db.execute<{
    lot_id: string;
    codigo: string;
    producto: string;
    vence: string;
    unidades: number;
    donde: string;
  }>(sql`
    select l.id as lot_id, l.code as codigo, n.name as producto,
           l.expires_on::text as vence,
           sum(i.stock_quantity)::int as unidades,
           string_agg(distinct loc.name, ', ') as donde
      from lots l
      join nutraceuticals n on n.id = l.nutraceutical_id
      join nutraceutical_inventory i on i.lot_id = l.id
      join inventory_locations loc on loc.id = i.location_id
     where l.notes like 'PROVISIONAL%'
       and i.stock_quantity > 0
     group by l.id, l.code, n.name, l.expires_on
     order by n.name, l.code`);
  return filas.map((f) => ({
    lotId: f.lot_id,
    codigo: f.codigo,
    producto: f.producto,
    vence: f.vence,
    unidades: Number(f.unidades),
    donde: f.donde,
  }));
}

/**
 * COMPLETA el vencimiento de un lote provisional, y le quita la marca. Solo sobre los provisionales: el
 * vencimiento de un lote confirmado no se re-escribe desde una pantalla, porque es el dato del que cuelga
 * la alerta y, con ella, quien asume el vencido.
 */
export async function completarVencimientoDeLote(lotId: string, vence: string): Promise<boolean> {
  const filas = await db.execute<{ id: string }>(sql`
    update lots
       set expires_on = ${vence}::date,
           notes = null
     where id = ${lotId}
       and notes like 'PROVISIONAL%'
    returning id`);
  return filas.length > 0;
}
