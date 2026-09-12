// Comprueba si la BD (DATABASE_URL) tiene TODAS las migraciones del repo aplicadas.
//
// Como se corre:  node --env-file=.env.local scripts/check-migrations.mjs
//   (o apuntando DATABASE_URL a la nube para chequear produccion)
//
// Por que existe: Vercel despliega el CODIGO en cada push, pero NO corre las migraciones.
// Si el codigo desplegado espera una tabla que la nube no tiene, la pantalla revienta con
// "Could not find the table ..." y la causa queda solo en Sentry. Este chequeo convierte ese
// fallo mudo en un aviso claro ANTES de que un usuario lo encuentre. Solo LEE (un SELECT); es
// seguro contra produccion y funciona por el pooler.
//
// Salida: lista las migraciones pendientes (o "al dia"). Exit code 1 si hay pendientes, para
// poder encadenarlo en un checklist o CI.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || DATABASE_URL.trim() === "") {
  console.error("Falta DATABASE_URL (usa --env-file=.env.local, o apunta a la nube para chequear produccion).");
  process.exit(2);
}

// CONTRA QUE BASE. Es el script donde mas falta hacia: su trabajo ENTERO es comparar el repo contra una
// base de datos, y hasta hoy no decia cual. "La BD esta AL DIA" es una afirmacion sobre una base sin
// nombre. Se deriva del host de la propia DATABASE_URL, nunca de la credencial.
console.log(`Base: ${new URL(DATABASE_URL).host}`);

// ── CONTRA QUE VERSION DEL REPO, que es la pregunta que este chequeo no se hacia ────────────────
//
// EL CASO REAL (2026-09-12). Santiago corrio este chequeo y dijo "al dia", con 133 en el repo y 133 en la
// base. Y `patients.is_test` NO EXISTIA: la migracion 0132 estaba en un commit que todavia no habia
// traido. Las dos mitades de la comparacion salian del MISMO arbol de trabajo, asi que faltaba en las dos
// y el conteo cuadraba. El chequeo no mintio sobre lo que mide; medio otra cosa.
//
// Y NO SE ARREGLA COMPARANDO CONTRA EL ESQUEMA, aunque sea lo primero que uno piensa. El esquema esperado
// tambien saldria del arbol de trabajo (los snapshots de drizzle viven en el repo), asi que en este caso
// estaria igual de atrasado y volveria a decir "al dia". Lo que falta no es una segunda fuente del
// esquema: es saber que el arbol esta atrasado.
//
// Lo que SI cierra el caso: preguntarle al remoto si hay commits con migraciones que no estan aqui.
function gitSeguro(args, opciones = {}) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: opciones.timeout ?? 5000,
    }).trim();
  } catch {
    return null; // sin git, sin red o sin credenciales: se degrada a aviso, no a error.
  }
}

function avisarSiElArbolEstaAtrasado() {
  const head = gitSeguro(["rev-parse", "--short", "HEAD"]);
  if (!head) {
    console.log("Repo:  (sin git: no se puede saber contra que version se compara)");
    return;
  }
  const rama = gitSeguro(["rev-parse", "--abbrev-ref", "HEAD"]) ?? "HEAD";
  console.log(`Repo:  ${head} (${rama})`);

  // Un .sql sin commitear tambien envenena la comparacion, por el otro lado: el journal local lo cuenta y
  // la nube no puede tenerlo, asi que saldria como "pendiente" siendo correcto.
  const sucio = gitSeguro(["status", "--porcelain", "--", "drizzle/"]);
  if (sucio) {
    console.log(`AVISO: hay cambios sin commitear en drizzle/ (${sucio.split("\n").length} archivo(s)).`);
  }

  // El fetch puede no estar disponible (sin red, sin credenciales). Es una mejora, no un requisito.
  const trajo = gitSeguro(["fetch", "--quiet", "origin"], { timeout: 15000 }) !== null;
  const remoto = `origin/${rama}`;
  const existe = gitSeguro(["rev-parse", "--verify", "--quiet", remoto]);
  if (!existe) return;

  // SOLO importan los commits que TOCAN migraciones. Estar atrasado en codigo no invalida esta respuesta;
  // estarlo en drizzle/ si, y avisar de lo otro convertiria el aviso en ruido que se aprende a ignorar.
  const conMigraciones = gitSeguro([
    "log", "--oneline", `HEAD..${remoto}`, "--", "drizzle/meta/_journal.json", "drizzle/",
  ]);
  if (conMigraciones) {
    const n = conMigraciones.split("\n").length;
    console.error(`\nEL ARBOL DE TRABAJO ESTA ATRASADO: ${remoto} tiene ${n} commit(s) con migraciones que aqui no estan.`);
    for (const l of conMigraciones.split("\n").slice(0, 5)) console.error(`    ${l}`);
    console.error("\n  Este chequeo compara la BD contra EL REPO QUE TIENES, y le faltan migraciones.");
    console.error("  Diria 'al dia' sobre una base a la que le falta lo mismo que a este arbol.");
    console.error("  Corre `git pull` y vuelve a chequear.");
    process.exit(1);
  }
  if (!trajo) {
    console.log(`AVISO: no se pudo consultar el remoto, asi que la comparacion es contra la ultima vez`);
    console.log(`       que se trajo ${remoto}. Si alguien pusheo una migracion despues, no se ve aqui.`);
  }
}

