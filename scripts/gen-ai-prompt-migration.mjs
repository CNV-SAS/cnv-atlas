// GENERA LA MIGRACION QUE PUBLICA UNA VERSION DE UN PROMPT DE IA, A PARTIR DEL SEED.
//
// POR QUE EXISTE (2026-09-08). `ai_prompts` es el TERCER catalogo sin camino a la nube, y el unico que
// estaba desincronizado DE VERDAD, no en potencia:
//
//   LOCAL   criterio.generate v1 inactive · v2 ACTIVE
//   NUBE    criterio.generate v1 ACTIVE
//
// La v2 (el bloque de formato que Gildardo pidio en su §8 del 2026-09-01, el que prohibe markdown) nunca
// llego a produccion, porque `ai_prompts` solo lo publicaba `supabase/seed.ts`, que es el seed DESTRUCTIVO
// que no se puede correr contra la nube.
//
// Y ES PEOR QUE UNA FILA AUSENTE: `getActivePrompt` hace que la fila de BASE GANE sobre el texto canonico
// del codigo. Con la v1 activa, la nube no cae al texto del repositorio: corre el viejo. (Una fila
// AUSENTE si cae al canonico, que es el diseño deliberado de `menu.adapt`.)
//
// EL CONTENIDO SE DERIVA DEL SEED, que a su vez lo lee del JSON canonico que consume la app. Tres sitios,
// una sola fuente. Escribir el texto aqui seria la cuarta copia del mismo parrafo.
//
// Como se corre:  node scripts/gen-ai-prompt-migration.mjs <numero> <clave> > drizzle/NNNN_prompt_<clave>.sql
import { readFileSync } from "node:fs";

const SEED = "supabase/seed.ts";
const S = readFileSync(SEED, "utf8").replace(/\r\n/g, "\n");

const [numero, clave] = process.argv.slice(2);
if (!/^\d+$/.test(numero ?? "") || !clave) {
  console.error("Uso: node scripts/gen-ai-prompt-migration.mjs <numero de migracion> <prompt_key>");
  console.error("     p. ej.  node scripts/gen-ai-prompt-migration.mjs 0102 criterio.generate");
  process.exit(2);
}

// ── La VERSION, de la tabla que el propio seed usa para decidir que publicar. ──
const bloqueSeed = /const PROMPTS_SEED = \[([\s\S]*?)\];/.exec(S)?.[1];
if (!bloqueSeed) throw new Error(`no encuentro PROMPTS_SEED en ${SEED}`);
const versiones = new Map(
  [...bloqueSeed.matchAll(/prompt_key:\s*"([^"]+)",\s*version:\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]),
);
const version = versiones.get(clave);
if (!version) {
  throw new Error(`la clave ${clave} no esta en PROMPTS_SEED (hay: ${[...versiones.keys()].join(", ")})`);
}

// ── El CONTENIDO, del mismo JSON canonico que lee el seed. La ruta se saca del seed, no se escribe: si
//    algun dia el JSON se mueve, el generador se entera igual que la app. ──
const RUTA_POR_CLAVE = {
  "menu.adapt": /const menuAdaptSystemPrompt[\s\S]*?new URL\(\s*"\.\.\/([^"]+)"/,
  "criterio.generate": /const criterionSystemPrompt[\s\S]*?new URL\(\s*"\.\.\/([^"]+)"/,
};
const patron = RUTA_POR_CLAVE[clave];
if (!patron) {
  throw new Error(
    `no se de que JSON sale el texto de "${clave}". Anade su patron a RUTA_POR_CLAVE, leyendo del seed.`,
  );
}
const ruta = patron.exec(S)?.[1];
if (!ruta) throw new Error(`no encuentro la ruta del JSON de ${clave} en ${SEED}`);
const contenido = JSON.parse(readFileSync(ruta, "utf8")).system;
if (typeof contenido !== "string" || contenido.length < 100) {
  throw new Error(`el texto de ${clave} salio vacio o demasiado corto de ${ruta}`);
}

const esc = (v) => `'${String(v).replace(/'/g, "''")}'`;
const out = [];
const p = (l = "") => out.push(l);

p(`-- PROMPT DE IA "${clave}" v${version}: publica en BD la version que ya vive en el codigo.`);
p(`--`);
p(`-- GENERADO por scripts/gen-ai-prompt-migration.mjs desde ${SEED}, que a su vez lee el JSON canonico`);
p(`-- ${ruta}. NO editar a mano: el texto vive en UN sitio y esto se deriva de el.`);
p(`--`);
p(`-- POR QUE HACIA FALTA: \`ai_prompts\` solo lo publicaba el seed principal, que BORRA y re-inserta las`);
p(`-- respuestas de encuesta y por eso no se corre contra la nube. Resultado: la v2 de criterio.generate`);
p(`-- se quedo en local y produccion siguio con la v1. Y no es una fila que falta y cae al codigo: la fila`);
p(`-- de base GANA sobre el texto canonico (\`getActivePrompt\`), asi que la vieja seguia mandando.`);
p(`--`);
p(`-- RESPETA LA EDICION DEL ADMIN, que es el mismo criterio que el seed: si en \`/admin/ia\` hay una`);
p(`-- version MAS NUEVA activa, esta entra como historica y no se activa. Solo se desactiva lo ANTERIOR.`);
p(`--`);
p(`-- Y RESPETA EL INDICE PARCIAL \`ai_prompts_one_active_idx\` (una sola fila activa por clave), que es`);
p(`-- donde ya nos estrellamos una vez: el upsert del seed no chocaba con la otra version, chocaba con su`);
p(`-- ESTADO. Por eso se desactiva ANTES de insertar, y la insercion decide su propio estado.`);
p(`--`);
p(`-- IDEMPOTENTE: aplicarla dos veces deja lo mismo. La tercera sentencia existe para el caso de re-`);
p(`-- aplicacion, en el que la fila ya existe y el ON CONFLICT no la tocaria.`);
p();
p(`-- 1. Retirar la activa ANTERIOR (nunca una posterior: esa es una edicion del admin).`);
p(`UPDATE ai_prompts SET status = 'inactive'`);
p(` WHERE prompt_key = ${esc(clave)} AND status = 'active' AND version < ${version};`);
p();
p(`-- 2. Insertar esta version. Queda ACTIVA solo si no quedo ninguna activa (o sea, si no hay una`);
p(`--    posterior del admin). \`created_by\` va NULL a proposito: el admin de cada entorno es otro, y un`);
p(`--    uuid escrito aqui apuntaria a un perfil que en la nube no existe.`);
p(`INSERT INTO ai_prompts (prompt_key, version, content, status)`);
p(`SELECT ${esc(clave)}, ${version}, ${esc(contenido)},`);
p(`       CASE WHEN EXISTS (SELECT 1 FROM ai_prompts WHERE prompt_key = ${esc(clave)} AND status = 'active')`);
p(`            THEN 'inactive' ELSE 'active' END`);
p(`ON CONFLICT (prompt_key, version) DO NOTHING;`);
p();
p(`-- 3. Y si la fila ya existia (re-aplicacion) y nadie quedo activo, activarla.`);
p(`UPDATE ai_prompts SET status = 'active'`);
p(` WHERE prompt_key = ${esc(clave)} AND version = ${version}`);
p(`   AND NOT EXISTS (SELECT 1 FROM ai_prompts WHERE prompt_key = ${esc(clave)} AND status = 'active');`);

console.log(out.join("\n"));
