import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { recordAudit } from "@/modules/audit/log";

import {
  inicioDelSiguienteCorte,
  MODALIDAD_LABEL,
  MODALIDAD_POR_DEFECTO,
  modalidadEnLaFecha,
  type Modalidad,
} from "../modalidad";

// ═══ CAMBIAR LA MODALIDAD DE UN INTEGRANTE (0178, 2026-09-25) ═══
//
// EL ACTO NO ES "PONER UN CAMPO", es abrir una vigencia nueva y cerrar la anterior EN LA MISMA TRANSACCION,
// con la fecha del siguiente corte. Si se hiciera en dos pasos, entre uno y otro habria dos vigentes (o
// ninguna) y el sellado de una venta en ese instante leeria cualquier cosa. El indice unico de la base lo
// impide, asi que un cambio mal escrito FALLA en vez de dejar el dato ambiguo.
//
// SERVICE ROLE (drizzle) A PROPOSITO: es un acto de admin sobre la fila de OTRA persona, asi que la RLS del
// integrante no aplica. Lo que autoriza es la policy del lado del server, y el acto queda en el audit.

export class ModalidadError extends Error {}

export type ModalidadVigente = {
  modalidad: Modalidad;
  /** Desde cuando rige la vigente. Null = no hay fila (es el defecto, comision). */
  rigeDesde: string | null;
  /** Una vigencia FUTURA ya decidida, si la hay: el cambio pedido que todavia no empieza. */
  pendiente: { modalidad: Modalidad; rigeDesde: string } | null;
  /**
   * Desde cuando regiria un cambio pedido HOY. Sale de aqui y no de la pantalla porque se calcula con la
   * MISMA fecha con que se resolvio la vigente: dos lecturas de "hoy" pueden caer en dias distintos si una
   * cruza la medianoche de Bogota, y entonces la pantalla prometeria una fecha y el escritor usaria otra.
   */
  proximoCorte: string;
  historial: { modalidad: Modalidad; desde: string; hasta: string | null; decidioEn: string }[];
};

/** Hoy en Bogota, como 'YYYY-MM-DD'. Lo dice la BASE: el servidor corre en UTC. */
async function hoyEnBogota(): Promise<string> {
  const [f] = await db.execute<{ hoy: string }>(
    sql`select (now() at time zone 'America/Bogota')::date::text as hoy`,
  );
  return f.hoy;
}

export async function leerModalidad(professionalId: string): Promise<ModalidadVigente> {
  const filas = await db.execute<{
    modality: string;
    valid_from: string;
    valid_to: string | null;
    decided_at: string;
  }>(sql`
    select modality, valid_from::text as valid_from, valid_to::text as valid_to,
           decided_at::text as decided_at
      from professional_modalities
     where professional_id = ${professionalId}::uuid
     order by valid_from desc`);

  const hoy = await hoyEnBogota();
  const vigencias = filas.map((f) => ({
    modality: f.modality as Modalidad,
    validFrom: f.valid_from,
    validTo: f.valid_to,
  }));

  // LA VIGENTE SE CALCULA CON LA REGLA, no con "la primera fila": una vigencia decidida hoy para el mes que
  // viene tiene `valid_to` nulo y ordena primero, y tomarla como vigente aplicaria el cambio hoy, que es
  // exactamente lo que el modelo prohibe.
  const modalidad = modalidadEnLaFecha(vigencias, hoy);
  const actual = filas.find((f) => f.valid_from <= hoy && (f.valid_to == null || f.valid_to >= hoy));
  const futura = filas.find((f) => f.valid_from > hoy);

  return {
    modalidad,
    proximoCorte: inicioDelSiguienteCorte(hoy, modalidad),
    rigeDesde: actual?.valid_from ?? null,
    pendiente: futura ? { modalidad: futura.modality as Modalidad, rigeDesde: futura.valid_from } : null,
    historial: filas.map((f) => ({
      modalidad: f.modality as Modalidad,
      desde: f.valid_from,
      hasta: f.valid_to,
      decidioEn: f.decided_at,
    })),
  };
}

