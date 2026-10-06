import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { recordAudit } from "@/modules/audit/log";

import { estadoDelRetracto, procedeElRetracto, reintegroPorRetracto } from "../domicilio";
import { modalidadEnLaFecha, MODALIDAD_POR_DEFECTO, type Modalidad } from "../modalidad";

// ═══ EL DERECHO DE RETRACTO (0190, Ley 1480 de 2011 art. 47) ═══
//
// EL ACTO ES CHICO Y LA CONSECUENCIA NO: registrar que el paciente se retracto, con la EVIDENCIA (si el
// producto volvio sellado) y con el reintegro de lo que le pago a CNV.
//
// ── EL FLETE SALIO DE AQUI (2026-10-06) ──────────────────────────────────────────────────────────
//
// Este archivo calculaba el flete de la venta, lo sumaba al reintegro y lo revertia del ingreso de CNV con
// una fila negativa. Nada de eso existe: desde el 2026-10-05 el paciente le paga el envio al mensajero, y la
// consulta a la nube del 2026-10-06 confirmo que NINGUNA venta llego a cobrar flete (cero filas, ni reales
// ni de prueba), asi que las columnas se borraron en la 0207.
//
// Y EL ASESOR LEGAL LO RATIFICO el 2026-10-06: CNV no reintegra el flete, y la posicion es defendible
// porque el envio lo presta y lo cobra un tercero. Asi que el reintegro es lo que el paciente le pago A CNV,
// que es el producto.

export class RetractoError extends Error {}

export type EstadoDeRetractoDeLaVenta = {
  /** La venta de la que se habla: el lector en lote devuelve un mapa y la pantalla no tiene que volver a atarlo. */
  transactionId: string;
  aplica: boolean;
  motivo: string | null;
  limite: string | null;
  diasHabilesRestantes: number | null;
  vencido: boolean;
  /** Lo que habria que reintegrarle si se retracta. Es el producto: el envio se lo pago al mensajero. */
  reintegro: number;
  ejercidoEl: string | null;
  selloIntacto: boolean | null;
};

type FilaVenta = {
  id: string;
  delivery_mode: string | null;
  amount: string;
  professional_id: string | null;
  entregada: string | null;
  hoy: string;
  dia_de_la_venta: string;
  ejercido: string | null;
  sello: boolean | null;
};

async function leerVenta(ex: { execute: typeof db.execute }, transactionId: string): Promise<FilaVenta> {
  const [t] = await ex.execute<FilaVenta>(sql`
    select t.id, t.delivery_mode, t.amount::text as amount,
           t.professional_id,
           (t.delivered_at at time zone 'America/Bogota')::date::text as entregada,
           (now() at time zone 'America/Bogota')::date::text as hoy,
           (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date::text as dia_de_la_venta,
           (t.retracto_ejercido_at at time zone 'America/Bogota')::date::text as ejercido,
           t.retracto_sello_intacto as sello
      from transactions t where t.id = ${transactionId}`);
  if (!t) throw new RetractoError("Esa venta no existe.");
  return t;
}

/** La modalidad que regia EL DIA DE LA VENTA. Decide si el retracto lo atiende CNV o el Integrante. */
async function modalidadDeLaVenta(
  ex: { execute: typeof db.execute },
  professionalId: string | null,
  dia: string,
): Promise<Modalidad> {
  if (!professionalId) return MODALIDAD_POR_DEFECTO;
  const filas = await ex.execute<{ modality: string; valid_from: string; valid_to: string | null }>(sql`
    select modality, valid_from::text as valid_from, valid_to::text as valid_to
      from professional_modalities where professional_id = ${professionalId}`);
  if (filas.length === 0) return MODALIDAD_POR_DEFECTO;
  return modalidadEnLaFecha(
    filas.map((f) => ({ modality: f.modality as Modalidad, validFrom: f.valid_from, validTo: f.valid_to })),
    dia,
  );
}

/** El estado del retracto de una venta, para la pantalla. */
export async function estadoDeRetracto(transactionId: string): Promise<EstadoDeRetractoDeLaVenta> {
  const t = await leerVenta(db, transactionId);
  const modalidad = await modalidadDeLaVenta(db, t.professional_id, t.dia_de_la_venta);
  const estado = estadoDelRetracto({
    deliveryMode: t.delivery_mode,
    modalidad,
    entregadaEl: t.entregada,
    hoy: t.hoy,
  });
  return {
    transactionId,
    ...estado,
    // EL MONTO DE LA VENTA ES EL REINTEGRO, sin restarle ni sumarle nada: ya no hay flete dentro de el.
    reintegro: reintegroPorRetracto({ montoDelProducto: Number(t.amount) }),
    ejercidoEl: t.ejercido,
    selloIntacto: t.sello,
  };
}

/**
 * REGISTRA el retracto. No mueve el producto: eso lo hace la devolucion fisica, linea por linea, por el
 * camino que ya existe. Lo que hace aqui es dejar el HECHO con su evidencia y revertir el FLETE, que ningun
 * otro camino revierte.
 *
 * SI NO PROCEDE, TAMBIEN SE REGISTRA. Un retracto negado es una decision con consecuencias (el paciente
 * puede reclamar ante la Superintendencia), y la razon de la negativa tiene que constar: el sello roto es la
 * evidencia que acredita la excepcion, y la doctrina exige acreditarla, no afirmarla.
 */
