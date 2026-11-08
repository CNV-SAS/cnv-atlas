// GENERA LA MIGRACION DEL MODULO S Y DEL INSTRUMENTO DE SEGUIMIENTO, A PARTIR DEL SEED.
//
// MISMA RAZON QUE `gen-survey-migration.mjs`, y la misma forma: el contenido de la encuesta tiene DOS
// canales (el seed, que hace local, y la migracion, que hace la nube). Escritos por separado divergen, y
// la divergencia no da error: local muestra un instrumento y la nube otro, cada uno coherente consigo
// mismo. Asi que esto se DERIVA del seed, con las mismas funciones, y no se edita a mano.
//
// ES UN GENERADOR APARTE Y NO UNA RAMA DEL OTRO: aquel emite un BUMP de la encuesta (version, preguntas,
// opciones) y este emite un INSTRUMENTO (sus items, que son filas de otra tabla y de otra naturaleza).
// Meterlos juntos daria un generador con dos modos, que es donde se cuela el dia que alguien toque uno.
//
// Como se corre:  node scripts/gen-cnvs-migration.mjs > drizzle/0241_el_modulo_s.sql
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const S = readFileSync("supabase/seed.ts", "utf8").replace(/\r\n/g, "\n");

const ctx = { createHash };
createContext(ctx);

/** Una constante `const X = "...";` o `const X = 123;` del seed. */
const constante = (nombre) => {
  const m = new RegExp(`^const ${nombre} = ("[^"]*"|\\d+);$`, "m").exec(S);
  if (!m) throw new Error(`no encuentro la constante ${nombre} en el seed`);
  return m[1].replace(/^"|"$/g, "");
};

/** Un bloque del seed (array, objeto o funcion), sin anotaciones de tipo, evaluado en el contexto. */
const bloque = (re, limpiar = (x) => x) => {
  const m = re.exec(S);
  if (!m) throw new Error(`no encuentro el bloque ${re}`);
  runInContext(limpiar(m[0]).replace(/^const /m, "var "), ctx);
};

bloque(/function surveyUuid\([\s\S]*?\n}/, (x) =>
  x.replace(/function surveyUuid\(\.\.\.parts: string\[\]\): string/, "function surveyUuid(...parts)"),
);
bloque(/^const SECTION_LABELS[\s\S]*?^};$/m, (x) => x.replace(/:\s*Record<[^=]*>\s*=/, " ="));
bloque(/^function sectionFor[\s\S]*?^}$/m, (x) => x.replace(/\(key:\s*string\):\s*string/, "(key)"));
bloque(/^const CNVS_SECTION[\s\S]*?^};$/m, (x) => x.replace(/:\s*Record<[^=]*>\s*=/, " ="));
bloque(/^const CNVS_COMPORTAMIENTO[\s\S]*?^};$/m, (x) => x.replace(/:\s*Record<[^=]*>\s*=/, " ="));
bloque(/^const CNVS_ORDEN_DE_SECCION = \[[\s\S]*?^\];$/m);

// Las dos listas de preguntas, con las constantes de opciones que usan.
const consts = S.split("\n")
  .filter((l) => /^const [A-Z_0-9]+ = \[.*\];$/.test(l))
  .join("\n")
  .replace(/^const /gm, "var ");
runInContext(consts, ctx);
const lista = (nombre) => {
  const ini = S.indexOf(`const ${nombre}: SurveyQ[] = [`);
  if (ini === -1) throw new Error(`no encuentro ${nombre} en el seed`);
  const fin = S.indexOf("\n];", ini);
  runInContext(`var ${nombre} = ${S.slice(S.indexOf("[", ini), fin + 2)};`, ctx);
};
lista("SURVEY_QUESTIONS");
lista("MODULO_S_QUESTIONS");

// Las cuatro constantes de id, y la funcion que arma los items.
for (const n of ["SURVEY_VERSION_ID", "CNVS_TEMPLATE_ID", "CNVS_VERSION_ID", "CNVS_INSTRUMENT_ID"]) {
  runInContext(`var ${n} = ${JSON.stringify(constante(n))};`, ctx);
}
runInContext(`var CNVS_VERSION_NUMBER = ${Number(constante("CNVS_VERSION_NUMBER"))};`, ctx);
bloque(/^function itemsDeLaCnvs\(\) \{[\s\S]*?^}$/m);

const PREGUNTAS = ctx.MODULO_S_QUESTIONS;
const ITEMS = ctx.itemsDeLaCnvs();
const esc = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);

const out = [];
const p = (l = "") => out.push(l);

