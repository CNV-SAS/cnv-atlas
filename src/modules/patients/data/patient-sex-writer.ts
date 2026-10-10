import "server-only";

import { and, eq, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { patientProfiles } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// COMPLETAR EL SEXO DE UN PACIENTE AL QUE LE FALTA.
//
// ── POR QUE HACE FALTA UN ESCRITOR PARA ESTO (Sentry, 2026-10-10) ──────────────────────────────────
//
// Porque habia pacientes sin sexo y NINGUN camino para ponerlo. El intake lo exige estricto
// (`z.enum(["F","M"])`), pero el import del HTML lo mapea desde la palabra que trae el archivo y devuelve
// null cuando no la reconoce, y el seguimiento no vuelve a tocar el perfil. Resultado: una paciente sin
// sexo, su diagnostico imposible, y el unico remedio era un script contra la base.
//
// ── RELLENA UN HUECO, NUNCA PISA UN VALOR, Y ESO LO IMPONE EL `where` ──────────────────────────────
//
// El `update` lleva en su propia condicion que el sexo este VACIO. No es una comprobacion previa que luego
// se escribe: entre leer y escribir cabe otra escritura, y esta es justo la clase de dato donde eso no
// puede pasar. Si ya habia un sexo, no se actualiza ninguna fila y la funcion devuelve `false`.
//
// Y LA RAZON DE FONDO no es prudencia: cambiar el sexo de un paciente con diagnostico SELLADO invalidaria
// el sellado, y un sellado no se recalcula (ver `normalize-patient-sex.mjs`). Esa es otra decision, con su
// propio bloque; esto solo cierra el hueco de que falte.
//
// ── Y QUEDA EN EL RASTRO CLINICO, inline en la transaccion (regla dura 8) ──────────────────────────
//
// El sexo decide TODAS las clasificaciones del motor, asi que quien lo registro y cuando es parte de la
// historia del diagnostico, no un detalle administrativo.
export type SexoDelPaciente = { patientId: string; sex: "F" | "M" };

export type ActorDelSexo = {
  actorId: string;
  actorEmail: string | null;
  ip?: string | null;
};

/** `true` si lo escribio; `false` si el paciente ya tenia un sexo registrado y no se toco nada. */
export async function completarSexoDelPaciente(
  { patientId, sex }: SexoDelPaciente,
  actor: ActorDelSexo,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [escrito] = await tx
      .update(patientProfiles)
      .set({ sex })
      .where(
        and(
          eq(patientProfiles.patientId, patientId),
          // VACIO ES null O CADENA EN BLANCO. Las dos existen en la base: el import del HTML dejo nulls, y
          // el intake viejo de texto libre pudo dejar blancos. Mirar solo `isNull` dejaria al segundo sin
          // arreglo posible y la pantalla diria "guardado" sin haber guardado nada.
          or(sql`${patientProfiles.sex} is null`, sql`btrim(${patientProfiles.sex}) = ''`),
        ),
      )
      .returning({ patientId: patientProfiles.patientId });
    if (!escrito) return false;

    await recordAudit(tx, {
      event: "patient.sexo_completado",
      actorId: actor.actorId,
      actorEmail: actor.actorEmail,
      entityType: "patient",
      entityId: patientId,
      // El valor SI va al rastro: es el insumo que decide las clasificaciones, no un dato de contacto.
      payload: { sexo: sex, estaba: "vacio" },
      ip: actor.ip ?? null,
    });
    return true;
  });
}
