import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  surveyAnswers,
  surveyInstrumentItems,
  surveyInstruments,
  surveyQuestions,
  surveyResponses,
} from "@/db/schema";
import {
  computeSurveyGapsFromDomains,
  type SurveyGap,
} from "@/modules/clinical-pipeline/services/survey-completeness";

import { CODIGO_LINEA_BASE } from "../instrumento";
import { dominiosQueSePresentan, type DominioDe, type ItemLeido } from "../lo-que-se-presenta";
import { contextoDeLaCnvsDeLaConsulta } from "./insumos-de-la-cnvs";
import { instrumentoDeLaConsulta } from "./instrumento-de-la-consulta";
import type { ComportamientoDelItem } from "./survey-view-types";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE SE PRESENTO EN ESTA CONSULTA, PARA TODO LO QUE **EXIGE**  ·  Santiago, 2026-11-15
//
// ═══ EL DEFECTO QUE CIERRA, Y ES EL QUE BLOQUEABA LA CNV-S ═══
//
// Textual del smoke: con la consulta anterior SIN nutraceuticos *"el formulario no muestra S1 ni S2
// (decision 34) y la barra dice 100 %, pero importar la BIS dice «falta completar la encuesta: faltan 2
// respuestas (Seguimiento (2))»"*. Y con los dos productos adherentes, lo mismo con el S2: *"el S2 no se
// presenta, pero el gate dice «falta 1 respuesta»"*.
//
// La REGLA de lo que se presenta ya vivia en un solo sitio (`lo-que-se-presenta.ts`) desde el 9 de
// noviembre. Lo que no estaba es que los TRES sitios que EXIGEN la encuesta completa la llamaran: el
// boton de importar la BIS, el gate del diagnostico y el de regenerar tras una correccion. Los tres
// contaban "todas las preguntas del instrumento" (o, el del diagnostico, "todas las de la version"), asi
// que le pedian a la profesional responder preguntas que la CNV-S habia decidido no hacer. Es el hazard 6
// en su forma mas cara: una exigencia sobre algo que NO SE PUEDE alcanzar, porque el formulario no
// presenta la pregunta que el gate reclama. La consulta de seguimiento quedaba sin salida.
//
// ═══ POR QUE ESTE LECTOR EXISTE SI YA HAY OTRO QUE ARMA EL INSTRUMENTO ═══
//
// `survey-answers-reader` arma el instrumento para PINTARLO (textos, opciones, nombres de producto), y va
// por el cliente CON SESION, porque la RLS es la que impone que sea su paciente. Los gates del pipeline
// corren por Drizzle owner (la autorizacion ya se verifico en la accion) y hay diez pruebas de BD que
// llaman al pipeline sin sesion ninguna: meter ahi el lector de pantalla cambiaria el modelo de
// autorizacion de la puerta y dejaria el gate ciego donde no hay cookies.
//
// ASI QUE SON DOS LECTURAS Y **UNA SOLA REGLA**: las dos desembocan en `dominiosQueSePresentan`, que es
// la unica definicion de lo que se presenta. Y para que las dos lecturas no se separen con el tiempo,
// `el-gate-presenta-lo-mismo-que-la-encuesta-db` compara item por item lo que devuelven las dos sobre las
// consultas de la base: dos constructores del mismo insumo acaban difiriendo, y ese candado lo dice en
// voz alta.
//
// ═══ Y EL ORDEN ES EL DEL INSTRUMENTO, NO EL DE LA PREGUNTA ═══
//
// Es justo lo que un instrumento cambia (el Modulo S va DELANTE de la encuesta, su anexo A), y la seccion
// del ITEM manda sobre la de la pregunta cuando existe: es lo que junta los ocho `confirmar` en su propio
// paso. Mismo criterio que `leerPorInstrumento`, y por eso los dos caminos dan la misma lista.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Un item del instrumento de la consulta, con lo justo para decidir si se presenta y si esta respondido. */
export type ItemDeLaConsulta = ItemLeido & {
  questionId: string;
  section: string;
  /** La posicion en el INSTRUMENTO (0..N-1), que es la numeracion que ve el paciente. */
  orderIndex: number;
};

/** Las respuestas que manda otro estado (una correccion en curso), por `questionId`. */
export type RespuestasSobrescritas = ReadonlyMap<string, string | null>;

type Fila = {
  questionId: string;
  section: string | null;
  seccionDelItem: string | null;
  fieldKey: string | null;
  comportamiento: string | null;
  answerValue: string | null;
};

function aItems(filas: Fila[]): ItemDeLaConsulta[] {
  return filas.map((f, i) => ({
    questionId: f.questionId,
    // "Otras" es el mismo cajon que usa `computeSurveyGaps` para un dominio sin etiqueta: si aqui se
    // llamara de otra manera, el mensaje del gate nombraria un dominio que la pantalla no tiene.
    section: f.seccionDelItem ?? f.section ?? "Otras",
    orderIndex: i,
    fieldKey: f.fieldKey,
    // SIN COMPORTAMIENTO SE TRATA COMO `repetir`, que es el de TODA la linea base. Un valor inventado se
    // ve igual que uno bueno, asi que la ausencia se dice con la ausencia (misma regla que el tipo).
    comportamiento: (f.comportamiento as ComportamientoDelItem | null) ?? undefined,
    answerValue: f.answerValue,
  }));
}

