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

import { readFileSync } from "node:fs";

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || DATABASE_URL.trim() === "") {
  console.error("Falta DATABASE_URL (usa --env-file=.env.local, o apunta a la nube para chequear produccion).");
  process.exit(2);
}

const journal = JSON.parse(
  readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
);
const repoEntries = journal.entries ?? [];

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