/**
 * Cambia la modalidad, con efecto al inicio del siguiente corte de la modalidad QUE SE VA.
 *
 * Devuelve la fecha desde la que rige, para poder decirla: el cambio es contraintuitivo (se pulsa hoy y hoy
 * no pasa nada), y sin esa frase se lee como que el boton no funciono.
 */
export async function cambiarModalidad(input: {
  professionalId: string;
  hacia: Modalidad;
  actorId: string;
  actorEmail: string;
  requisitosVerificados: boolean;
  nota: string | null;
  ip: string | null;
}): Promise<{ rigeDesde: string }> {
  const estado = await leerModalidad(input.professionalId);
  if (estado.modalidad === input.hacia && estado.pendiente == null) {
    throw new ModalidadError(`Ya está en modalidad ${MODALIDAD_LABEL[input.hacia]}.`);
  }
  // LOS REQUISITOS DE DISTRIBUCION (modelo §2) NO los puede comprobar Atlas: dos de ellos (facturador
  // electronico habilitado ante la DIAN, estar al dia con CNV) viven fuera. Asi que no se simula la
  // verificacion: se EXIGE que admin declare que los verifico, y esa declaracion queda con su fecha.
  if (input.hacia === "distribucion" && !input.requisitosVerificados) {
    throw new ModalidadError(
      "Para pasar a Distribución hay que confirmar que verificaste los requisitos: responsable de IVA, facturador electrónico habilitado, cupo aceptado y al día con CNV.",
    );
  }

  const hoy = await hoyEnBogota();
  const rigeDesde = inicioDelSiguienteCorte(hoy, estado.modalidad);

  await db.transaction(async (tx) => {
    // ── EL ORDEN DE ESTOS DOS PASOS IMPORTA, y al reves revienta (lo atrapo su candado) ──
    //
    // PRIMERO SE BORRA LA DECISION FUTURA. Una vigencia futura tambien tiene `valid_to` nulo, asi que si se
    // cerrara antes, el UPDATE le pondria una fecha de cierre ANTERIOR a su propio inicio y la fila violaria
    // el CHECK de coherencia. Es el caso de pedir el cambio dos veces antes de que empiece.
    //
    // Y SE REEMPLAZA, no se acumula: si admin pidio Distribucion para octubre y cambia de opinion antes de
    // octubre, lo que queda es la ultima decision. Sin esto habria dos filas futuras y la del dia de corte
    // podria ser cualquiera de las dos.
    await tx.execute(sql`
      delete from professional_modalities
       where professional_id = ${input.professionalId}::uuid and valid_from > ${hoy}::date`);

    // DESPUES SE CIERRA LA VIGENTE. El `valid_to` es el dia ANTERIOR al inicio de la nueva: asi no hay un dia
    // sin modalidad ni un dia con dos, que es lo que el indice unico vigila. La condicion de fecha es un
    // candado de mas: solo se cierra lo que de verdad empezo antes que la nueva.
    await tx.execute(sql`
      update professional_modalities
         set valid_to = (${rigeDesde}::date - interval '1 day')::date
       where professional_id = ${input.professionalId}::uuid
         and valid_to is null
         and valid_from < ${rigeDesde}::date`);

    await tx.execute(sql`
      insert into professional_modalities
        (professional_id, modality, valid_from, decided_by, requisitos_verificados_at, note)
      values (${input.professionalId}::uuid, ${input.hacia}, ${rigeDesde}::date, ${input.actorId}::uuid,
              ${input.hacia === "distribucion" ? sql`now()` : sql`null`}, ${input.nota})`);

    // EL CAMBIO DE REGIMEN VA AL AUDIT, INLINE. Decide como se liquida el dinero de una persona, asi que
    // "quien lo cambio y cuando" no puede depender de que un bus entregue.
    await recordAudit(tx, {
      event: "modalidad.cambiada",
      entityType: "professional_profile",
      entityId: input.professionalId,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
      payload: {
        desde: estado.modalidad,
        hacia: input.hacia,
        rigeDesde,
        requisitosVerificados: input.requisitosVerificados,
        nota: input.nota,
      },
    });
  });

  return { rigeDesde };
}

export { MODALIDAD_POR_DEFECTO };
