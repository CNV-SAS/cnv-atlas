import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { recordAudit } from "@/modules/audit/log";

// ═══ ELIMINAR EL PERFIL DE UN PACIENTE, CON QUIEN LO PIDIO Y QUIEN LO EJECUTO (v12 §1.2, 0233) ═══
//
// ── QUE ES ELIMINAR AQUI, Y QUE NO ES ─────────────────────────────────────────────────────────────
//
// Escribir `patients.deleted_at`. NO borra ninguna fila: la historia clinica se conserva 15 anos
// (`DATA_GOVERNANCE.md`, Resoluciones 1995/1999 y 839/2017), y el derecho al olvido se atiende por
// anonimizacion, no destruyendo evidencia. Lo que hace es sacarlo de TODAS las superficies de trabajo,
// porque esa columna ya la filtran once lectores.
//
// SE CONSERVA SU PALABRA ("eliminar perfil") Y SE DICE AL LADO QUE NO BORRA. La tentacion era llamarlo
// otra cosa, porque "eliminar" en cualquier otro sistema significa que la fila desaparece; pero el acto
// que el nombro es este, y renombrarlo haria que su instruccion y la pantalla no se parecieran. La
// pantalla dice lo que pasa de verdad en la misma frase del boton.
//
// Y NO ES LO MISMO QUE "ESTA CONSULTA NO OCURRIO" (`evaluations.retirada_at`, 0212), que esta a un nivel
// distinto y no se pisan: esa retira UNA consulta que no paso; esta saca al PACIENTE de las listas.
//
// ── LA ASIMETRIA (0180) ───────────────────────────────────────────────────────────────────────────
//
// El profesional PIDE con motivo; un ADMINISTRADOR ejecuta o niega (y no el rol `direccion`: en Atlas ese
// rol no accede a datos de paciente, y la policy lo explica). La razon esta en la 0180: eliminar saca al
// paciente de las cifras y de la cohorte, asi que *"quien se beneficia de la exclusion no puede
// autorizarla"*. El CHECK `patients_eliminacion_coherente` lo sostiene en la base: no hay `deleted_at`
// sin peticion, asi que la asimetria no se puede saltar ni escribiendo SQL a mano.
//
// ── EL DOCUMENTO SE ESCRIBE, Y ESO ES DE v12 ──────────────────────────────────────────────────────
//
// Su pieza que vale la pena portar tal cual: *"es irreversible, asi que no basta un «Aceptar»: hay que
// escribir el numero de documento del paciente"*. Se compara aqui, dentro de la transaccion, contra el
// documento de la fila: un `confirm()` en el navegador no distingue un clic de una decision, y una
// comparacion en la pantalla se salta llamando a la accion.
//
// LA ELIMINACION SI ES REVERSIBLE (`restituirAlPaciente`), y aun asi se pide el documento: lo que no es
// reversible es el tiempo que el paciente paso fuera de las listas, que es tiempo sin atender.

export class EliminacionDelPacienteError extends Error {}

export type PeticionDeEliminacion = {
  patientId: string;
  documento: string;
  nombre: string;
  motivo: string;
  pedidoEn: string;
  pedidoPor: string | null;
};