p("-- MODULO S E INSTRUMENTO DE SEGUIMIENTO (CNV-S 1.0), ADITIVO Y FORWARD-ONLY.");
p("--");
p("-- GENERADO por scripts/gen-cnvs-migration.mjs desde supabase/seed.ts. NO editar a mano: el seed es la");
p("-- fuente unica del contenido y esto se deriva de el.");
p("--");
p("-- NO ACTIVA NADA. `CNVS_ACTIVA` esta en false, asi que ningun paciente ve este instrumento: lo que");
p("-- esta migracion hace es dejar el contenido en la base para que el smoke pueda encenderlo en local.");
p("--");
p("-- POR QUE EL MODULO S VA EN SU PROPIA VERSION: cuatro lectores enumeran las preguntas POR VERSION");
p("-- para medir completitud, el gate del diagnostico entre ellos. Siete preguntas mas en la version del");
p("-- cuestionario le habrian sumado siete huecos a TODAS las encuestas de linea base, y el gate habria");
p("-- dicho \"faltan 7\" a todo el mundo sin que nada fallara.");
p("--");
p("-- IDEMPOTENTE: ON CONFLICT DO NOTHING en todas las tablas.");
p();

p("-- LA SECCION DEL ITEM: lo UNICO que un instrumento cambia de una pregunta. En el seguimiento los ocho");
p("-- items que se confirman van juntos en su propio paso (\"Confirmar\") y no repartidos por sus dominios,");
p("-- que es el orden de su anexo A. NULL = se usa la seccion de la pregunta, que es el caso de la linea");
p("-- base y por eso la columna es nula y no tiene valor por defecto.");
p('ALTER TABLE "survey_instrument_items" ADD COLUMN IF NOT EXISTS "seccion" text;');
p();

p("INSERT INTO survey_templates (id, name, description) VALUES");
p(
  `  ('${ctx.CNVS_TEMPLATE_ID}', 'Módulo S de la Encuesta CNV-S', ` +
    esc(
      "Las siete preguntas PROPIAS de la encuesta de seguimiento (S1 a S6 y el filtro digestivo). Viven en su propia version para que los lectores que enumeran por version no las cuenten como huecos de la linea base.",
    ) +
    ")",
);
p("ON CONFLICT (id) DO NOTHING;");
p();

p("INSERT INTO survey_versions (id, template_id, version_number) VALUES");
p(`  ('${ctx.CNVS_VERSION_ID}', '${ctx.CNVS_TEMPLATE_ID}', ${ctx.CNVS_VERSION_NUMBER})`);
p("ON CONFLICT (id) DO NOTHING;");
p();

p(
  "INSERT INTO survey_questions (id, survey_version_id, question_text, question_type, field_key, hint, section, order_index, data_class, used_in_diagnosis) VALUES",
);
p(
  PREGUNTAS.map(
    (q, i) =>
      `  ('${ctx.surveyUuid("q", ctx.CNVS_VERSION_ID, q.key)}', '${ctx.CNVS_VERSION_ID}', ${esc(q.text)}, ` +
      `${esc(q.type)}, ${esc(q.key)}, ${esc(q.sub ?? null)}, ${esc(ctx.CNVS_SECTION[q.key] ?? "Otras")}, ` +
      `${i + 1}, 'clinical', false)`,
  ).join(",\n"),
);
p("ON CONFLICT (id) DO NOTHING;");
p();

const filasO = [];
for (const q of PREGUNTAS) {
  (q.options ?? []).forEach((o, j) => {
    filasO.push(
      `  ('${ctx.surveyUuid("o", ctx.CNVS_VERSION_ID, q.key, String(j))}', ` +
        `'${ctx.surveyUuid("q", ctx.CNVS_VERSION_ID, q.key)}', ${esc(o)}, null, ${j + 1})`,
    );
  });
}
p("INSERT INTO survey_options (id, question_id, option_text, value, order_index) VALUES");
p(filasO.join(",\n"));
p("ON CONFLICT (id) DO NOTHING;");
p();

p("INSERT INTO survey_instruments (id, codigo, nombre, descripcion) VALUES");
p(
  `  ('${ctx.CNVS_INSTRUMENT_ID}', 'CNV-S 1.0', 'Encuesta CNV-S (seguimiento)', ` +
    esc(
      "La version de seguimiento: repite, confirma, retira y añade el Módulo S. Apunta a LAS MISMAS preguntas de la línea base, que es la invariancia de su §7.4.",
    ) +
    ")",
);
p("ON CONFLICT (codigo) DO NOTHING;");
p();

p(
  "INSERT INTO survey_instrument_items (instrument_id, question_id, comportamiento, filtro_question_id, seccion, order_index) VALUES",
);
p(
  ITEMS.map(
    (it) =>
      `  ('${it.instrument_id}', '${it.question_id}', ${esc(it.comportamiento)}, ` +
      `${it.filtro_question_id ? `'${it.filtro_question_id}'` : "null"}, ${esc(it.seccion)}, ${it.order_index})`,
  ).join(",\n"),
);
p("ON CONFLICT (instrument_id, question_id) DO NOTHING;");
p();
const cuenta = {};
for (const it of ITEMS) cuenta[it.comportamiento] = (cuenta[it.comportamiento] ?? 0) + 1;
p(
  `-- ${PREGUNTAS.length} preguntas propias, ${filasO.length} opciones, ${ITEMS.length} items ` +
    `(${Object.entries(cuenta)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ")}).`,
);

process.stdout.write(out.join("\n") + "\n");
