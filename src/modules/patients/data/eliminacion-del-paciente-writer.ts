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
// ── EL DOCUMENTO TECLEADO SALIO EL 2026-11-05, Y LA RAZON ES DE SANTIAGO ──────────────────────────
//
// *"Fuera la cedula tecleada: era para un acto irreversible, y este se deshace. La bandeja queda con dos
// botones: Aprobar y Rechazar."*
//
// LA PIEZA VENIA DE v12 (*"es irreversible, asi que no basta un «Aceptar»: hay que escribir el numero de
// documento del paciente"*) y se porto con su argumento entero. EL ARGUMENTO TENIA UN SUPUESTO FALSO EN
// ATLAS: aqui eliminar NO es irreversible. Escribe `deleted_at`, no borra ninguna fila, y
// `restituirAlPaciente` lo deshace. Su frase describe un borrado de verdad, y este no lo es.
//
// Y LO QUE ESTABA ESCRITO AQUI PARA DEFENDERLO ERA JUSTO LO QUE LO DESMONTABA: decia que se pedia el
// documento porque *"lo que no es reversible es el tiempo que el paciente paso fuera de las listas"*. Eso
// es cierto y NO es lo que v12 justificaba: un tramite de copiar un numero no acorta ese tiempo, lo
// alarga. Y su coste real era el de cualquier freno de esta clase: empuja a quien tiene prisa a pulsar la
// salida que no lo pide.
//
// LO QUE SOSTIENE LA DECISION SIGUE EN PIE, y no es un campo de texto: la ASIMETRIA (el profesional pide,
// un administrador resuelve), el CHECK de la base, el motivo obligatorio, el audit con nombre y fecha, y
// que se pueda restituir.

export class EliminacionDelPacienteError extends Error {}

/**
 * SIN `documento` desde el 2026-11-05. Lo traia para poder TECLEARLO al ejecutar, y ninguna pantalla lo
 * mostraba (a proposito: con el numero al lado del campo, escribirlo seria copiarlo). Al salir ese paso,
 * el campo quedaba viajando del servidor al cliente sin que nada lo leyera, y es el documento de un
 * paciente.
 */
export type PeticionDeEliminacion = {
  patientId: string;
  nombre: string;
  motivo: string;
  pedidoEn: string;
  pedidoPor: string | null;
};

/**
 * UNA PETICION MAS LO QUE DEJA DE CONTAR SI SE APRUEBA (Santiago, 2026-11-08).
 *
 * Las tres cifras van juntas porque contestan la misma pregunta ("¿que se lleva por delante este
 * acto?") y por separado no se entienden: un paciente con tres consultas diagnosticadas y ninguna en la
 * cohorte no es el mismo caso que el contrario.
 *
 * ES UN TIPO APARTE Y NO TRES CAMPOS MAS EN EL DE ARRIBA: la lista de ELIMINADOS usa el mismo tipo y
 * ahi estas cifras no sirven para nada (el acto ya se hizo; lo que hace falta alli es poder
 * restituirlo, que ya esta). Tres campos que una de las dos listas tendria que rellenar con ceros son
 * tres cifras inventadas, y una cifra inventada se ve igual que una buena.
 */
