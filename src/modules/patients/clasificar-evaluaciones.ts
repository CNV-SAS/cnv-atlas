// ═══ NO TODAS LAS EVALUACIONES QUE ESTORBAN SON IGUALES (observación L, 2026-09-20) ═══
//
// LO QUE PEDIA SANTIAGO: *"¿Hay forma de eliminar las evaluaciones ya cerradas? Es que parecen molestas
// que sigan en el historial."*
//
// BORRAR NO ES UNA OPCION, y no por prudencia: una evaluacion arrastra diagnostico sellado, tratamiento,
// reporte y su rastro de auditoria. Borrarla rompe la trazabilidad que la regla dura 8 protege y deja
// eventos apuntando a algo que ya no existe. Es la misma razon por la que los pacientes se archivan.
//
// Y LA DISTINCION QUE LO DESTRABA salio de sus propios datos ("Hhh Ooo": tres seguimientos y una sola
// medicion). En ese historial habia TRES cosas mezcladas, y cada una pide algo distinto:
//
//   · RETIRADA   un cascaron que se cerro. No aporta nada: se pliega.
//   · TERMINADA  hizo su recorrido entero. Es historia: se pliega, y se puede volver a ver.
//   · ABIERTA    le falta algo. **NO se pliega nunca**, y esta es la mitad que importa: esconder trabajo
//                pendiente es perderlo, y el profesional que abre la ficha necesita verlo sin buscarlo.
//
// PURO: sin BD ni cliente. Lo usan la pantalla (cliente) y sus tests.

export type ClaseDeEvaluacion = "abierta" | "terminada" | "retirada";

export type EvaluacionClasificable = {
  status: string;
  /** Reemplazada por una correccion. Su contenido sigue, pero el vigente es otro. */
  superseded: boolean;
};

/**
 * En que estado de recorrido esta la evaluación.
 *
 * `awaiting_survey` cuenta como ABIERTA a propósito, aunque sea un cascarón: el paciente todavía puede
 * responder, y el profesional tiene que poder verlo para perseguirlo o cerrarlo. Un cascarón se vuelve
 * retirada cuando ALGUIEN lo cierra, que es un acto, no el paso del tiempo.
 */
export function claseDeEvaluacion(e: EvaluacionClasificable): ClaseDeEvaluacion {
  if (e.status === "abandoned") return "retirada";
  // Una reemplazada terminó su recorrido: lo vigente es la versión que la sucede.
  if (e.superseded) return "terminada";
  if (e.status === "completed") return "terminada";
  return "abierta";
}

/** Las que se ven siempre y las que se pliegan, en el orden en que llegaron. */
export function repartirEvaluaciones<T extends EvaluacionClasificable>(
  evaluaciones: T[],
): { abiertas: T[]; plegadas: T[] } {
  const abiertas: T[] = [];
  const plegadas: T[] = [];
  for (const e of evaluaciones) {
    if (claseDeEvaluacion(e) === "abierta") abiertas.push(e);
    else plegadas.push(e);
  }
  return { abiertas, plegadas };
}