type Actor = {
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

/** El profesional pide la eliminación. No escribe `deleted_at`: el paciente sigue completo y a la vista. */
export async function pedirLaEliminacionDelPaciente(
  input: { patientId: string; motivo: string } & Actor,
): Promise<void> {
  const motivo = input.motivo.trim();
  // El minimo lo exige tambien el CHECK de la base; aqui se dice con palabras para que el profesional
  // sepa que corregir en vez de recibir un error de restriccion.
  if (motivo.length < 5) {
    throw new EliminacionDelPacienteError("Escribe por qué hay que eliminarlo (al menos cinco letras).");
  }

  await db.transaction(async (tx) => {
    const filas = await tx.execute<{ pedido: string | null; eliminado: string | null }>(sql`
      select eliminacion_pedida_at::text as pedido, deleted_at::text as eliminado
        from patients where id = ${input.patientId}::uuid`);
    const p = filas[0];
    if (!p) throw new EliminacionDelPacienteError("Ese paciente no existe.");
    if (p.eliminado != null) throw new EliminacionDelPacienteError("Ese paciente ya está eliminado.");
    if (p.pedido != null) {
      throw new EliminacionDelPacienteError("Ya hay una petición de eliminación esperando a un administrador.");
    }

    await tx.execute(sql`
      update patients
         set eliminacion_pedida_at = now(), eliminacion_pedida_por = ${input.actorId}::uuid,
             eliminacion_motivo = ${motivo}
       where id = ${input.patientId}::uuid`);

    await recordAudit(tx, {
      event: "paciente.eliminacion_pedida",
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
 * El administrador ejecuta o niega.
 *
 * NEGAR LIMPIA LA PETICION ENTERA, no solo la fecha: el CHECK exige que la peticion este completa o no
 * exista, y un motivo huerfano se leeria como que sigue esperando. El profesional puede volver a pedirlo
 * con otro motivo si se equivoco al escribirlo.
 */
export async function resolverLaEliminacion(
  input: { patientId: string; confirmar: boolean; documento: string } & Actor,
): Promise<void> {
  await db.transaction(async (tx) => {
    const filas = await tx.execute<{
      pedido: string | null;
      motivo: string | null;
      eliminado: string | null;
      documento: string;
    }>(sql`
      select eliminacion_pedida_at::text as pedido, eliminacion_motivo as motivo,
             deleted_at::text as eliminado, document_number as documento
        from patients where id = ${input.patientId}::uuid`);
    const p = filas[0];
    if (!p) throw new EliminacionDelPacienteError("Ese paciente no existe.");
    if (p.pedido == null) throw new EliminacionDelPacienteError("Ese paciente no tiene una petición de eliminación.");
    if (p.eliminado != null) throw new EliminacionDelPacienteError("Ese paciente ya está eliminado.");

    if (input.confirmar) {
      // EL DOCUMENTO, SOLO AL EJECUTAR. Negar deja todo como estaba, asi que pedirselo seria un tramite
      // sobre la salida segura, y eso empuja a confirmar por no escribir.
      if (input.documento.trim() !== p.documento) {
        throw new EliminacionDelPacienteError(
          "El documento no coincide con el del paciente. No se retiró a nadie.",
        );
      }
      await tx.execute(sql`
        update patients
           set deleted_at = now(), eliminado_por = ${input.actorId}::uuid
         where id = ${input.patientId}::uuid`);
    } else {
      await tx.execute(sql`
        update patients
           set eliminacion_pedida_at = null, eliminacion_pedida_por = null, eliminacion_motivo = null
         where id = ${input.patientId}::uuid`);
    }

    await recordAudit(tx, {
      event: input.confirmar ? "paciente.eliminado" : "paciente.eliminacion_negada",
      entityType: "patient",
      entityId: input.patientId,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
      // EL MOTIVO PEDIDO VIAJA AL ASIENTO. Al limpiarlo de la fila, el audit es el unico sitio donde
      // queda por que se pidio, y "se nego" sin saber que se habia pedido no se puede leer despues.
      payload: { motivoPedido: p.motivo },
    });
  });
}

/**
 * RESTITUIR: el paciente eliminado vuelve a las listas.
 *
 * EXISTE PORQUE ELIMINAR ES UNA DECISION HUMANA sobre una persona, y la unica salida de un error humano
 * es poder deshacerlo. Sin esto, una eliminacion por confusion de homonimos deja a alguien real sin atencion y
 * el unico camino seria un UPDATE a mano, que es exactamente lo que la 0233 vino a cerrar.
 *
 * SE LIMPIA TAMBIEN LA PETICION, porque el estado es lo que dicen las columnas: una peticion viva sobre un
 * paciente restituido volveria a ofrecerle la eliminacion al administrador sin que nadie lo pidiera de nuevo.
 * El rastro de las idas y venidas vive en `clinical_audit_log`, que no se borra.
 */
export async function restituirAlPaciente(
  input: { patientId: string } & Actor,
): Promise<void> {
  await db.transaction(async (tx) => {
    const filas = await tx.execute<{ eliminado: string | null; motivo: string | null }>(sql`
      select deleted_at::text as eliminado, eliminacion_motivo as motivo
        from patients where id = ${input.patientId}::uuid`);
    const p = filas[0];
    if (!p) throw new EliminacionDelPacienteError("Ese paciente no existe.");
    if (p.eliminado == null) throw new EliminacionDelPacienteError("Ese paciente no está eliminado.");

    await tx.execute(sql`
      update patients
         set deleted_at = null, eliminado_por = null,
             eliminacion_pedida_at = null, eliminacion_pedida_por = null, eliminacion_motivo = null
       where id = ${input.patientId}::uuid`);

    await recordAudit(tx, {
      event: "paciente.restituido",
      entityType: "patient",
      entityId: input.patientId,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
      payload: { motivoDelRetiro: p.motivo },
    });
  });
}

/**
 * Las peticiones que esperan a un administrador. Para la bandeja: sin esto, una peticion no la ve nadie.
 *
 * TRAE EL DOCUMENTO COMPLETO porque es lo que hay que escribir para ejecutar, y el NOMBRE porque la
 * decision es sobre una persona. Es la misma consulta que la bandeja de la 0180, con su misma forma.
 */
export async function peticionesDeEliminacionPendientes(): Promise<PeticionDeEliminacion[]> {
  const filas = await db.execute<{
    patient_id: string;
    documento: string;
    nombre: string;
    motivo: string;
    pedido_en: string;
    pedido_por: string | null;
  }>(sql`
    select p.id as patient_id,
           p.document_number as documento,
           coalesce(pp.first_name || ' ' || pp.last_name, '(sin nombre)') as nombre,
           p.eliminacion_motivo as motivo,
           p.eliminacion_pedida_at::text as pedido_en,
           pr.full_name as pedido_por
      from patients p
      left join patient_profiles pp on pp.patient_id = p.id
      left join profiles pr on pr.id = p.eliminacion_pedida_por
     where p.eliminacion_pedida_at is not null and p.deleted_at is null
     order by p.eliminacion_pedida_at asc`);
  return filas.map((f) => ({
    patientId: f.patient_id,
    documento: f.documento,
    nombre: f.nombre,
    motivo: f.motivo,
    pedidoEn: f.pedido_en,
    pedidoPor: f.pedido_por,
  }));
}

/**
 * Los pacientes ya eliminados, con quien lo pidio y quien lo ejecuto.
 *
 * PORQUE UN ELIMINADO NO SE VE EN NINGUNA PANTALLA, por construccion: once lectores lo filtran. Sin esta
 * lista, restituir a alguien exigiria conocer su id, y una eliminacion por error seria irreversible en la
 * practica aunque la funcion exista.
 */
export async function pacientesEliminados(): Promise<
  (PeticionDeEliminacion & { eliminadoEn: string; eliminadoPor: string | null })[]
> {
  const filas = await db.execute<{
    patient_id: string;
    documento: string;
    nombre: string;
    motivo: string;
    pedido_en: string;
    pedido_por: string | null;
    eliminado_en: string;
    eliminado_por: string | null;
  }>(sql`
    select p.id as patient_id,
           p.document_number as documento,
           coalesce(pp.first_name || ' ' || pp.last_name, '(sin nombre)') as nombre,
           p.eliminacion_motivo as motivo,
           p.eliminacion_pedida_at::text as pedido_en,
           pedidor.full_name as pedido_por,
           p.deleted_at::text as eliminado_en,
           ejecutor.full_name as eliminado_por
      from patients p
      left join patient_profiles pp on pp.patient_id = p.id
      left join profiles pedidor on pedidor.id = p.eliminacion_pedida_por
      left join profiles ejecutor on ejecutor.id = p.eliminado_por
     where p.deleted_at is not null
     order by p.deleted_at desc`);
  return filas.map((f) => ({
    patientId: f.patient_id,
    documento: f.documento,
    nombre: f.nombre,
    motivo: f.motivo,
    pedidoEn: f.pedido_en,
    pedidoPor: f.pedido_por,
    eliminadoEn: f.eliminado_en,
    eliminadoPor: f.eliminado_por,
  }));
}
