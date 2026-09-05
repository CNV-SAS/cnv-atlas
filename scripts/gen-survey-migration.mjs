// GENERA LA MIGRACION DE UN BUMP DE ENCUESTA A PARTIR DEL SEED.
//
// POR QUE GENERADA Y NO ESCRITA A MANO. El bump tiene DOS canales: el seed (local) y la migracion (nube).
// Si se escriben por separado, divergen, y la divergencia no da error: local muestra un instrumento y la
// nube otro, cada uno coherente consigo mismo. Ya nos paso con los dos canales del plan (seis cosas
// distintas antes de que un candado lo viera).
//
// La migracion se DERIVA del seed, que es la fuente unica del contenido, con la MISMA funcion de id
// determinista. Asi no hay nada que sincronizar: si el seed cambia, se regenera.
//
// Como se corre:  node scripts/gen-survey-migration.mjs <numero> > drizzle/NNNN_encuesta_vN.sql
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const S = readFileSync("supabase/seed.ts", "utf8").replace(/\r\n/g, "\n");

const constante = (nombre) => {
  const m = new RegExp(`^const ${nombre} = ("[^"]*"|\\d+);$`, "m").exec(S);
  if (!m) throw new Error(`no encuentro la constante ${nombre} en el seed`);
  return m[1].replace(/^"|"$/g, "");
};
const VERSION_ID = constante("SURVEY_VERSION_ID");
const VERSION_NUMBER = Number(constante("SURVEY_VERSION_NUMBER"));
const TEMPLATE_ID = constante("SURVEY_TEMPLATE_ID");

// La MISMA derivacion de id que el seed. Se copia el cuerpo desde el seed, no se re-implementa: dos
// implementaciones de un id determinista es exactamente como se generan filas que nadie cruza.
const cuerpoUuid = /function surveyUuid\([\s\S]*?\n}/.exec(S)?.[0];
if (!cuerpoUuid) throw new Error("no encuentro surveyUuid en el seed");
const ctx = { createHash };
createContext(ctx);
runInContext(cuerpoUuid.replace(/function surveyUuid\(\.\.\.parts: string\[\]\): string/, "function surveyUuid(...parts)"), ctx);
const surveyUuid = (...p) => ctx.surveyUuid(...p);

// Las preguntas, del mismo arreglo que siembra el seed.
const ini = S.indexOf("const SURVEY_QUESTIONS");
const fin = S.indexOf("\n];", ini);
const consts = S.slice(0, ini)
  .split("\n")
  .filter((l) => /^const [A-Z_0-9]+ = \[.*\];$/.test(l))
  .join("\n")
  .replace(/^const /gm, "var ");
const c2 = {};
createContext(c2);
runInContext(consts, c2);
runInContext(`var _q = ${S.slice(S.indexOf("[", ini), fin + 2)};`, c2);
const PREGUNTAS = c2._q;

// SECTION_LABELS y sectionFor tambien salen del seed: la seccion de cada pregunta es contenido, y
// re-implementarla aqui es abrir la segunda fuente que este generador existe para cerrar. Solo se quitan
// las anotaciones de tipo, que es lo unico que `vm` no entiende.
const labels = /^const SECTION_LABELS[\s\S]*?^};$/m.exec(S)?.[0];
const secFn = /^function sectionFor[\s\S]*?^}$/m.exec(S)?.[0];
if (!labels || !secFn) throw new Error("no encuentro SECTION_LABELS / sectionFor en el seed");
runInContext(labels.replace(/^const /, "var ").replace(/:\s*Record<[^=]*>\s*=/, " ="), c2);
runInContext(secFn.replace(/\(key:\s*string\):\s*string/, "(key)"), c2);
if (typeof c2.sectionFor !== "function") throw new Error("sectionFor no quedo definida");

const esc = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const out = [];
const p = (l = "") => out.push(l);

