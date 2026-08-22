import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";

// GUARD |db| (paso 4 de la cadena de 1b): que los field_key de los campos de dieta esten en LA VERSION QUE
// USAN LAS EVALUACIONES REALES, no solo en la ultima (el seed). El guard unit (survey-field-keys-reach-
// consumers) lee el SEED (version vigente); pero una eval real puede ser de una version vieja cuyas preguntas
// son OTRAS filas sin field_key, y la migration pudo no cubrirla. Eso fue exactamente el paso 4: Nico es v3,
// la migration solo toco v5, el parrafo salio incompleto. Este guard, contra la BD, asserta el invariante:
// toda version de encuesta que tiene evaluaciones debe tener field_key en los campos que el parrafo consume.
//
// Solo comprueba las versiones PRESENTES en esta BD (las que tienen evals): es su alcance correcto. Si una
// migration futura deja una version usada sin field_key, este guard truena contra esa BD.

if (!process.env.DATABASE_URL) process.loadEnvFile?.(".env.local");
const HAS_DB = Boolean(process.env.DATABASE_URL);
const sql = HAS_DB ? postgres(process.env.DATABASE_URL!, { max: 1, prepare: false }) : null;

afterAll(async () => {
  await sql?.end();
});

// Los 5 campos que fueron el bug (contexto d8 + hidratacion d7), por su texto de pregunta. Si una version
// usada tiene la pregunta pero sin field_key, el parrafo de dieta sale incompleto para esas evals.
const DIET_TEXTS = [
  "¿Quién prepara sus alimentos habitualmente?",
  "¿Con qué frecuencia come fuera de casa?",
  "Agua (vasos de 200 ml por día)",
  "Gaseosas (vasos por día)",
  "Bebidas energéticas (latas por día)",
];

describe.skipIf(!HAS_DB)("guard |db|: los campos de dieta tienen field_key en las versiones con evaluaciones", () => {
  it("toda version de encuesta con evaluaciones tiene field_key en los 5 campos que tenga", async () => {
    // Versiones que tienen al menos una evaluacion (via survey_responses), y el field_key de cada uno de los
    // 5 campos presentes en esa version.
    const rows = await sql!`
      select sv.version_number as version, sq.question_text, sq.field_key
      from survey_versions sv
      join survey_questions sq on sq.survey_version_id = sv.id
      where sv.id in (select distinct survey_version_id from survey_responses)
        and sq.question_text in ${sql!(DIET_TEXTS)}
      order by sv.version_number, sq.question_text`;

    // Los que faltan field_key: cada uno es una version usada donde el parrafo saldria incompleto.
    const faltantes = rows
      .filter((r) => r.field_key == null)
      .map((r) => `v${r.version} · ${r.question_text}`);

    // Si truena: correr la data-migration de field_keys de dieta contra esta BD (cubre TODAS las versiones).
    expect(faltantes).toEqual([]);
  });
});
