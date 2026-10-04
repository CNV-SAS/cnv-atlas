import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { recordAudit } from "@/modules/audit/log";

// ═══ MARCAR UN PROFESIONAL COMO DE PRUEBA, DESDE LA PANTALLA (Santiago, 2026-10-04) ═══
//
// LA COLUMNA EXISTE DESDE LA 0199 y hasta hoy solo se escribia por SQL. Con pacientes si hay boton, y la
// asimetria se notaba justo cuando mas se usa: durante un smoke, alternando una cuenta entre real y de prueba.
//
// LO QUE ARRASTRA LA MARCA, y por eso no es un campo mas:
//   · sus ventas dejan de contar en las cifras (la columna derivada de la 0203 las recalcula sola);
//   · sus PACIENTES pasan a contar como de prueba, salvo los confirmados reales (trigger de la 0202);
//   · su vitrina sale del total de /direccion;
//   · y se le ofrecen los productos de prueba para cobrar y prescribir (2026-10-04).
//
// NO HAY QUE TOCAR NADA DE ESO AQUI: los triggers de la 0202 y la 0203 recalculan al cambiar `is_test`. Este
// escritor cambia UNA columna, y esa es justamente la razon por la que es seguro: si hubiera que actualizar a
// mano las ventas y los pacientes, cada olvido dejaria una cifra contando lo que no debe.
//
// SERVICE ROLE (drizzle) A PROPOSITO: es un acto de admin sobre la fila de otra persona, asi que la RLS del
// profesional no aplica. Lo que autoriza es la policy del lado del server, y el acto queda en el audit.

export class MarcaDeProfesionalError extends Error {}

/**
 * Marca o desmarca al profesional. `motivo` es obligatorio al MARCAR y opcional al revertir.
 *
 * POR QUE EL MOTIVO AL MARCAR: sacar a alguien de las cifras es exactamente lo que haria quien quiera esconder
 * un resultado malo. El motivo y el nombre de quien lo escribio son lo que distingue una cuenta de smoke de
 * eso, y por eso van al audit con el acto.
 */
export async function marcarProfesionalDePrueba(input: {
  professionalId: string;
  esDePrueba: boolean;
  motivo: string | null;
  actorId: string;
  actorEmail: string | null;
}): Promise<void> {
  if (input.esDePrueba && (input.motivo == null || input.motivo.trim().length < 5)) {
    throw new MarcaDeProfesionalError("Escribe por qué se marca como de prueba.");
  }

  await db.transaction(async (tx) => {
    const filas = await tx.execute<{ id: string; antes: boolean }>(sql`
      update professional_profiles
         set is_test = ${input.esDePrueba}
       where id = ${input.professionalId}::uuid
         and coalesce(is_test, false) is distinct from ${input.esDePrueba}
      returning id, not ${input.esDePrueba} as antes`);

    // SIN FILAS = YA ESTABA ASI. No es un error del sistema, pero tampoco se dice "listo": la pantalla
    // mostraria un exito sobre un acto que no ocurrio, y el audit quedaria sin su evento.
    if (filas.length === 0) {
      throw new MarcaDeProfesionalError(
        input.esDePrueba ? "Ese profesional ya estaba marcado de prueba." : "Ese profesional no estaba marcado.",
      );
    }

    await recordAudit(tx, {
      event: input.esDePrueba ? "profesional.marcado_de_prueba" : "profesional.desmarcado_de_prueba",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "professional_profile",
      entityId: input.professionalId,
      payload: { motivo: input.motivo },
    });
  });
}
