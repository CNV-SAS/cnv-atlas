import "server-only";

import { getSerieSeguimiento } from "@/modules/followups/data/serie-reader";

import type { DominiosAnteriores } from "./reports-view-types";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS CINCO DOMINIOS DE LA CONSULTA ANTERIOR  ·  para el radar de evolucion  ·  Santiago, 2026-11-05
//
// ═══ DE DONDE SALE ═══
//
// *"Mostrar el radar de evolucion/seguimiento si el paciente tiene una consulta anterior para que compare
// ambas."*
//
// El informe ya le decia al paciente como ha cambiado su PESO, su masa grasa y su masa magra (la grafica
// de trayectoria). Lo que no podia comparar era la FIGURA: las cinco areas de hoy contra las de su
// consulta anterior, que es justo lo que el documento le pone delante como resumen de su salud.
//
// ═══ NO SE LEE LA BD OTRA VEZ: SE REUSA LA SERIE DE SEGUIMIENTO ═══
//
// `getSerieSeguimiento` ya trae, por consulta, los dominios del snapshot sellado, y ya resuelve las cuatro
// cosas que un lector nuevo tendria que volver a resolver y podria resolver distinto:
//
//   · EL TECHO de la evaluacion (`corte-de-la-serie`): un informe reimpreso no puede comparar contra una
//     consulta que el dia que se sello no habia ocurrido.
//   · UN PUNTO POR EVALUACION y no por reporte: una evaluacion puede tener varios informes (regenerar el
//     diagnostico crea otro), y cada uno seria una consulta falsa en la comparacion.
//   · LAS EVALUACIONES REEMPLAZADAS por una correccion quedan fuera: comparariamos contra el yo
//     pre-correccion del paciente.
//   · El orden cronologico por fecha de MEDICION, que es la cronologia clinica.
//
// Un segundo lector con su propia consulta habria divergido en alguna de las cuatro, y la pantalla del
// profesional y el informe del paciente dirian cosas distintas de la misma comparacion.
//
// ═══ LA SEVERIDAD SE COMPARA POR ID, NO POR POSICION ═══
//
// El snapshot anterior es de otro sellado y nada garantiza que su lista de dominios venga en el mismo
// orden ni con los mismos presentes (un dominio sin dato no deja fila). Alinear por posicion compararia
// el area conductual de hoy con la metabolica de entonces, y el dibujo saldria creible. Por eso esto
// devuelve un MAPA por id y el radar busca en el; el id es el del motor y no cambia entre versiones.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Los dominios de la consulta ANTERIOR a esta, o `null` si no hay ninguna con la que comparar (consulta
 * inicial, o una anterior cuyo diagnostico no llego a sellar dominios).
 */
export async function getDominiosAnteriores(
  evaluationId: string,
): Promise<DominiosAnteriores | null> {
  const { puntos } = await getSerieSeguimiento(evaluationId);

  // LA ANTERIOR ES LA ULTIMA QUE NO ES ESTA, no "la penultima de la lista": si esta evaluacion todavia no
  // tiene reporte (el preview se pide antes de aprobar), la serie no la incluye y la penultima seria una
  // consulta de mas atras. Filtrar por identidad es cierto en los dos casos.
  const anteriores = puntos.filter((p) => p.evaluationId !== evaluationId);
  const previa = anteriores[anteriores.length - 1];
  if (!previa?.dominios?.length) return null;

  const porDominio: Record<string, number> = {};
  for (const d of previa.dominios) {
    if (d.id) porDominio[d.id] = d.sev;
  }
  if (Object.keys(porDominio).length === 0) return null;

  return { fecha: previa.fecha, porDominio };
}
