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
  /** Para saber cual es la ULTIMA completada. La cronologia clinica es la de la medicion. */
  measurementDate?: string | null;
  createdAt?: string;
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

// ═══ LA ULTIMA COMPLETADA SE QUEDA A LA VISTA (Santiago, 2026-09-21) ═══
//
// Es la que el profesional busca al empezar la siguiente consulta: el punto de partida contra el que va a
// comparar. Plegarla le obligaria a abrir el interruptor en CADA consulta de seguimiento, que es
// justamente el caso de uso de la ficha. Las completadas ANTERIORES si se pliegan: ya no son la
// referencia, son historia.
//
// Solo UNA, y solo una completada de verdad: una reemplazada o una retirada no es punto de partida de
// nada, y dejar varias a la vista devolveria la ficha al estado que motivo la (L).
const fechaDe = (e: EvaluacionClasificable): string => e.measurementDate ?? e.createdAt ?? "";

/** La completada mas reciente, o null. */
export function ultimaCompletada<T extends EvaluacionClasificable>(evaluaciones: T[]): T | null {
  let ultima: T | null = null;
  for (const e of evaluaciones) {
    if (e.status !== "completed" || e.superseded) continue;
    if (!ultima || fechaDe(e) > fechaDe(ultima)) ultima = e;
  }
  return ultima;
}

/**
 * Las que se ven siempre y las que se pliegan, en el orden en que llegaron.
 *
 * `abiertas` es el trabajo pendiente, y no se pliega NUNCA. `visibles` es lo que la pantalla muestra con
 * el interruptor apagado: las abiertas mas la ultima completada.
 */
export function repartirEvaluaciones<T extends EvaluacionClasificable>(
  evaluaciones: T[],
): { abiertas: T[]; visibles: T[]; plegadas: T[] } {
  const referencia = ultimaCompletada(evaluaciones);
  const abiertas: T[] = [];
  const visibles: T[] = [];
  const plegadas: T[] = [];
  for (const e of evaluaciones) {
    const abierta = claseDeEvaluacion(e) === "abierta";
    if (abierta) abiertas.push(e);
    if (abierta || e === referencia) visibles.push(e);
    else plegadas.push(e);
  }
  return { abiertas, visibles, plegadas };
}