export async function registrarRetracto(input: {
  transactionId: string;
  selloIntacto: boolean;
  nota: string | null;
  actorId: string;
  actorEmail: string | null;
  ip: string | null;
}): Promise<{ procede: boolean; motivo: string; reintegro: number }> {
  return db.transaction(async (tx) => {
    const t = await leerVenta(tx, input.transactionId);
    if (t.ejercido) throw new RetractoError(`El retracto de esa venta ya se registró el ${t.ejercido}.`);

    const modalidad = await modalidadDeLaVenta(tx, t.professional_id, t.dia_de_la_venta);
    const estado = estadoDelRetracto({
      deliveryMode: t.delivery_mode,
      modalidad,
      entregadaEl: t.entregada,
      hoy: t.hoy,
    });
    const veredicto = procedeElRetracto({ estado, selloIntacto: input.selloIntacto });
      const reintegro = veredicto.procede ? reintegroPorRetracto({ montoDelProducto: Number(t.amount) }) : 0;

    await tx.execute(sql`
      update transactions
         set retracto_ejercido_at = now(),
             retracto_sello_intacto = ${input.selloIntacto},
             retracto_nota = ${input.nota}
       where id = ${input.transactionId}`);

    // AQUI SE REVERTIA EL FLETE del ingreso de CNV con una fila negativa, y se fue con el flete: CNV no lo
    // cobra, asi que no hay ingreso que revertir. El PRODUCTO si se revierte, por el camino que ya existe (la
    // devolucion fisica, que devuelve su parte proporcional del reparto sellado linea por linea).

    await recordAudit(tx, {
      event: veredicto.procede ? "venta.retracto_aceptado" : "venta.retracto_negado",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
      entityType: "transaction",
      entityId: input.transactionId,
      payload: {
        sello_intacto: input.selloIntacto,
        motivo: veredicto.motivo,
        reintegro,
        limite: estado.limite,
        nota: input.nota,
      },
    });

    return { procede: veredicto.procede, motivo: veredicto.motivo, reintegro };
  });
}

/**
 * Los ids que de verdad son UUID.
 *
 * POR QUE EXISTE: la lista se interpola en el SQL (drizzle expande un arreglo como TUPLA, asi que
 * `any(${ids}::uuid[])` produce SQL invalido; ya costo una vez en otro test). Interpolar a mano obliga a
 * garantizar la forma, y esto lo garantiza: lo que no sea un UUID no llega a la consulta.
 */
const soloUuid = (ids: string[]): string[] =>
  ids.filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

/**
 * El estado del retracto de VARIAS ventas de una vez. La pantalla de pagos lista decenas, y preguntar una
 * por una seria una consulta por fila; ademas el pool tiene seis conexiones y ese es justo el problema que
 * ya se pago una vez en esta misma pantalla.
 *
 * Solo devuelve las que son a domicilio: en las demas el retracto no aplica y no hay nada que mostrar.
 */
export async function retractosDeLasVentas(
  transactionIds: string[],
): Promise<Map<string, EstadoDeRetractoDeLaVenta>> {
  const salida = new Map<string, EstadoDeRetractoDeLaVenta>();
  const ids = soloUuid(transactionIds);
  if (ids.length === 0) return salida;

  const filas = await db.execute<FilaVenta>(sql`
    select t.id, t.delivery_mode, t.amount::text as amount,
           t.professional_id,
           (t.delivered_at at time zone 'America/Bogota')::date::text as entregada,
           (now() at time zone 'America/Bogota')::date::text as hoy,
           (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date::text as dia_de_la_venta,
           (t.retracto_ejercido_at at time zone 'America/Bogota')::date::text as ejercido,
           t.retracto_sello_intacto as sello
      from transactions t
     where t.id = any(${sql.raw(`array['${ids.join("','")}']::uuid[]`)})
       and t.delivery_mode = 'domicilio'`);
  if (filas.length === 0) return salida;

  // Las modalidades de los profesionales implicados, de una sola vez.
  const profIds = soloUuid([...new Set(filas.map((f) => f.professional_id).filter((x): x is string => x != null))]);
  const vigencias = new Map<string, { modality: Modalidad; validFrom: string; validTo: string | null }[]>();
  if (profIds.length > 0) {
    const vs = await db.execute<{
      professional_id: string;
      modality: string;
      valid_from: string;
      valid_to: string | null;
    }>(sql`
      select professional_id, modality, valid_from::text as valid_from, valid_to::text as valid_to
        from professional_modalities
       where professional_id = any(${sql.raw(`array['${profIds.join("','")}']::uuid[]`)})`);
    for (const v of vs) {
      const lista = vigencias.get(v.professional_id) ?? [];
      lista.push({ modality: v.modality as Modalidad, validFrom: v.valid_from, validTo: v.valid_to });
      vigencias.set(v.professional_id, lista);
    }
  }

  for (const t of filas) {
    const modalidad = t.professional_id
      ? modalidadEnLaFecha(vigencias.get(t.professional_id) ?? [], t.dia_de_la_venta)
      : MODALIDAD_POR_DEFECTO;
    const estado = estadoDelRetracto({
      deliveryMode: t.delivery_mode,
      modalidad,
      entregadaEl: t.entregada,
      hoy: t.hoy,
    });
      salida.set(t.id, {
      transactionId: t.id,
      ...estado,
      reintegro: reintegroPorRetracto({ montoDelProducto: Number(t.amount) }),
      ejercidoEl: t.ejercido,
      selloIntacto: t.sello,
    });
  }
  return salida;
}