/**
 * TODOS los items del instrumento de la consulta, en su orden, con la respuesta VIGENTE de cada uno.
 *
 * `null` = esta consulta todavia no tiene encuesta respondida, que NO es lo mismo que tenerla a medias:
 * lo distinguen el gate del import ("que el paciente responda la encuesta") y el del diagnostico.
 */
export async function itemsDeLaConsulta(evaluationId: string): Promise<ItemDeLaConsulta[] | null> {
  // LA RESPUESTA VIGENTE ES LA ULTIMA FILA, que es la regla de la casa: una correccion escribe un
  // `survey_responses` nuevo, y leer el viejo mediria la completitud PRE-correccion.
  const [respuesta] = await db
    .select({ id: surveyResponses.id, versionId: surveyResponses.surveyVersionId })
    .from(surveyResponses)
    .where(eq(surveyResponses.evaluationId, evaluationId))
    .orderBy(desc(surveyResponses.createdAt), desc(surveyResponses.id))
    .limit(1);
  if (!respuesta) return null;

  const codigo = await instrumentoDeLaConsulta(evaluationId);

  // LA LINEA BASE SIGUE POR LA VERSION, igual que el lector de pantalla: su instrumento lleva todas las
  // preguntas como `repetir`, asi que los dos caminos dan lo mismo, y las 500 consultas que ya existen no
  // tienen por que cambiar de ruta para nada.
  if (codigo === CODIGO_LINEA_BASE) {
    const filas = await db
      .select({
        questionId: surveyQuestions.id,
        section: surveyQuestions.section,
        fieldKey: surveyQuestions.fieldKey,
        answerValue: surveyAnswers.answerValue,
      })
      .from(surveyQuestions)
      .leftJoin(
        surveyAnswers,
        and(
          eq(surveyAnswers.questionId, surveyQuestions.id),
          eq(surveyAnswers.responseId, respuesta.id),
        ),
      )
      .where(eq(surveyQuestions.surveyVersionId, respuesta.versionId))
      .orderBy(asc(surveyQuestions.orderIndex));
    return aItems(filas.map((f) => ({ ...f, seccionDelItem: null, comportamiento: null })));
  }

  const filas = await db
    .select({
      questionId: surveyQuestions.id,
      section: surveyQuestions.section,
      seccionDelItem: surveyInstrumentItems.seccion,
      fieldKey: surveyQuestions.fieldKey,
      comportamiento: surveyInstrumentItems.comportamiento,
      answerValue: surveyAnswers.answerValue,
    })
    .from(surveyInstrumentItems)
    .innerJoin(surveyInstruments, eq(surveyInstruments.id, surveyInstrumentItems.instrumentId))
    .innerJoin(surveyQuestions, eq(surveyQuestions.id, surveyInstrumentItems.questionId))
    .leftJoin(
      surveyAnswers,
      and(
        eq(surveyAnswers.questionId, surveyInstrumentItems.questionId),
        eq(surveyAnswers.responseId, respuesta.id),
      ),
    )
    .where(eq(surveyInstruments.codigo, codigo))
    .orderBy(asc(surveyInstrumentItems.orderIndex));
  return aItems(filas);
}

/** Los items agrupados por dominio, en el orden del instrumento (la forma que pide la regla). */
function enDominios(items: ItemDeLaConsulta[]): DominioDe<ItemDeLaConsulta>[] {
  const porSeccion = new Map<string, DominioDe<ItemDeLaConsulta>>();
  const dominios: DominioDe<ItemDeLaConsulta>[] = [];
  for (const it of items) {
    let d = porSeccion.get(it.section);
    if (!d) {
      d = { section: it.section, questions: [] };
      porSeccion.set(it.section, d);
      dominios.push(d);
    }
    d.questions.push(it);
  }
  return dominios;
}

/**
 * LOS ITEMS QUE SE LE PRESENTARON DE VERDAD en esta consulta, por la regla unica.
 *
 * @param sobrescritas Respuestas que manda otro estado (las de una correccion en curso). Se aplican
 *                     ANTES de filtrar, y eso importa: si la profesional corrige el S1 y los dos
 *                     productos quedan adherentes, el S2 deja de presentarse en el mismo acto.
 */
export async function loPresentadoDeLaConsulta(
  evaluationId: string,
  sobrescritas?: RespuestasSobrescritas,
): Promise<ItemDeLaConsulta[] | null> {
  const [items, cnvs] = await Promise.all([
    itemsDeLaConsulta(evaluationId),
    contextoDeLaCnvsDeLaConsulta(evaluationId),
  ]);
  if (items == null) return null;
  const conEstado = sobrescritas
    ? items.map((it) =>
        sobrescritas.has(it.questionId)
          ? { ...it, answerValue: sobrescritas.get(it.questionId) ?? null }
          : it,
      )
    : items;
  return dominiosQueSePresentan(enDominios(conEstado), cnvs).flatMap((d) => d.questions);
}

/**
 * LOS HUECOS DE LO QUE SE PRESENTO, por dominio y en orden. Vacio = la encuesta esta completa.
 *
 * ES LA UNICA CUENTA QUE EXIGEN LAS TRES PUERTAS (importar la BIS, generar el diagnostico y regenerar
 * tras una correccion). `null` = la consulta no tiene encuesta respondida.
 */
export async function huecosDeLoPresentado(
  evaluationId: string,
  sobrescritas?: RespuestasSobrescritas,
): Promise<SurveyGap[] | null> {
  const presentados = await loPresentadoDeLaConsulta(evaluationId, sobrescritas);
  if (presentados == null) return null;
  return computeSurveyGapsFromDomains(enDominios(presentados));
}
