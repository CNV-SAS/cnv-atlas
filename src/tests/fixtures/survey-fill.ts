// RELLENO DE LA ENCUESTA PARA LOS SEEDS DE DEMOSTRACION.
//
// Sale del seed de realimentacion y se comparte, porque el problema era de los tres: el pipeline exige la
// encuesta COMPLETA (survey-completeness.ts, Gildardo §1 del 2026-08-13: "el profesional no puede atender a
// ningun paciente si la encuesta no esta completa"), y un seed que responde por LISTA queda a medias en
// silencio en cuanto la encuesta crece. El de trayectoria quedo asi: respondia 31 de 64 y no podia crear
// ni un caso nuevo.
//
// Por eso el relleno es por TIPO y no por lista: toda pregunta de la version recibe respuesta valida, con
// la prioridad override del caso > fixture del DFI > primera opcion > valor neutro. Un bump de la encuesta
// lo sigue dejando completo.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type SurveyFillOptions = {
  /** Respuesta exacta por field_key. Se valida contra el catalogo: una opcion inexistente lanza. */
  overrides?: Record<string, string>;
  /** Respuestas del fixture del DFI (field_key -> texto o indice), resueltas contra las opciones reales. */
  fixture?: Record<string, unknown>;
  resolve?: (opciones: string[], valor: any) => string;
};

export async function fillSurveyComplete(
  db: any,
  schema: any,
  eq: any,
  respId: string,
  surveyVersionId: string,
  opts: SurveyFillOptions = {},
): Promise<number> {
  const { overrides = {}, fixture = {}, resolve } = opts;
  const questions = await db
    .select({
      id: schema.surveyQuestions.id,
      fieldKey: schema.surveyQuestions.fieldKey,
      tipo: schema.surveyQuestions.questionType,
    })
    .from(schema.surveyQuestions)
    .where(eq(schema.surveyQuestions.surveyVersionId, surveyVersionId));

  for (const q of questions as { id: string; fieldKey: string | null; tipo: string }[]) {
    const opts2 = await db
      .select({ text: schema.surveyOptions.optionText })
      .from(schema.surveyOptions)
      .where(eq(schema.surveyOptions.questionId, q.id))
      .orderBy(schema.surveyOptions.orderIndex);
    const texts = opts2.map((o: { text: string }) => o.text);
    let value: string;
    if (q.fieldKey && q.fieldKey in overrides) {
      value = overrides[q.fieldKey];
      const elegidas: string[] = value.startsWith("[") ? JSON.parse(value) : [value];
      for (const t of elegidas) {
        if (texts.length > 0 && !texts.includes(t)) {
          throw new Error(`opcion inexistente para ${q.fieldKey}: ${t}`);
        }
      }
    } else if (q.fieldKey && resolve && q.fieldKey in fixture) {
      value = resolve(texts, (fixture as Record<string, unknown>)[q.fieldKey]);
    } else if (texts.length > 0) {
      value = q.tipo === "opcion_multiple" ? JSON.stringify([texts[0]]) : texts[0];
    } else {
      value = q.tipo === "numero" ? "1" : "Sin dato (paciente demo)";
    }
    await db.insert(schema.surveyAnswers).values({ responseId: respId, questionId: q.id, answerValue: value });
  }
  return questions.length;
}

/** Ultima opcion de cada pregunta pedida: el extremo del catalogo, sin inventar textos. */
export async function lastOptionByFieldKey(
  db: any,
  schema: any,
  eq: any,
  surveyVersionId: string,
  fieldKeys: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const questions = await db
    .select({
      id: schema.surveyQuestions.id,
      fieldKey: schema.surveyQuestions.fieldKey,
      tipo: schema.surveyQuestions.questionType,
    })
    .from(schema.surveyQuestions)
    .where(eq(schema.surveyQuestions.surveyVersionId, surveyVersionId));
  const wanted = new Set(fieldKeys);
  for (const q of questions as { id: string; fieldKey: string | null; tipo: string }[]) {
    if (!q.fieldKey || !wanted.has(q.fieldKey)) continue;
    const opts = await db
      .select({ text: schema.surveyOptions.optionText })
      .from(schema.surveyOptions)
      .where(eq(schema.surveyOptions.questionId, q.id))
      .orderBy(schema.surveyOptions.orderIndex);
    if (opts.length === 0) continue;
    // "Otra" pelada NO cuenta como respondida para el gate (isBareFreeTextOther): si es la ultima, se
    // toma la anterior. Sin esto el extremo del catalogo dejaria la encuesta incompleta.
    const utiles = (opts as { text: string }[]).map((o) => o.text).filter((t) => !/^otr[oa]s?$/i.test(t.trim()));
    if (utiles.length === 0) continue;
    const last = utiles[utiles.length - 1];
    out[q.fieldKey] = q.tipo === "opcion_multiple" ? JSON.stringify([last]) : last;
  }
  return out;
}
