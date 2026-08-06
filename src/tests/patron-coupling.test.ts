import { and, desc, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { FREQ_OPC, FREQ_SUP } from "@/clinical-engine/frozen/engine.patron.js";

// CANDADO del patron alimentario (acoplamiento DOBLE: posicion + texto). El reader (patron.ts) resuelve
// el ordinal de cada respuesta contra los textos CANONICOS del frozen (FREQ_OPC / FREQ_SUP). Si alguien
// REORDENA (cambia que "Nunca" sea 0) o REESCRIBE (una tilde, el en-dash), calcPatron leeria frecuencias
// equivocadas en silencio. Este candado ancla las dos cosas:
//   (A) CI: el frozen tiene el ORDEN y el TEXTO esperados (Nunca=0 .. Todos=4, en-dash U+2013).
//   (B) BD: la semilla tiene esas mismas cadenas char-by-char y en el mismo orden.
// Con el DIFF-patron (frozen == v8) cierra el triple ancla v8 -> frozen -> semilla.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el bloque contra BD se auto-salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const GROUP_KEYS = Array.from({ length: 15 }, (_, i) => `d1_${i + 1}_i`);

describe("candado patron (A): el frozen ancla orden y texto de las opciones", () => {
  it("FREQ_OPC tiene las 5 opciones en el orden esperado (Nunca=0 .. Todos los dias=4)", () => {
    expect(FREQ_OPC).toEqual(["Nunca", "1–2 días", "3–4 días", "5–6 días", "Todos los días"]);
  });

  it("la opcion 1 lleva EN-DASH U+2013, no guion normal", () => {
    expect(FREQ_OPC[1]).toContain("–"); // en-dash
    expect(FREQ_OPC[1]).not.toContain("-"); // guion normal ausente
  });

  it("los 3 horarios (FREQ_SUP) traen sus claves y sets esperados", () => {
    expect(FREQ_SUP.map((s) => s.key)).toEqual(["d1f_sal_i", "d1f_des_i", "d1f_noche_i"]);
    expect(FREQ_SUP[0].opts).toEqual(["Nunca", "Rara vez", "Con frecuencia", "Siempre"]);
    expect(FREQ_SUP[1].opts).toEqual(["Sí, todos los días", "A veces (3–4 días)", "Rara vez o nunca"]);
    expect(FREQ_SUP[2].opts).toEqual(["Antes de las 7 pm", "Entre 7 y 8 pm", "Entre 8 y 9 pm", "Después de las 9 pm"]);
  });
});

describe.skipIf(!HAS_DB)("candado patron (B): la semilla == frozen char-by-char y en orden", () => {
  it("las 15 preguntas de grupo tienen exactamente FREQ_OPC, mismo orden", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const [ver] = await db
      .select({ id: schema.surveyVersions.id })
      .from(schema.surveyVersions)
      .orderBy(desc(schema.surveyVersions.publishedAt))
      .limit(1);

    for (const key of GROUP_KEYS) {
      const [q] = await db
        .select({ id: schema.surveyQuestions.id })
        .from(schema.surveyQuestions)
        .where(and(eq(schema.surveyQuestions.surveyVersionId, ver.id), eq(schema.surveyQuestions.fieldKey, key)))
        .limit(1);
      expect(q, `field_key ${key} presente en el seed`).toBeDefined();
      const opts = await db
        .select({ text: schema.surveyOptions.optionText })
        .from(schema.surveyOptions)
        .where(eq(schema.surveyOptions.questionId, q.id))
        .orderBy(schema.surveyOptions.orderIndex);
      expect(opts.map((o) => o.text), `opciones de ${key} == FREQ_OPC`).toEqual(FREQ_OPC);
    }
  });

  it("los 3 horarios tienen exactamente su set de FREQ_SUP, mismo orden", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const [ver] = await db
      .select({ id: schema.surveyVersions.id })
      .from(schema.surveyVersions)
      .orderBy(desc(schema.surveyVersions.publishedAt))
      .limit(1);

    for (const sup of FREQ_SUP) {
      const [q] = await db
        .select({ id: schema.surveyQuestions.id })
        .from(schema.surveyQuestions)
        .where(and(eq(schema.surveyQuestions.surveyVersionId, ver.id), eq(schema.surveyQuestions.fieldKey, sup.key)))
        .limit(1);
      expect(q, `field_key ${sup.key} presente en el seed`).toBeDefined();
      const opts = await db
        .select({ text: schema.surveyOptions.optionText })
        .from(schema.surveyOptions)
        .where(eq(schema.surveyOptions.questionId, q.id))
        .orderBy(schema.surveyOptions.orderIndex);
      expect(opts.map((o) => o.text), `opciones de ${sup.key} == FREQ_SUP`).toEqual(sup.opts);
    }
  });
});
