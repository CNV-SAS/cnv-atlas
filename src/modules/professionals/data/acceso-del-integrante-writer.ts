import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/modules/audit/log";

import { loQueQuedaAbierto, type LoQueQuedaAbierto } from "./lo-que-queda-abierto";

// ═══ QUITARLE EL ACCESO A UN INTEGRANTE, SIN BORRAR SU CUENTA (Gildardo, 2026-10-25) ═══
//
// ── QUE HABIA, Y POR QUE NO SERVIA ────────────────────────────────────────────────────────────────────
//
// La regla dura 14 dice "offboarding = desactivar y reasignar", y la mitad de REASIGNAR se construyó el
// 2026-10-23. La de DESACTIVAR existía a medias, que es peor que no existir porque se lee como construida:
// `profiles.status` desde la 0000, `requireUser()` echando al inactivo, y una server action `deactivateUser`
// QUE NO LLAMABA NADIE, sin motivo, sin vuelta atrás y sin pantalla. Se inactivaba por UPDATE a mano.
//
// ── LAS TRES MITADES QUE HACEN QUE DE VERDAD PIERDA EL ACCESO ────────────────────────────────────────
//
// Ninguna sola alcanza, y cada una cubre el hueco de la anterior:
//
//   1 · EL ESTADO EN LA BASE (`status = 'inactive'` + motivo + quién + cuándo, 0229). Es la verdad del
//       dominio y de ella salen las pantallas. Sin esto, las otras dos son un parche en el borde.
//   2 · LA SESIÓN REVOCADA (`ban_duration` en Supabase Auth). Sin esto puede volver a entrar: `requireUser`
//       lo echa de las pantallas, pero el `signInWithPassword` funciona, y el bucle "entro y me saca" se
//       siente como un defecto del sistema, no como una decisión.
//   3 · LA RLS (`cuenta_activa()` dentro de `has_role` y de `is_patient_professional`, 0229). Es la que
//       cubre la hora en la que su token de acceso ya emitido sigue siendo válido: la anon key es pública,
//       así que sin esta mitad una llamada directa a la API seguía pasando las policies.
//
// ── LO QUE NO SE TOCA, Y ES DELIBERADO ───────────────────────────────────────────────────────────────
//
// Sus pacientes siguen siendo suyos (reasignarlos es el otro acto, con su motivo y su rastro), se le sigue
// debiendo su margen, su vitrina sigue en su custodia y sus enlaces ya repartidos siguen sirviendo. Quitar
// el acceso no cierra una cuenta corriente, y hacer las dos cosas en un clic dejaría un paciente movido sin
// que nadie lo decidiera.
//
// POR ESO EL ASIENTO LLEVA EL RETRATO DE LO QUE QUEDÓ ABIERTO: dentro de un año, "se le quitó el acceso" no
// contesta "¿y qué pasó con sus 25 pacientes?". Con el retrato, sí.
//
// SERVICE ROLE (drizzle) A PROPÓSITO: es un acto de admin sobre la fila de otra persona. Lo que autoriza es
// la policy del lado del servidor, y el acto queda en el audit log, inline en la transacción (regla dura 8).

export class AccesoDelIntegranteError extends Error {}

/** 100 años. Supabase no tiene "para siempre"; `none` es lo que levanta el bloqueo al reactivar. */
const BLOQUEO_SIN_FECHA = "876000h";

export type ResultadoDelAcceso = {
  /** Lo que quedó abierto en el momento del acto. Es lo que la pantalla repite después de confirmar. */
  abierto: LoQueQuedaAbierto;
  /**
   * La sesión NO se pudo revocar en Supabase Auth. El estado en la base sí quedó, así que `requireUser` ya
   * lo echa de las pantallas; lo que queda sin cerrar es que pueda volver a iniciar sesión (y rebotar).
   *
   * SE DEVUELVE EN VEZ DE REVENTAR: el acto de dominio ya está hecho y revertirlo por un fallo del servicio
   * de auth dejaría a alguien con acceso creyendo que se le quitó. Pero se DICE, porque un aviso de éxito
   * sobre medio acto es exactamente lo que hace que nadie vuelva a mirar.
   */
  sesionSinRevocar: boolean;
};

