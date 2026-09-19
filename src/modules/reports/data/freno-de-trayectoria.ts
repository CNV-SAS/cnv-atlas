import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

// ═══ UN CAMBIO DESFAVORABLE NO SALE SIN CITA (2026-09-18) ═══
//
// DE DONDE VIENE: el freno existia dentro de aprobar el reporte (Gildardo, P0 Parte 2): un reporte que informa
// que el paciente EMPEORO no se podia aprobar sin que el profesional confirmara que se lo comunico, y esa
// confirmacion exigia la proxima cita agendada. La razon es clinica, no administrativa: enterarse de que se
// esta peor, sin saber cuando lo vuelven a ver, es la peor forma de recibir esa noticia.
//
// POR QUE SE MUDA AQUI: al retirar la aprobacion, el freno se quedaba sin sitio. Colgarlo del acto de ENTREGAR
// lo hace mas fuerte que antes, porque tambien alcanza a la impresion, que se lo saltaba.
//
// Y NO ALCANZA A TODAS LAS HOJAS, que es la pregunta que hizo Santiago (2026-09-18): frena SOLO lo que le
// cuenta al paciente como va (el reporte y la historia clinica). El plan y las rutas dicen QUE HACER, no que le
// pasa a su cuerpo, y bloquear su impresion dejaria al profesional sin poder entregarle al paciente lo que se
// lleva de la consulta, con el paciente ahi delante. Eso seria un freno que estorba sin proteger.

/** Las hojas que le cuentan al paciente como va. Solo estas se frenan. */
const HOJAS_QUE_CUENTAN_EL_CAMBIO = new Set(["reporte", "hc"]);

export const MENSAJE_FRENO =
  "Esta consulta informa un cambio desfavorable, y el paciente no tiene la próxima cita agendada. " +
  "Agéndala en Seguimiento antes de entregarle este documento: enterarse de que está peor sin saber cuándo lo " +
  "vuelven a ver es la peor forma de recibirlo.";

/**
 * Devuelve el motivo por el que NO se puede entregar, o null si se puede. Se consulta en el servicio de
 * entrega, no en la pantalla: una pantalla puede saltarse, un servicio no.
 */
export async function frenoDeTrayectoria(evaluationId: string, documento: string): Promise<string | null> {
  if (!HOJAS_QUE_CUENTAN_EL_CAMBIO.has(documento)) return null;

  const [fila] = await db.execute<{ band: string | null; proxima_cita: string | null }>(sql`
    select r.trajectory->>'band' as band,
           (select t.proxima_cita::text
              from treatments t join diagnoses d on d.id = t.diagnosis_id
             where d.evaluation_id = ${evaluationId}
             order by t.created_at desc limit 1) as proxima_cita
      from reports r
     where r.evaluation_id = ${evaluationId}
     order by r.created_at desc limit 1`);

  if (!fila || fila.band !== "empeoro") return null;
  return fila.proxima_cita ? null : MENSAJE_FRENO;
}

/**
 * LA OBSERVACION DE LA CONSULTA, que es lo que el profesional escribe de verdad (en Seguimiento) y lo que
 * acompaña al documento que sale hacia el paciente. Las notas del reporte se retiraron: eran una segunda
 * superficie para lo mismo, y el archivo de Gildardo no las tiene.
 *
 * La MAS RECIENTE: `treatment_notes` es append-only por decision clinica, asi que corregirse es escribir otra.
 */
export async function ultimaObservacionDeLaConsulta(evaluationId: string): Promise<string | null> {
  const [fila] = await db.execute<{ note: string }>(sql`
    select n.note
      from treatment_notes n
      join treatments t on t.id = n.treatment_id
      join diagnoses d on d.id = t.diagnosis_id
     where d.evaluation_id = ${evaluationId}
     order by n.created_at desc
     limit 1`);
  return fila?.note?.trim() || null;
}
