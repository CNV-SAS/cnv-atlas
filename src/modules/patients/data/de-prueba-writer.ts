import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { recordAudit } from "@/modules/audit/log";

// ═══ MARCAR UN PACIENTE COMO DE PRUEBA: EL PROFESIONAL PROPONE, ADMIN CONFIRMA (0180, 2026-09-25) ═══
//
// LA ASIMETRIA NO ES BUROCRACIA. Marcar a alguien como de prueba lo SACA DE LAS CIFRAS. Si un profesional
// pudiera marcar solo, tendria la forma de esconder pacientes reales (los que no le cuadran, los que no quiere
// que se vean en su conteo) sin que nadie lo revise. Es la misma asimetria que Santiago pidio para el borrado, y
// por la misma razon: quien se beneficia de la exclusion no puede autorizarla.
//
// SERVICE ROLE (drizzle) A PROPOSITO en la confirmacion: es un acto de admin sobre la fila de un paciente que
// puede no ser suyo. Lo que autoriza es la policy del lado del server, y el acto queda en el audit.
//
// ── POR QUE MARCAR Y NO BORRAR (decision de Santiago, carril 1) ──
//
// El caso mas comun es el profesional que se creo a si mismo como paciente y corrio un diagnostico completo, y
// ESE NO SE PUEDE BORRAR: un diagnostico confirmado es una firma clinica y la base lo bloquea con un trigger.
// Marcar resuelve el problema entero ("que no contaminen la data") para TODOS los casos, incluidos los que
// nunca van a poder borrarse, y deja la puerta abierta a borrar de verdad despues.

export class MarcaDePruebaError extends Error {}

export type PropuestaDePrueba = {
  patientId: string;
  documento: string;
  nombre: string;
  motivo: string;
  propuestoEn: string;
  propuestoPor: string | null;
};