export async function inactivarIntegrante(input: {
  /** `profiles.id`, que es el usuario de auth. El estado vive en el perfil, no en el perfil profesional. */
  usuarioId: string;
  /** `professional_profiles.id`. Solo para el retrato de lo que queda abierto. */
  professionalId: string;
  motivo: string;
  actorId: string;
  actorEmail: string | null;
}): Promise<ResultadoDelAcceso> {
  const motivo = input.motivo.trim();
  if (motivo.length < 10) {
    throw new AccesoDelIntegranteError("Escribe por qué se le quita el acceso (al menos 10 caracteres).");
  }
  if (input.usuarioId === input.actorId) {
    throw new AccesoDelIntegranteError("No puedes quitarte el acceso a ti mismo.");
  }

  // EL RETRATO SE TOMA ANTES DEL CAMBIO, y es a propósito: `llegadosDespues` se mide contra la fecha de
  // inactivación, así que leerlo después daría cero siempre y el asiento diría que no quedaba nada abierto.
  const abierto = await loQueQuedaAbierto(input.professionalId, null);

  await db.transaction(async (tx) => {
    const filas = await tx.execute<{ id: string }>(sql`
      update profiles
         set status = 'inactive',
             inactivo_desde = now(),
             inactivado_por = ${input.actorId}::uuid,
             inactivacion_motivo = ${motivo}
       where id = ${input.usuarioId}::uuid
         and status = 'active'
      returning id`);

    // SIN FILAS: o no existe, o ya estaba inactivo. No se dice "listo" en ninguno de los dos casos, porque
    // sería un éxito sobre un acto que no ocurrió, y el audit quedaría sin su evento.
    if (filas.length === 0) {
      throw new AccesoDelIntegranteError("Esa cuenta no existe o ya estaba inactiva.");
    }

    await recordAudit(tx, {
      event: "user.deactivated",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "profile",
      entityId: input.usuarioId,
      payload: { motivo, abierto },
    });
  });

  return { abierto, sesionSinRevocar: !(await bloquearEnAuth(input.usuarioId, true)) };
}

export async function reactivarIntegrante(input: {
  usuarioId: string;
  professionalId: string;
  motivo: string;
  actorId: string;
  actorEmail: string | null;
}): Promise<ResultadoDelAcceso> {
  const motivo = input.motivo.trim();
  if (motivo.length < 10) {
    throw new AccesoDelIntegranteError("Escribe por qué se le devuelve el acceso (al menos 10 caracteres).");
  }

  // EL RETRATO, CON LA FECHA DE INACTIVACION TODAVIA PUESTA: así el asiento de la reactivación dice cuántos
  // pacientes le llegaron mientras estuvo sin acceso, que es justo lo que hay que revisar al devolvérselo.
  const [antes] = await db.execute<{ inactivo_desde: string | null }>(sql`
    select inactivo_desde::text from profiles where id = ${input.usuarioId}::uuid`);
  const abierto = await loQueQuedaAbierto(input.professionalId, antes?.inactivo_desde ?? null);

  await db.transaction(async (tx) => {
    const filas = await tx.execute<{ id: string }>(sql`
      update profiles
         set status = 'active',
             inactivo_desde = null,
             inactivado_por = null,
             inactivacion_motivo = null
       where id = ${input.usuarioId}::uuid
         and status = 'inactive'
      returning id`);
    if (filas.length === 0) {
      throw new AccesoDelIntegranteError("Esa cuenta no existe o ya estaba activa.");
    }

    await recordAudit(tx, {
      event: "user.reactivated",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "profile",
      entityId: input.usuarioId,
      payload: { motivo, abierto },
    });
  });

  return { abierto, sesionSinRevocar: !(await bloquearEnAuth(input.usuarioId, false)) };
}

/**
 * Bloquea o desbloquea la cuenta en Supabase Auth. FUERA de la transacción, porque es una llamada externa:
 * dejarla dentro ataría el estado del dominio a la latencia de otro servicio.
 *
 * Devuelve si lo logró. No lanza: quien llama decide qué hacer con un fallo, y aquí la respuesta es
 * decírselo a quien pulsó, no revertir el acto.
 */
async function bloquearEnAuth(usuarioId: string, bloquear: boolean): Promise<boolean> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.updateUserById(usuarioId, {
      ban_duration: bloquear ? BLOQUEO_SIN_FECHA : "none",
    });
    return !error;
  } catch {
    return false;
  }
}
