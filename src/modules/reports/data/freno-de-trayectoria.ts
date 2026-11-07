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
 * EL MENSAJE QUE LA PROFESIONAL LE DEJO AL PACIENTE, que es el UNICO texto suyo que viaja al informe.
 *
 * ═══ ANTES ESTO DEVOLVIA LA NOTA CLINICA, Y ERA UN DEFECTO (corregido el 2026-11-07, migracion 0237) ═══
 *
 * La funcion se llamaba `ultimaObservacionDeLaConsulta` y leia `treatment_notes.note`, o sea la NOTA
 * CLINICA: el texto que la profesional escribe para si misma y para los otros profesionales del paciente
 * ("vigilar adherencia", "sospecha de restriccion"). Ese texto salia en el informe y viajaba en el correo
 * hacia la persona, tal cual.
 *
 * Santiago lo cerro en su punto i: *"Campo nuevo y opcional, 'Mensaje para el paciente', de 200
 * caracteres... Es el unico texto de la profesional que va al informe. La nota clinica sigue en la HC."*
 *
 * ═══ LA ULTIMA QUE TIENE MENSAJE, NO LA ULTIMA NOTA ═══
 *
 * `treatment_notes` es append-only y el mensaje es OPCIONAL, asi que la ultima nota puede no traerlo. Si
 * se leyera "el mensaje de la ultima nota", escribir una nota clinica mas (sin mensaje) BORRARIA del
 * informe el mensaje que ya se le habia dejado al paciente, sin que nadie lo pidiera y sin que nada
 * falle. Asi que se busca la ultima fila QUE TENGA mensaje: corregirse es escribir otro, igual que con la
 * nota.
 *
 * `null` = no le dejo mensaje, y entonces el informe sale solo. Es lo que ya pasaba cuando no habia nota.
 */
export async function ultimoMensajeParaElPaciente(evaluationId: string): Promise<string | null> {
  const [fila] = await db.execute<{ mensaje: string }>(sql`
    select n.mensaje_para_el_paciente as mensaje
      from treatment_notes n
      join treatments t on t.id = n.treatment_id
      join diagnoses d on d.id = t.diagnosis_id
     where d.evaluation_id = ${evaluationId}
       and n.mensaje_para_el_paciente is not null
       and btrim(n.mensaje_para_el_paciente) <> ''
     order by n.created_at desc
     limit 1`);
  return fila?.mensaje?.trim() || null;
}
