/* eslint-disable @typescript-eslint/no-explicit-any */
import { desc, eq } from "drizzle-orm";

import * as schema from "@/db/schema";

// UNA PREGUNTA SIN `field_key`, CREADA POR EL TEST, no buscada en el seed.
//
// POR QUE EXISTE ESTE FIXTURE. Tres tests de BD real necesitan una pregunta que el motor NO lee, para
// probar que corregirla no mueve el diagnostico. Los tres la buscaban en la encuesta sembrada
// (`WHERE field_key IS NULL LIMIT 1`), y eso funciono hasta que la migracion 0085 le puso `field_key` a
// las 25 que faltaban: desde entonces NO HAY NINGUNA, la consulta devuelve vacio y los tres revientan en
// su `beforeAll` con "Cannot read properties of undefined".
//
// Es la misma forma que ya nos mordio con el seed de trayectoria: una regla nueva no envejece el fixture,
// LE QUITA LA PRECONDICION. El arreglo no es buscar mejor, es que el caso deje de depender de lo que el
// seed contenga por casualidad. Y de paso el test dice lo que necesita en vez de tomar "el primero".
//
// SE LIMPIA SOLA: `borrarPreguntaSinFieldKey` en el afterAll. Sin eso quedaria una pregunta fantasma en la
// version, que ademas alteraria la numeracion continua de la encuesta.
//
// `db` va como `any` porque asi lo tienen los tres tests (importan @/db dinamicamente para no cargar el
// modulo server-only en los unitarios). El fixture no es el sitio para arreglar ese tipado.

/** Crea una pregunta sin field_key al final de la version dada. Devuelve su id. */
export async function crearPreguntaSinFieldKey(
  db: any,
  svId: string,
  texto = "Pregunta de prueba que el motor no lee",
): Promise<string> {
  // El orden va DESPUES del ultimo: hay un unique (survey_version_id, order_index), asi que un numero
  // fijo chocaria con la encuesta sembrada.
  const [ultima] = await db
    .select({ orderIndex: schema.surveyQuestions.orderIndex })
    .from(schema.surveyQuestions)
    .where(eq(schema.surveyQuestions.surveyVersionId, svId))
    .orderBy(desc(schema.surveyQuestions.orderIndex))
    .limit(1);

  const [fila] = await db
    .insert(schema.surveyQuestions)
    .values({
      surveyVersionId: svId,
      questionText: texto,
      questionType: "texto",
      fieldKey: null, // lo que hace util a esta pregunta: el motor no la lee
      section: "Otras",
      orderIndex: (ultima?.orderIndex ?? 0) + 1000,
      dataClass: "clinical",
      usedInDiagnosis: false,
    })
    .returning({ id: schema.surveyQuestions.id });
  return fila.id as string;
}

/**
 * La borra. Va en el afterAll: una pregunta fantasma alteraria la numeracion de la encuesta.
 *
 * PRIMERO LAS RESPUESTAS, y no es un detalle: `survey_answers.question_id` NO tiene `on delete cascade`
 * (a proposito: una respuesta clinica no desaparece porque alguien borre una pregunta), asi que borrar la
 * pregunta con respuestas colgando falla por la FK. El orden lo impone la base, no el gusto.
 */
export async function borrarPreguntaSinFieldKey(db: any, qId: string): Promise<void> {
  await db.delete(schema.surveyAnswers).where(eq(schema.surveyAnswers.questionId, qId));
  await db.delete(schema.surveyQuestions).where(eq(schema.surveyQuestions.id, qId));
}
