import "server-only";

import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";

import { getActorProfession } from "../data/actor-profession-reader";

// GUARD de ámbito de práctica de las escrituras del PROTOCOLO NUTRICIONAL (T2b). El protocolo del
// Nivel IV es nutricional; Gildardo cerró Q17 (tercera ronda, 2026-07-30): "el protocolo nutricional
// lo aprueba el nutricionista". Así que las cinco escrituras de prescripción (saveProtocol,
// saveAdjustments, acknowledgeRestrictions, approveProtocol, generateMenu) exigen
// profession === "nutricionista" del actor.
//
// Es la única defensa a NIVEL DE ACCIÓN: las server actions se invocan sin pasar por la UI (un enlace
// guardado, un cache, una llamada directa con la sesión abierta), así que ocultar la subpestaña por
// profesión (B1) no protege por sí solo. Un médico/deportólogo ve SU sección en Tratamiento (no la
// nutricional), y este guard impide que apruebe la nutricional aunque llame la action directo.
//
// Aplica SOLO al PROFESIONAL (tiene fila en professional_profiles). Un actor sin perfil profesional
// (p. ej. admin) NO cae aquí: su permiso lo gobierna la policy de la action (y Gildardo confirmó que
// los roles administrativos son operativos y no ejecutan actos clínicos; el cierre de admin sobre
// actos clínicos es gobernanza aparte, BACKLOG). addNote NO usa este guard (es documentación, no
// prescripción; los profesionales de cualquier especialidad pueden documentar).
//
// CURITA parcial: cuando lleguen los protocolos médico/ejercicio/psico, cada uno tendrá su profesión
// habilitada (la matriz profesión→protocolo). Hoy solo existe el nutricional, así que solo
// nutricionista. La solución de fondo (profesión NOT NULL + captura al invitar) sigue en BACKLOG.
// Devuelve la profesion del actor en el OK (null si no es profesional, p. ej. admin): quien SELLA un
// acto (approveProtocol) la registra EN el acto, no la asume. El resto de call sites solo chequean .ok.
export async function requireNutricionista(actorId: string): Promise<Result<{ profession: string | null }>> {
  const { isProfessional, profession } = await getActorProfession(actorId);
  if (isProfessional && profession !== "nutricionista") {
    return err(
      appError(
        "forbidden",
        profession
          ? "El protocolo nutricional lo aprueba y edita el nutricionista. Tu perfil no es de nutrición."
          : "Tu profesión no está configurada en tu perfil, por eso no puedes trabajar el protocolo. Contacta al administrador para que la configure.",
      ),
    );
  }
  return ok({ profession });
}