export type PeticionConConsecuencias = PeticionDeEliminacion & {
  diagnosticadas: number;
  informesEnviados: number;
  enLaCohorte: number;
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
  input: { patientId: string; confirmar: boolean } & Actor,
): Promise<void> {
  await db.transaction(async (tx) => {
    // SE LEE QUIEN LO PIDIO, no su documento: lo primero va al asiento de auditoria (ver abajo) y lo
    // segundo ya no hace falta para nada. Una consulta que trae PII que nadie usa es PII de mas.
    const filas = await tx.execute<{
      pedido: string | null;
      motivo: string | null;
      eliminado: string | null;
      pedido_por: string | null;
    }>(sql`
      select p.eliminacion_pedida_at::text as pedido, p.eliminacion_motivo as motivo,
             p.deleted_at::text as eliminado, pedidor.full_name as pedido_por
        from patients p
        left join profiles pedidor on pedidor.id = p.eliminacion_pedida_por
       where p.id = ${input.patientId}::uuid`);
    const p = filas[0];
    if (!p) throw new EliminacionDelPacienteError("Ese paciente no existe.");
    if (p.pedido == null) throw new EliminacionDelPacienteError("Ese paciente no tiene una petición de eliminación.");
    if (p.eliminado != null) throw new EliminacionDelPacienteError("Ese paciente ya está eliminado.");

    if (input.confirmar) {
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
      // ═══ EL ASIENTO LLEVA EL MOTIVO Y QUIEN LO PIDIO (Santiago, 2026-11-05) ═══
      //
      // *"La auditoria dice motivoPedido. Que diga tambien quien lo pidio y, si se rechaza, quien lo
      // rechazo."*
      //
      // QUIEN LO PIDIO ERA EL HUECO DE VERDAD, y por una razon que no se ve: al RECHAZAR se limpia la
      // peticion entera de la fila (`eliminacion_pedida_por` incluido, porque el CHECK exige que la
      // peticion este completa o no exista). Asi que despues de un rechazo el nombre de quien lo pidio no
      // estaba en ningun sitio legible junto al rechazo: habia que ir a buscar el evento
      // `paciente.eliminacion_pedida` de antes y cruzarlo por el id del paciente.
      //
      // QUIEN LO RESOLVIO YA ESTABA, y conviene decirlo para que nadie lo anada dos veces: es el ACTOR
      // del evento (`actor_id` y `actor_email` de esta misma fila del log). Repetirlo en el payload
      // seria el mismo dato en dos campos que pueden divergir, y el de la columna es el que no se puede
      // falsear. El evento dice lo que paso (`eliminado` o `eliminacion_negada`) y la columna dice quien.
      payload: { motivoPedido: p.motivo, pedidoPor: p.pedido_por },
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
 * TRAE EL NOMBRE porque la decision es sobre una persona, y el MOTIVO porque es lo unico con lo que se
 * puede decidir. Es la misma consulta que la bandeja de la 0180, con su misma forma.
 */
export async function peticionesDeEliminacionPendientes(): Promise<PeticionConConsecuencias[]> {
  const filas = await db.execute<{
    patient_id: string;
    nombre: string;
    motivo: string;
    pedido_en: string;
    pedido_por: string | null;
    diagnosticadas: number;
    informes_enviados: number;
    en_la_cohorte: number;
  }>(sql`
    select p.id as patient_id,
           coalesce(pp.first_name || ' ' || pp.last_name, '(sin nombre)') as nombre,
           p.eliminacion_motivo as motivo,
           p.eliminacion_pedida_at::text as pedido_en,
           pr.full_name as pedido_por,
           -- ═══ LO QUE SE VA A DEJAR DE CONTAR, CONTADO  ·  Santiago, 2026-11-08 ═══
           --
           -- La bandeja mostraba nombre, motivo y quien lo pidio: con eso, quien aprueba decide SIN VER
           -- LA CONSECUENCIA. Y la consecuencia no es que se borre algo (no se borra nada): es que esas
           -- consultas salen de las pantallas y de la cohorte de investigacion, o sea que el "n" de un
           -- articulo cambia por un acto administrativo que nadie relaciono con el.
           --
           -- CONSULTAS DIAGNOSTICADAS, no filas de diagnostico: una reemision añade fila y no añade
           -- consulta, asi que contar filas inflaria la cifra justo despues de un recalculo.
           (select count(distinct e.id) from evaluations e
              join diagnoses d on d.evaluation_id = e.id
             where e.patient_id = p.id)::int as diagnosticadas,
           (select count(*) from reports r
             where r.patient_id = p.id and r.sent_at is not null)::int as informes_enviados,
           -- Y LA COHORTE SE PREGUNTA A LA VISTA, no se reconstruye aqui: sus tres condiciones
           -- (autorizacion de investigacion vigente, huella no repetida, no menor al medirse) viven ahi.
           (select count(*) from public.evaluaciones_para_investigacion v
             where v.patient_id = p.id)::int as en_la_cohorte
      from patients p
      left join patient_profiles pp on pp.patient_id = p.id
      left join profiles pr on pr.id = p.eliminacion_pedida_por
     where p.eliminacion_pedida_at is not null and p.deleted_at is null
     order by p.eliminacion_pedida_at asc`);
  return filas.map((f) => ({
    patientId: f.patient_id,
    nombre: f.nombre,
    motivo: f.motivo,
    pedidoEn: f.pedido_en,
    pedidoPor: f.pedido_por,
    diagnosticadas: Number(f.diagnosticadas),
    informesEnviados: Number(f.informes_enviados),
    enLaCohorte: Number(f.en_la_cohorte),
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
    nombre: string;
    motivo: string;
    pedido_en: string;
    pedido_por: string | null;
    eliminado_en: string;
    eliminado_por: string | null;
  }>(sql`
    select p.id as patient_id,
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
    nombre: f.nombre,
    motivo: f.motivo,
    pedidoEn: f.pedido_en,
    pedidoPor: f.pedido_por,
    eliminadoEn: f.eliminado_en,
    eliminadoPor: f.eliminado_por,
  }));
}
