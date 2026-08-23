/* eslint-disable @typescript-eslint/no-explicit-any */

// A QUIEN PERTENECEN LOS PACIENTES DE DEMOSTRACION. Fuente unica para los tres seeds.
//
// EL DEFECTO QUE ARRANCO ESTO (2026-08-23): los seeds elegian el profesional con
// `professional_profiles LIMIT 1` SIN `ORDER BY`. No es determinista, y en la base local le tocaba el
// MEDICO. Los readers son RLS: si la evaluacion no es del profesional autenticado devuelven null y la
// pagina hace `notFound`, asi que el paciente demo sembraba bien y daba **404** al abrirlo. Un demo que
// nadie puede abrir no sirve para el smoke, y el 404 se lee como "el seed no corrio" o "apunta a otra
// base": dos diagnosticos falsos antes de llegar al verdadero.
//
// Regla: el DUEÑO es parte del caso, no plomeria. Se elige por PROFESION (la que el smoke necesita),
// de forma determinista, y si no existe esa cuenta el seed FALLA en voz alta.

export type DemoProfessional = { proId: string; actorId: string };

// Devuelve el profesional de la profesion pedida (la primera por id, para que dos corridas coincidan).
// `preferida` es la profesion que el smoke necesita ver; si no hay ninguna cuenta con ella, lanza.
export async function pickDemoProfessional(
  db: any,
  schema: any,
  preferida: string,
): Promise<DemoProfessional> {
  const { asc, eq } = await import("drizzle-orm");
  const rows = await db
    .select({ id: schema.professionalProfiles.id, profileId: schema.professionalProfiles.profileId })
    .from(schema.professionalProfiles)
    .where(eq(schema.professionalProfiles.profession, preferida))
    .orderBy(asc(schema.professionalProfiles.id))
    .limit(1);
  if (rows.length === 0) {
    throw new Error(
      `No hay ningun professional_profile con profession='${preferida}'. Los pacientes demo se asignan a ` +
        `esa cuenta para que el smoke los pueda abrir (los readers son RLS: con otra cuenta la pagina da 404). ` +
        `Crea la cuenta antes de sembrar.`,
    );
  }
  return { proId: rows[0].id, actorId: rows[0].profileId };
}

// REPARA lo ya sembrado con el dueño equivocado. Re-sembrar exigiria borrar registros clinicos; corregir
// el dueño en su sitio es barato y deja el demo abrible sin tocar diagnostico ni tratamiento. Idempotente.
export async function reassignDemoEvaluations(
  db: any,
  schema: any,
  evaluationIds: string[],
  proId: string,
): Promise<void> {
  const { inArray } = await import("drizzle-orm");
  if (evaluationIds.length === 0) return;
  await db
    .update(schema.evaluations)
    .set({ professionalId: proId })
    .where(inArray(schema.evaluations.id, evaluationIds));
}