avisarSiElArbolEstaAtrasado();

const journal = JSON.parse(
  readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
);
const repoEntries = journal.entries ?? [];

// GUARDA DE INTEGRIDAD (2026-08-26): este chequeo mide el journal, NO el disco. Un .sql sin su entrada
// en el journal era INVISIBLE aqui, asi que el script decia "al dia" con una migracion sin aplicar
// esperando en el repo: mentia por el lado peligroso, que es peor que no tener chequeo. Paso con 0083,
// 0084 y 0085. Ahora se cotejan las dos listas y se FALLA si divergen.
const sqlFiles = readdirSync(new URL("../drizzle/", import.meta.url))
  .filter((f) => f.endsWith(".sql"))
  .map((f) => f.replace(/\.sql$/, ""))
  .sort();
const tags = new Set(repoEntries.map((e) => e.tag));
const huerfanos = sqlFiles.filter((f) => !tags.has(f));
const fantasmas = [...tags].filter((t) => !sqlFiles.includes(t));
if (huerfanos.length > 0 || fantasmas.length > 0) {
  console.error("INTEGRIDAD DEL JOURNAL ROTA: el journal y los archivos .sql no coinciden.\n");
  if (huerfanos.length > 0) {
    console.error(`  .sql SIN entrada en el journal (${huerfanos.length}). Drizzle NO los va a aplicar:`);
    for (const f of huerfanos) console.error(`    - ${f}.sql`);
    console.error("  Agrega su entrada a drizzle/meta/_journal.json (idx, version, when, tag, breakpoints).");
  }
  if (fantasmas.length > 0) {
    console.error(`\n  Entradas del journal SIN archivo .sql (${fantasmas.length}):`);
    for (const t of fantasmas) console.error(`    - ${t}`);
  }
  console.error("\nHasta arreglarlo, este chequeo NO puede afirmar que la BD esta al dia.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1, prepare: false });
try {
  // La tabla de control de drizzle-kit: schema `drizzle`, columna created_at = el `when` del journal (ms).
  const exists = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations' LIMIT 1
  `;
  let appliedWhens = new Set();
  if (exists.length > 0) {
    const rows = await sql`SELECT created_at FROM drizzle.__drizzle_migrations`;
    appliedWhens = new Set(rows.map((r) => String(r.created_at)));
  }

  const pending = repoEntries.filter((e) => !appliedWhens.has(String(e.when)));

  console.log(`Migraciones en el repo: ${repoEntries.length} · aplicadas en la BD: ${appliedWhens.size}`);
  if (pending.length === 0) {
    console.log("La BD esta AL DIA con el repo. Nada que migrar.");
    await sql.end();
    process.exit(0);
  }
  console.log(`\nPENDIENTES (${pending.length}) — el codigo desplegado puede reventar hasta que se apliquen:`);
  for (const e of pending) console.log(`  - ${e.tag}`);
  console.log(`\nCorrer:  pnpm db:migrate   (con DATABASE_URL apuntando a esta BD)`);
  await sql.end();
  process.exit(1);
} catch (err) {
  console.error("Error chequeando migraciones:", err instanceof Error ? err.message : err);
  await sql.end();
  process.exit(2);
}
