import "server-only";

import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";

import { getActorProfession } from "../data/actor-profession-reader";

// GUARD INTERINO de ambito de practica (T2b, 2026-07-30). Rechaza CUALQUIER escritura del
// tratamiento si el actor NO tiene profesion configurada (professional_profiles.profession =
// null). Es la unica defensa a NIVEL DE ACCION: las server actions se invocan sin pasar por la
// UI (un enlace guardado, un cache, una llamada directa con la sesion abierta), asi que ocultar
// la subpestana por profesion no protege nada por si solo (verificado T2b: canApproveProtocol y
// las demas gatean rol + asignacion, nunca profesion).
//
// Aplica SOLO al PROFESIONAL. Un actor sin perfil profesional (p. ej. admin, que puede llamar
// saveProtocol/addNote/generateMenu por canManageTreatment) NO cae aqui: su permiso lo gobierna la
// policy de la action, y si admin deberia o no ejecutar actos clinicos es gobernanza DIFERIDA
// (BACKLOG), no se decide colandola en este guard. Este guard solo bloquea al profesional sin
// profesion configurada; nunca cambia lo que admin ya podia hacer.
//
// SOLO filtra null, a proposito. El caso null es inequivoco: un profesional sin profesion
// configurada no prescribe. La MATRIZ de "que profesion puede aprobar que protocolo" (p. ej. si un
// medico con su profesion bien configurada puede aprobar el protocolo NUTRICIONAL del Nivel IV, o
// solo el nutricionista) es GOBERNANZA CLINICA y NO se decide en codigo: es criterio de Gildardo,
// abierta en BACKLOG y en GILDARDO_QUERIES Q17. No leer este guard como que esa matriz ya se
// resolvio: hoy solo distingue "sin profesion" de "con profesion".
//
// CURITA, no la solucion. Un chequeo de null en las escrituras es prestado; la solucion de fondo
// es que professional_profiles.profession no admita nulos y que la profesion se capture al
// invitar (BACKLOG, prioridad; B1 lo volvio urgente). Este guard es SUSTITUIBLE por esa
// restriccion de esquema: cuando exista, sobra.
export async function requireConfiguredProfession(actorId: string): Promise<Result<void>> {
  const { isProfessional, profession } = await getActorProfession(actorId);
  if (isProfessional && !profession) {
    return err(
      appError(
        "forbidden",
        "Tu profesion no esta configurada en tu perfil, por eso no puedes trabajar el tratamiento. Contacta al administrador para que la configure.",
      ),
    );
  }
  return ok(undefined);
}