p(`-- ENCUESTA v${VERSION_NUMBER}: bump de instrumento, ADITIVO Y FORWARD-ONLY.`);
p(`--`);
p(`-- GENERADO por scripts/gen-survey-migration.mjs desde supabase/seed.ts. NO editar a mano: el seed es`);
p(`-- la fuente unica del contenido y esto se deriva de el. Editarlo aqui hace que los dos canales del`);
p(`-- bump (local por seed, nube por migracion) digan cosas distintas sin que nada de error.`);
p(`--`);
p(`-- POR QUE UNA MIGRACION Y NO \`db:seed\` CONTRA LA NUBE: el seed BORRA y re-inserta las preguntas, las`);
p(`-- opciones y LAS RESPUESTAS de la version vigente. Contra la nube se llevaria datos reales. Esto solo`);
p(`-- INSERTA: no toca survey_responses ni survey_answers, ni una fila.`);
p(`--`);
p(`-- POR QUE LAS VERSIONES ANTERIORES QUEDAN INTACTAS: los ids se derivan de (tipo, VERSION_ID, clave),`);
p(`-- asi que un VERSION_ID nuevo produce filas NUEVAS. Las respuestas viejas siguen apuntando a las`);
p(`-- preguntas de su version, cuyas opciones no cambian. Sin esa propiedad, un bump moveria las filas y`);
p(`-- dejaria las evaluaciones anteriores apuntando al vacio.`);
p(`--`);
p(`-- IDEMPOTENTE: ON CONFLICT DO NOTHING en las tres tablas. Correrla dos veces deja lo mismo.`);
p();
p(`INSERT INTO survey_versions (id, template_id, version_number) VALUES`);
p(`  ('${VERSION_ID}', '${TEMPLATE_ID}', ${VERSION_NUMBER})`);
p(`ON CONFLICT (id) DO NOTHING;`);
p();
// LAS MISMAS COLUMNAS Y LOS MISMOS VALORES QUE EL SEED, incluidas `field_key` (que es null cuando ningun
// motor la lee) y `used_in_diagnosis` (solo las del DIAGNOSTICO). Escribirlas distinto aqui produciria una
// v6 que se ve igual en pantalla y se comporta distinto en el motor.
p(
  `INSERT INTO survey_questions (id, survey_version_id, question_text, question_type, field_key, hint, section, order_index, data_class, used_in_diagnosis) VALUES`,
);
const filasQ = PREGUNTAS.map((q, i) => {
  const fieldKey = q.engine || q.treatmentEngine || q.patternEngine ? q.key : null;
  return (
    `  ('${surveyUuid("q", VERSION_ID, q.key)}', '${VERSION_ID}', ${esc(q.text)}, ${esc(q.type)}, ` +
    `${esc(fieldKey)}, ${esc(q.sub ?? null)}, ${esc(c2.sectionFor(q.key))}, ${i + 1}, 'clinical', ${!!q.engine})`
  );
});
p(filasQ.join(",\n"));
p(`ON CONFLICT (id) DO NOTHING;`);
p();

// `value` va null a proposito, como en el seed: el motor lee `option_text` (la cadena), no un score. Los
// cortes viven en el motor y no se inventa scoring en la tabla.
const filasO = [];
for (const q of PREGUNTAS) {
  (q.options ?? []).forEach((o, j) => {
    filasO.push(
      `  ('${surveyUuid("o", VERSION_ID, q.key, String(j))}', '${surveyUuid("q", VERSION_ID, q.key)}', ${esc(o)}, null, ${j + 1})`,
    );
  });
}
p(`INSERT INTO survey_options (id, question_id, option_text, value, order_index) VALUES`);
p(filasO.join(",\n"));
p(`ON CONFLICT (id) DO NOTHING;`);
p();
p(`-- ${PREGUNTAS.length} preguntas, ${filasO.length} opciones.`);

process.stdout.write(out.join("\n") + "\n");
