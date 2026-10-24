import "server-only";

import { and, asc, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { professionalProfiles, profiles } from "@/db/schema";

// LOS PROFESIONALES A LOS QUE SE PUEDE REASIGNAR UN PACIENTE.
//
// SE EXCLUYEN TRES COSAS, y cada una por su razon:
//   · LAS CUENTAS DE PRUEBA: reasignar a una dejaria al paciente fuera de todas las cifras por el trigger
//     de la 0202, en silencio. El writer tambien lo rechaza; aqui ni se ofrece.
//   · LAS CUENTAS INACTIVAS: la regla dura 14 es "desactivar y reasignar". Ofrecer como destino a alguien
//     que ya se fue es exactamente el movimiento que esa regla existe para impedir.
//   · EL PROFESIONAL DE ORIGEN: reasignar a quien ya lo tiene no es una reasignacion.
export type ProfesionalDestino = { id: string; nombre: string; profesion: string | null };

export async function profesionalesParaReasignar(
  exceptoProfessionalId?: string,
): Promise<ProfesionalDestino[]> {
  const filas = await db
    .select({
      id: professionalProfiles.id,
      nombre: profiles.fullName,
      profesion: professionalProfiles.profession,
    })
    .from(professionalProfiles)
    .innerJoin(profiles, eq(profiles.id, professionalProfiles.profileId))
    .where(
      and(
        eq(professionalProfiles.isTest, false),
        eq(profiles.status, "active"),
        exceptoProfessionalId ? ne(professionalProfiles.id, exceptoProfessionalId) : undefined,
      ),
    )
    .orderBy(asc(profiles.fullName));

  return filas.map((f) => ({ id: f.id, nombre: f.nombre ?? "(sin nombre)", profesion: f.profesion }));
}
