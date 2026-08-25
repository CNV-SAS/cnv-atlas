import { beforeAll, describe, expect, it, vi } from "vitest";

import { desc, eq } from "drizzle-orm";

import { HC_ANTECEDENTES } from "@/modules/reports/data/hc-antecedentes-map";

// CANDADO CONTRA LA ENCUESTA REAL. El mapa de la HC resuelve CUATRO de sus filas por TEXTO, porque esas
// preguntas no tienen field_key (no entran al motor, P-39). El texto es fragil ante un bump de la encuesta:
// si un enunciado cambia, la fila deja de resolver y la historia clinica PIERDE UNA FILA EN SILENCIO, que
// es justo lo que no puede pasar en un documento clinico. Este candado corre contra la version VIGENTE y
// falla ruidoso diciendo cual dejo de resolver.

vi.mock("server-only", () => ({}));

let RUN = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local
}
RUN = Boolean(process.env.DATABASE_URL);

describe.skipIf(!RUN)("el mapa de antecedentes resuelve contra la encuesta vigente", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let preguntas: { fieldKey: string | null; questionText: string }[] = [];

  beforeAll(async () => {
    const schema: any = await import("@/db/schema");
    const db: any = (await import("@/db")).db;
    const [sv] = await db
      .select({ id: schema.surveyVersions.id })
      .from(schema.surveyVersions)
      .orderBy(desc(schema.surveyVersions.publishedAt))
      .limit(1);
    preguntas = await db
      .select({ fieldKey: schema.surveyQuestions.fieldKey, questionText: schema.surveyQuestions.questionText })
      .from(schema.surveyQuestions)
      .where(eq(schema.surveyQuestions.surveyVersionId, sv.id));
  });

  it("las OCHO filas encuentran su pregunta", () => {
    for (const g of HC_ANTECEDENTES) {
      for (const f of g.filas) {
        const porKey = f.fieldKey ? preguntas.some((q) => q.fieldKey === f.fieldKey) : false;
        const porTexto = f.patron ? preguntas.some((q) => f.patron!.test(q.questionText)) : false;
        expect(
          porKey || porTexto,
          `La fila "${f.etiqueta}" (${f.id}) NO resuelve contra la encuesta vigente: la historia clínica ` +
            "la perdería en silencio. Si el enunciado cambió, actualiza su patrón; si la pregunta recibió " +
            "field_key (P-39 resuelto), cámbiala a field_key, que es estable.",
        ).toBe(true);
      }
    }
  });

  it("ninguna fila resuelve a DOS preguntas distintas (un patrón demasiado ancho)", () => {
    for (const g of HC_ANTECEDENTES) {
      for (const f of g.filas) {
        if (!f.patron) continue;
        const n = preguntas.filter((q) => f.patron!.test(q.questionText)).length;
        expect(n, `El patrón de "${f.etiqueta}" casa ${n} preguntas; debe casar exactamente una`).toBeLessThanOrEqual(1);
      }
    }
  });
});