/** El profesional propone. No cambia `is_test`: mientras admin no confirme, el paciente sigue contando. */
export async function proponerPacienteDePrueba(input: {
  patientId: string;
  motivo: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<void> {
  const motivo = input.motivo.trim();
  // El minimo lo exige tambien el CHECK de la base; aqui se dice con palabras para que el profesional sepa
  // que corregir en vez de recibir un error de restriccion.
  if (motivo.length < 5) {
    throw new MarcaDePruebaError("Escribe por qué es de prueba (al menos cinco letras).");
  }

  await db.transaction(async (tx) => {
    const filas = await tx.execute<{ id: string; is_test: boolean }>(sql`
      select id, is_test from patients where id = ${input.patientId}::uuid and deleted_at is null`);
    const paciente = filas[0];
    if (!paciente) throw new MarcaDePruebaError("Ese paciente no existe.");
    if (paciente.is_test) throw new MarcaDePruebaError("Ese paciente ya está marcado como de prueba.");

    await tx.execute(sql`
      update patients
         set test_proposed_at = now(), test_proposed_by = ${input.actorId}::uuid,
             test_proposed_reason = ${motivo}
       where id = ${input.patientId}::uuid`);

    await recordAudit(tx, {
      event: "paciente.propuesto_de_prueba",
      entityType: "patient",
      entityId: input.patientId,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
      payload: { motivo },
    });
  });
}

/**
 * Admin confirma o rechaza.
 *
 * CONFIRMAR ES LO QUE SACA AL PACIENTE DE LAS CIFRAS, asi que va al audit inline y con quien lo hizo. Rechazar
 * limpia la propuesta: el paciente vuelve a ser normal y el profesional puede volver a proponerlo con otro
 * motivo si se equivoco al escribirlo.
 */
export async function resolverPropuestaDePrueba(input: {
  patientId: string;
  confirmar: boolean;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const filas = await tx.execute<{ propuesto: string | null; motivo: string | null; is_test: boolean }>(sql`
      select test_proposed_at::text as propuesto, test_proposed_reason as motivo, is_test
        from patients where id = ${input.patientId}::uuid and deleted_at is null`);
    const p = filas[0];
    if (!p) throw new MarcaDePruebaError("Ese paciente no existe.");
    if (p.propuesto == null) throw new MarcaDePruebaError("Ese paciente no tiene una propuesta pendiente.");

    if (input.confirmar) {
      await tx.execute(sql`
        update patients
           set is_test = true, test_marked_at = now(), test_marked_by = ${input.actorId}::uuid
         where id = ${input.patientId}::uuid`);
    } else {
      // SE LIMPIA LA PROPUESTA ENTERA, no solo la fecha: el CHECK exige que las tres columnas vayan juntas, y
      // dejar el motivo huerfano haria creer que sigue pendiente.
      await tx.execute(sql`
        update patients
           set test_proposed_at = null, test_proposed_by = null, test_proposed_reason = null
         where id = ${input.patientId}::uuid`);
    }

    await recordAudit(tx, {
      event: input.confirmar ? "paciente.marcado_de_prueba" : "paciente.propuesta_de_prueba_rechazada",
      entityType: "patient",
      entityId: input.patientId,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
      payload: { motivoPropuesto: p.motivo },
    });
  });
}

/**
 * Desmarcar: un paciente real que se marco por error vuelve a contar.
 *
 * SOLO ADMIN, y por la razon simetrica: si el profesional pudiera desmarcar, podria meter a las cifras un
 * paciente que no existe. Se conserva el rastro del acto en el audit; las columnas de la marca se limpian
 * porque el estado es lo que dicen, y un `test_marked_at` sin `is_test` seria un estado imposible.
 */
export async function desmarcarPacienteDePrueba(input: {
  patientId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const filas = await tx.execute<{ is_test: boolean }>(sql`
      select is_test from patients where id = ${input.patientId}::uuid and deleted_at is null`);
    if (!filas[0]) throw new MarcaDePruebaError("Ese paciente no existe.");
    if (!filas[0].is_test) throw new MarcaDePruebaError("Ese paciente no está marcado como de prueba.");

    await tx.execute(sql`
      update patients
         set is_test = false, test_marked_at = null, test_marked_by = null,
             test_proposed_at = null, test_proposed_by = null, test_proposed_reason = null
       where id = ${input.patientId}::uuid`);

    await recordAudit(tx, {
      event: "paciente.desmarcado_de_prueba",
      entityType: "patient",
      entityId: input.patientId,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
      payload: {},
    });
  });
}

/** Las propuestas que esperan a admin. Para la bandeja: sin esto, una propuesta no la ve nadie. */
export async function propuestasDePruebaPendientes(): Promise<PropuestaDePrueba[]> {
  const filas = await db.execute<{
    patient_id: string;
    documento: string;
    nombre: string;
    motivo: string;
    propuesto_en: string;
    propuesto_por: string | null;
  }>(sql`
    select p.id as patient_id,
           p.document_type::text || ' ' || p.document_number as documento,
           coalesce(pp.first_name || ' ' || pp.last_name, '(sin nombre)') as nombre,
           p.test_proposed_reason as motivo,
           p.test_proposed_at::text as propuesto_en,
           pr.full_name as propuesto_por
      from patients p
      left join patient_profiles pp on pp.patient_id = p.id
      left join profiles pr on pr.id = p.test_proposed_by
     where p.test_proposed_at is not null and p.is_test = false and p.deleted_at is null
     order by p.test_proposed_at asc`);
  return filas.map((f) => ({
    patientId: f.patient_id,
    documento: f.documento,
    nombre: f.nombre,
    motivo: f.motivo,
    propuestoEn: f.propuesto_en,
    propuestoPor: f.propuesto_por,
  }));
}

