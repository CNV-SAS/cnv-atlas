import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { recordAudit } from "@/modules/audit/log";

// ═══ REGISTRAR EL DESTINO DE UN ENVIO, DESPUES DE LA VENTA (legal, 2026-10-08) ═══
//
// ── POR QUE EXISTE, Y POR QUE SIN ESTO EL PORTON HABRIA SIDO UN DEFECTO ──────────────────────────
//
// Legal decidio dos cosas que juntas abrian un hueco si se construia solo una:
//   1. La direccion la pide QUIEN COORDINA el envio, no el profesional en consulta.
//   2. Y NO se puede marcar entregada una venta a domicilio sin direccion (validacion dura).
//
// La (2) la puse en `registrarEntrega` y en el CHECK de la 0213. Y al revisar si alguien podia CUMPLIRLA,
// resulto que **no habia ninguna via para registrar la direccion despues de la venta**: ni pantalla, ni accion,
// ni writer. O sea que el porton habria dejado toda venta desde la bodega IMPOSIBLE DE ENTREGAR para siempre.
//
// Es la leccion que ya estaba escrita (`guard-sin-superficie-que-lo-alcance`) y que casi repito: un guard
// correcto sin una superficie que lo satisfaga no protege, bloquea.
//
// ── QUE SE PUEDE TOCAR Y QUE NO ──────────────────────────────────────────────────────────────────
//
// SOLO EL DESTINO (ciudad, departamento, direccion, celular) y SOLO mientras el envio esta por despachar. Nada
// de dinero, nada de productos, nada de estado. Una venta ya entregada no se edita: su destino es parte de lo
// que paso, y corregirlo despues seria reescribir el hecho.
//
// Y QUEDA AUDITADO INLINE (regla dura 8): es un dato de contacto de un paciente escrito por alguien de CNV
// sobre una venta ya cobrada. Quien lo escribio y cuando tiene que poder reconstruirse.

export type ResultadoDelDestino =
  | "registrado"
  | "no_existe"
  | "no_es_envio"
  | "ya_entregada"
  /** Llego sin direccion util: registrar el destino es justamente poner la direccion. */
  | "direccion_vacia";

export async function registrarDestinoDelEnvio(
  txId: string,
  destino: { ciudad: string; departamento?: string | null; direccion: string; celular?: string | null },
  actor: { id: string; email: string | null },
): Promise<ResultadoDelDestino> {
  const ciudad = destino.ciudad.trim();
  const direccion = destino.direccion.trim();
  // SE EXIGE AQUI ADEMAS DEL CHECK, para que quien coordina reciba una frase y no el error de una restriccion.
  if (direccion.length < 5 || ciudad === "") return "direccion_vacia";
  const departamento = destino.departamento?.trim() || null;
  const celular = destino.celular?.trim() || null;

  return db.transaction(async (tx) => {
    const [venta] = await tx.execute<{
      delivery_mode: string | null;
      fulfillment_state: string | null;
    }>(sql`
      select delivery_mode, fulfillment_state from transactions where id = ${txId} for update`);
    if (!venta) return "no_existe";
    if (venta.delivery_mode !== "domicilio") return "no_es_envio";
    if (venta.fulfillment_state === "entregado") return "ya_entregada";

    await tx.execute(sql`
      update transactions
         set shipping_city = ${ciudad},
             shipping_department = ${departamento},
             shipping_address = ${direccion},
             -- EL CELULAR SOLO SE PISA SI VIENE UNO: vacio significa "deja el que ya tenga", igual que en el
             -- bloque de /pagos. Borrarlo por omision dejaria un envio sin con quien coordinar.
             shipping_phone = coalesce(${celular}, shipping_phone),
             updated_at = now()
       where id = ${txId}`);

    await recordAudit(tx, {
      event: "venta.destino_registrado",
      actorId: actor.id,
      actorEmail: actor.email,
      entityType: "transaction",
      entityId: txId,
      // SIN LA DIRECCION EN EL PAYLOAD: es un dato personal del paciente, y lo que el audit necesita responder
      // es QUIEN la registro y CUANDO, no cual es. La direccion vive en la fila, que ya esta gateada por RLS.
      payload: { ciudad, departamento, celular_actualizado: celular != null },
    });
    return "registrado";
  });
}
