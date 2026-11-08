import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { CODIGO_LINEA_BASE } from "../instrumento";

import type { ActiveSurvey, ComportamientoDelItem } from "./survey-view-types";

// Lectura de la encuesta activa para la pagina publica (sin sesion). Via service
// role: el contenido de la encuesta no es sensible, pero el paciente no tiene
// sesion.

// Los tipos de la vista viven en survey-view-types (modulo neutro) para que el form y los widgets cliente
// los importen sin el reader server-only. El reader los reexporta para el resto del server.
export type {
  SurveyOptionView,
  SurveyQuestionView,
  SurveyItemView,
  ActiveSurvey,
} from "./survey-view-types";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// SE LEE POR INSTRUMENTO, NO POR VERSION  ·  0240, 2026-11-07
//
// ═══ QUE CAMBIO Y POR QUE NO CAMBIA NADA HOY ═══
//
// Antes: *"la version mas reciente publicada, con sus preguntas"*. Ahora: *"las preguntas que este
// INSTRUMENTO aplica, en el orden que el instrumento dice"*. Para la linea base son exactamente las
// mismas, en el mismo orden, porque su instrumento las lleva todas como `repetir`: la 0240 las sembro de
// la propia base con un INSERT ... SELECT. El candado compara las dos listas y exige que sean identicas.
//
// HACIA FALTA POR DOS COSAS, no solo por la CNV-S:
//
//   1. La CNV-S presenta el MODULO S ANTES de D1, asi que el orden de presentacion no puede salir del
//      `order_index` de la pregunta: sale del item del instrumento.
//   2. "La version mas reciente publicada" se rompia sola en cuanto hubiera una segunda version de
//      cualquier plantilla, porque la consulta no filtraba por plantilla. El Modulo S vive en su propia
//      version, asi que sin este cambio la encuesta del paciente habria pasado a ser el Modulo S.
//
// ═══ Y SI NO HAY INSTRUMENTO, FALLA EN VOZ ALTA ═══
//
// No hay camino de respaldo "por version". Dos caminos para la misma lectura es como se consigue que
// local muestre un instrumento y la nube otro, cada uno coherente consigo mismo. Si la base no tiene el
// instrumento, lo que pasa es que la 0240 no se aplico, y eso tiene que verse como un error con su
// causa, no como una encuesta vacia: un paciente que abre una encuesta sin preguntas cree que ya la
// entrego.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * La encuesta que aplica un instrumento, con sus preguntas y opciones en el orden en que se presentan.
 *
 * `codigo` por defecto es el de la LINEA BASE: todo lo que existe hoy la usa, y pasarlo explicito en
 * cada llamador abriria la puerta a que uno se quede con el valor de ayer.
 */
export async function getActiveSurvey(
  codigo: string = CODIGO_LINEA_BASE,
): Promise<ActiveSurvey | null> {
  const supabase = createSupabaseAdminClient();

  const { data: instrumento, error: iErr } = await supabase
    .from("survey_instruments")
    .select("id, codigo, nombre")
    .eq("codigo", codigo)
    .maybeSingle();
  if (iErr) throw new Error(`survey-reader: instrumento: ${iErr.message}`);
  if (!instrumento) {
    throw new Error(
      `survey-reader: no existe el instrumento "${codigo}". Es la 0240 sin aplicar en esta base: ` +
        "migrar antes de servir la encuesta.",
    );
  }

  const { data: items, error: qErr } = await supabase
    .from("survey_instrument_items")
    .select(
      "comportamiento, filtro_question_id, seccion, order_index, " +
        "survey_questions!survey_instrument_items_question_id_fkey(" +
        "id, question_text, hint, question_type, section, field_key, survey_version_id, " +
        "survey_options(id, option_text, order_index))",
    )
    .eq("instrument_id", instrumento.id)
    .order("order_index", { ascending: true });
  if (qErr) throw new Error(`survey-reader: items: ${qErr.message}`);

  type Fila = {
    comportamiento: string;
    filtro_question_id: string | null;
    seccion: string | null;
    order_index: number;
    survey_questions: {
      id: string;
      question_text: string;
      hint: string | null;
      question_type: string;
      section: string | null;
      field_key: string | null;
      survey_version_id: string;
      survey_options: { id: string; option_text: string; order_index: number }[] | null;
    } | null;
  };
  const filas = ((items ?? []) as unknown as Fila[]).filter((f) => f.survey_questions != null);
  if (filas.length === 0) return null;

  // ═══ LA VERSION QUE SE SELLA EN LA RESPUESTA ES LA DEL CUESTIONARIO, NUNCA LA DEL MODULO S ═══
  //
  // Es la que el motor congelado usa para resolver sus `field_key` (`expectedFieldKeys`), la que mide la
  // completitud del diagnostico y la que gatea una correccion. Con la del Modulo S, una consulta de
  // seguimiento sellaria una version de SIETE preguntas y el diagnostico creeria que la encuesta tiene
  // siete campos.
  //
  // SE TOMA LA DEL PRIMER ITEM QUE NO SEA `propio`, que es la definicion exacta: `propio` significa
  // "esta pregunta es del instrumento", o sea del Modulo S. La primera version de esto miraba el
  // `field_key` ("por construccion es del cuestionario") y ERA FALSO: las preguntas del Modulo S tambien
  // llevan `field_key`, porque sus respuestas se leen por clave. Lo atrapo el candado de BD al llamar al
  // lector de verdad; ningun test de tipos podia verlo.
  const surveyVersionId =
    filas.find((f) => f.comportamiento !== "propio")?.survey_questions?.survey_version_id ??
    filas[0].survey_questions!.survey_version_id;

  return {
    surveyVersionId,
    instrumento: { id: instrumento.id, codigo: instrumento.codigo, nombre: instrumento.nombre },
    // number: numeracion CONTINUA 1..N derivada del ORDEN, no escrita en el texto. Asi agregar una
    // pregunta renumera sola. El mismo criterio (posicion en el orden) lo usa survey-answers-reader, para
    // que "pregunta 38" coincida en la encuesta del paciente y en la vista del profesional.
    questions: filas.map((f, i) => {
      const q = f.survey_questions!;
      return {
        id: q.id,
        number: i + 1,
        text: q.question_text,
        hint: q.hint,
        type: q.question_type,
        // LA SECCION DEL ITEM MANDA sobre la de la pregunta cuando existe: es lo unico que un
        // instrumento cambia, y en la CNV-S es lo que junta los ocho `confirmar` en su propio paso.
        section: f.seccion ?? q.section,
        fieldKey: q.field_key,
        comportamiento: f.comportamiento as ComportamientoDelItem,
        filtroQuestionId: f.filtro_question_id,
        options: [...(q.survey_options ?? [])]
          .sort((a, b) => a.order_index - b.order_index)
          .map((o) => ({ id: o.id, text: o.option_text })),
      };
    }),
  };
}