/**
 * MARCA UN PACIENTE DE PRUEBA DIRECTAMENTE, sin esperar una propuesta (Santiago, 2026-10-01).
 *
 * POR QUE HACIA FALTA: el unico camino era "el profesional propone, admin confirma", y eso sirve para el
 * paciente que YA existe en la lista de alguien que lo reconoce. No sirve para lo que Santiago necesita:
 * limpiar de golpe los pacientes de una cuenta de demostracion, donde el profesional no va a proponer nada
 * porque no va a volver a entrar.
 *
 * SIGUE SIENDO DECISION DE ADMIN y queda auditada igual. Lo que se salta es la propuesta, no el registro.
 *
 * Y EL MOTIVO ES OBLIGATORIO. Marcar un paciente lo saca de TODAS las cifras (desde hoy, tambien de su
 * dinero), asi que seis meses despues alguien va a preguntar por que esa venta no cuenta. Sin motivo, la
 * respuesta seria "porque alguien lo marco".
 */
export async function marcarPacienteDePruebaDirecto(input: {
  patientId: string;
  motivo: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<void> {
  const motivo = input.motivo.trim();
  if (motivo.length < 5) {
    throw new MarcaDePruebaError("Escribe por qué es de prueba (al menos cinco letras).");
  }
  await db.transaction(async (tx) => {
    const filas = await tx.execute<{ is_test: boolean }>(sql`
      select is_test from patients where id = ${input.patientId}::uuid and deleted_at is null`);
    if (!filas[0]) throw new MarcaDePruebaError("Ese paciente no existe.");
    if (filas[0].is_test) throw new MarcaDePruebaError("Ese paciente ya está marcado como de prueba.");

    // EL MOTIVO SE GUARDA EN LA COLUMNA DE LA PROPUESTA, y no es un atajo: el CHECK de la 0181 exige que las
    // tres de la propuesta vayan juntas, y es el unico sitio donde vive un motivo de esta marca. Quien lo
    // escribio es admin, y eso queda en `test_proposed_by` y en el log.
    await tx.execute(sql`
      update patients
         set is_test = true, test_marked_at = now(), test_marked_by = ${input.actorId}::uuid,
             test_proposed_at = now(), test_proposed_by = ${input.actorId}::uuid,
             test_proposed_reason = ${motivo}
       where id = ${input.patientId}::uuid`);

    await recordAudit(tx, {
      event: "paciente.marcado_de_prueba",
      entityType: "patient",
      entityId: input.patientId,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
      payload: { motivo, directo: true },
    });
  });
}

/**
 * LA SALIDA DE LA DERIVACION: este paciente SI es real aunque su profesional sea de prueba (0202).
 *
 * NO ES LO MISMO QUE DESMARCAR. Desmarcar quita una decision que alguien tomo; esto contradice una
 * DEDUCCION. Un paciente derivado no tiene marca propia que quitar, asi que sin esto su unica salida habria
 * sido desmarcar al profesional, que arrastraria a los otros quince.
 *
 * El trigger de la 0202 recalcula solo: basta escribir la columna.
 */
export async function confirmarPacienteReal(input: {
  patientId: string;
  confirmar: boolean;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const filas = await tx.execute<{ is_test: boolean }>(sql`
      select is_test from patients where id = ${input.patientId}::uuid and deleted_at is null`);
    if (!filas[0]) throw new MarcaDePruebaError("Ese paciente no existe.");
    // EL CHECK DE LA BASE LO IMPEDIRIA IGUAL, pero el mensaje de aqui dice QUE hacer: un paciente marcado a
    // mano se desmarca, no se confirma como real. Dos caminos para lo mismo serian dos verdades posibles.
    if (input.confirmar && filas[0].is_test) {
      throw new MarcaDePruebaError(
        "Ese paciente está marcado de prueba a mano. Quita esa marca en vez de confirmarlo como real.",
      );
    }

    await tx.execute(sql`
      update patients set es_real_confirmado = ${input.confirmar}
       where id = ${input.patientId}::uuid`);

    await recordAudit(tx, {
      event: input.confirmar ? "paciente.confirmado_real" : "paciente.confirmacion_real_retirada",
      entityType: "patient",
      entityId: input.patientId,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
      payload: {},
    });
  });
}
