import { beforeAll, describe, expect, it, vi } from "vitest";

import { and, desc, eq, isNotNull } from "drizzle-orm";

import { runEngine } from "@/clinical-engine";
import { normalizeHeader } from "@/modules/bis/services/header-map";
import {
  buildEngineInput,
  type SurveyFieldAnswer,
} from "@/modules/clinical-pipeline/services/build-engine-input";
import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";

// CANDADO anti-fallo-silencioso del acoplamiento encuesta <-> motor congelado. El riesgo
// (GILDARDO_QUERIES.md Q3, memoria del port): las option_text que emite la encuesta deben
// coincidir CARACTER por caracter con lo que leen calcLE8/computeDFIFromData, o el LE8/DFI
// dan basura en silencio. ENGINE_ANSWERS es la fuente unica de esas cadenas y se usa para
// dos cosas: (A) manejar el motor real (siempre corre, tambien en CI) y (B) verificar que
// el seed las contiene tal cual (BD real). Si el seed deriva, B falla; si el motor deja de
// reconocer una cadena, A falla.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el bloque contra BD se auto-salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const NOW = new Date("2026-06-22T00:00:00Z");
const MODEL = { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" };

// Respuestas de "alta senal": las cadenas EXACTAS que espera el motor. El "5" es de d3_23
// (opciones "0".."7"); "7-8 horas" lleva en-dash U+2013; los multi se codifican como los
// guarda el intake (JSON).
const ENGINE_ANSWERS: SurveyFieldAnswer[] = [
  { fieldKey: "d3_23", type: "opcion", value: "5" },
  { fieldKey: "d3_24", type: "opcion", value: "Más de 60 min" },
  { fieldKey: "d3_26", type: "opcion", value: "7–8 horas" },
  { fieldKey: "d3_30", type: "opcion", value: "Nunca he fumado" },
  { fieldKey: "d5_36", type: "opcion", value: "Sí" },
  { fieldKey: "d5_39", type: "opcion_multiple", value: JSON.stringify(["Diabetes tipo 2"]) },
  { fieldKey: "d2_21", type: "opcion_multiple", value: JSON.stringify(["Vómito"]) },
];

// Los 13 field_key que alimentan el motor (contrato estable con el seed). d3_31 (alcohol) se
// quito: es registro clinico, no alimenta el motor (Q6, resuelto por Gildardo).
const EXPECTED_FIELD_KEYS = [
  "d2_19", "d2_20", "d2_21", "d2_22",
  "d3_23", "d3_24", "d3_26", "d3_30",
  "d5_36", "d5_38", "d5_39",
  "d8_61", "d8_62",
].sort();

// bisRaw como lo guarda B8 (header normalizado -> valor) desde la fila anonimizada del
// Biody. Da un EngineInput valido para que corra la ruta BIS; el LE8/DFI que asertamos
// depende solo de la encuesta.
function bisRawFromFixture(): Record<string, number> {
  const bisRaw: Record<string, number> = {};
  for (const [k, v] of Object.entries(biodyJson as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) bisRaw[normalizeHeader(k)] = v;
  }
  return bisRaw;
}

describe("acoplamiento encuesta <-> motor (contrato de cadenas)", () => {
  it("con las cadenas exactas, el DFI corre completo y el LE8 refleja cada dominio", () => {
    const input = buildEngineInput(
      { sex: "Male", birthDate: "1971-11-05", surveyAnswers: ENGINE_ANSWERS, bisRaw: bisRawFromFixture() },
      MODEL,
      NOW,
    );
    const out = runEngine(input);

    // Wiring: al menos un d-field presente -> DFI completo, marcado explicito (no null).
    expect(out.dfi.complete).toBe(true);
    expect(out.dfi.degradedReason).toBeNull();

    // LE8 total sensible a 5 dominios string-exact: AF 100 ("Mas de 60 min" x 5 dias),
    // Tabaco 100 ("Nunca he fumado"), Sueno 100 ("7-8 horas" en-dash), Glucosa 20
    // ("Diabetes tipo 2"), Presion 30 ("Si"). Alimentacion 30 e Hidratacion 20 degradados
    // (Q3: sin d1_9/d1_10/d1_16). round((100+30+100+100+20+100+30+20)/8) = 63. Si una
    // cadena no coincide, el dominio cae a su default y el total cambia -> el test truena.
    expect(out.dfi.le8Total).toBe(63);

    // DFI conductual: "Vomito" dispara la conducta de riesgo (posible TCA) -> veto y la
    // ruta R3 prioritaria; el dominio d4 queda en severidad maxima.
    expect(out.dfi.veto).toBe(true);
    expect(out.dfi.rutas).toContain("R3 · Conductual (prioritaria)");
    expect(out.dfi.domains.find((d) => d.id === "d4")?.sev).toBe(3);
  });

  it("sin encuesta, el DFI queda degradado y marcado (no null silencioso)", () => {
    const input = buildEngineInput(
      { sex: "Male", birthDate: "1971-11-05", surveyAnswers: [], bisRaw: bisRawFromFixture() },
      MODEL,
      NOW,
    );
    const out = runEngine(input);
    expect(out.dfi.complete).toBe(false);
    expect(out.dfi.degradedReason).not.toBeNull();
    expect(out.dfi.le8Total).toBeNull();
  });
});

describe.skipIf(!HAS_DB)("acoplamiento con el seed (BD real)", () => {
  const seeded: { fieldKey: string; options: string[] }[] = [];

  beforeAll(async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const [ver] = await db
      .select({ id: schema.surveyVersions.id })
      .from(schema.surveyVersions)
      .orderBy(desc(schema.surveyVersions.publishedAt))
      .limit(1);
    const qs = await db
      .select({
        id: schema.surveyQuestions.id,
        fieldKey: schema.surveyQuestions.fieldKey,
      })
      .from(schema.surveyQuestions)
      .where(
        and(
          eq(schema.surveyQuestions.surveyVersionId, ver.id),
          isNotNull(schema.surveyQuestions.fieldKey),
        ),
      );
    for (const q of qs) {
      const opts = await db
        .select({ text: schema.surveyOptions.optionText })
        .from(schema.surveyOptions)
        .where(eq(schema.surveyOptions.questionId, q.id))
        .orderBy(schema.surveyOptions.orderIndex);
      seeded.push({ fieldKey: q.fieldKey as string, options: opts.map((o) => o.text) });
    }
  });

  it("el seed expone exactamente los 13 field_key esperados", () => {
    expect(seeded.map((r) => r.fieldKey).sort()).toEqual(EXPECTED_FIELD_KEYS);
  });

  it("cada cadena de alta senal existe en el seed char-by-char", () => {
    for (const a of ENGINE_ANSWERS) {
      const row = seeded.find((r) => r.fieldKey === a.fieldKey);
      expect(row, `field_key ${a.fieldKey} presente en el seed`).toBeDefined();
      const values =
        a.type === "opcion_multiple" ? (JSON.parse(a.value) as string[]) : [a.value];
      for (const v of values) {
        expect(row?.options, `${a.fieldKey} debe contener "${v}"`).toContain(v);
      }
    }
  });
});
