import "server-only";

import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  evaluations,
  surveyAnswers,
  surveyQuestions,
  surveyResponses,
} from "@/db/schema";
import { nutraceuticosIndicadosEn } from "@/modules/followups/data/nutraceuticos-de-la-anterior-reader";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE LA CNV-S NECESITA DE LA CONSULTA ANTERIOR  ·  v15 §2.3 y §2.4  ·  2026-11-08
//
// ═══ DOS COSAS, Y LAS DOS SON DE LA CONSULTA ANTERIOR ═══
//
//   · LAS RESPUESTAS, por `field_key`: es la precarga del bloque de confirmacion (*"La vez pasada
//     respondiste: X"*) y lo que decide la regla de salto digestivo (su §7.2 exige que los siete se
//     hayan registrado como "Nunca" la vez pasada).
//   · LOS NUTRACEUTICOS INDICADOS: la lista del S1 y del S2.
//
// ═══ SE BUSCA POR PACIENTE, NO POR CONSULTA, Y ESA ES LA PARTE QUE IMPORTA ═══
//
// Porque en el camino publico LA CONSULTA TODAVIA NO EXISTE: el paciente abre su enlace de seguimiento
// y la pagina tiene que pintar el formulario ANTES de que se cree el shell (la encuesta se sirve en una
// sola carga). Lo unico que hay en ese momento es el paciente del enlace.
//
// Con la consulta ya creada (la pantalla de la profesional, la reanudacion) se pasa su id para
// EXCLUIRLA: sin eso, "la ultima consulta del paciente" seria ella misma y el bloque de confirmacion
// precargaria las respuestas que se estan contestando.
//
// ═══ Y "LA ANTERIOR" ES LA ANTERIOR **VIGENTE** ═══
//
// Una evaluacion reemplazada por una correccion o retirada no es una consulta del paciente, y
// precargarla seria pedirle que confirme lo que respondio en una consulta que se deshizo. Es la misma
// regla que ya usan la serie de seguimiento y la cronologia.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type InsumosDeLaCnvs = {
  /** Las respuestas de la consulta anterior, por `field_key`. `{}` si no hay anterior. */
  anteriores: Record<string, string | null>;
  /** Los nutraceuticos indicados en la anterior. Vacio = no se le indico ninguno (el caso normal). */
  productos: { id: string; nombre: string; dosis: string | null }[];
};

const VACIO: InsumosDeLaCnvs = { anteriores: {}, productos: [] };

/**
 * LOS INSUMOS DE UNA CONSULTA YA CREADA, por su id. Resuelve el paciente y excluye la consulta.
 *
 * Lo usan los lectores que solo tienen la consulta delante (la vista de la encuesta del profesional y
 * la pantalla de completarla): necesitan los NOMBRES de los productos del S1, que la respuesta guarda
 * por id. Va aqui, al lado de la resolucion de "la anterior", para no tener dos.
 */
export async function insumosDeLaCnvsDeLaConsulta(evaluationId: string): Promise<InsumosDeLaCnvs> {
  const [ev] = await db
    .select({ patientId: evaluations.patientId })
    .from(evaluations)
    .where(eq(evaluations.id, evaluationId))
    .limit(1);
  if (!ev) return VACIO;
  return insumosDeLaCnvs({ patientId: ev.patientId, excluyendo: evaluationId });
}

export async function insumosDeLaCnvs(input: {
  patientId: string;
  /** La consulta de HOY, para excluirla. `null` cuando todavia no existe (el camino publico). */
  excluyendo: string | null;
}): Promise<InsumosDeLaCnvs> {
  const condiciones = [
    eq(evaluations.patientId, input.patientId),
    isNull(evaluations.supersededAt),
    isNull(evaluations.retiradaAt),
  ];
  if (input.excluyendo) condiciones.push(ne(evaluations.id, input.excluyendo));

  const [anterior] = await db
    .select({ id: evaluations.id })
    .from(evaluations)
    .where(and(...condiciones))
    .orderBy(desc(evaluations.createdAt), desc(evaluations.id))
    .limit(1);
  if (!anterior) return VACIO;

  // LA RESPUESTA VIGENTE de esa consulta: la ultima fila, que es la regla de la casa. Una correccion
  // escribe un `survey_responses` nuevo, y precargar el viejo mostraria el dato PRE-correccion.
  const [respuesta] = await db
    .select({ id: surveyResponses.id })
    .from(surveyResponses)
    .where(eq(surveyResponses.evaluationId, anterior.id))
    .orderBy(desc(surveyResponses.createdAt), desc(surveyResponses.id))
    .limit(1);

  const anteriores: Record<string, string | null> = {};
  if (respuesta) {
    const filas = await db
      .select({ clave: surveyQuestions.fieldKey, valor: surveyAnswers.answerValue })
      .from(surveyAnswers)
      .innerJoin(surveyQuestions, eq(surveyQuestions.id, surveyAnswers.questionId))
      .where(and(eq(surveyAnswers.responseId, respuesta.id), sql`${surveyQuestions.fieldKey} is not null`));
    for (const f of filas) if (f.clave) anteriores[f.clave] = f.valor;
  }

  return { anteriores, productos: await nutraceuticosIndicadosEn(anterior.id) };
}
