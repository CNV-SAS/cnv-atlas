import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ CON --commit, LO QUE DICE QUE QUEDA TIENE QUE QUEDAR (Santiago, 2026-10-15) ═══
//
// EL CASO. Corrio `ANOTAR_LA_CUENTA_PAGADA` con `--commit` contra la nube y la salida termino con
// "there is no transaction in progress". Pregunto si era inocuo. No lo era:
//
//   · los scripts de operacion traen su `rollback;` al final y su `commit;` comentado. Es lo correcto para
//     el editor de Supabase, donde se pegan a mano: por defecto no dejan nada, y se descomenta el commit
//     cuando se quiere aplicar de verdad;
//   · `aplicar-migracion.mjs` quitaba del archivo el `begin;` y el `commit;` (la transaccion la pone la
//     herramienta), PERO NO EL `rollback;`;
//   · asi que esa linea revertia la transaccion de la herramienta desde dentro, el COMMIT del driver
//     llegaba sin transaccion abierta (de ahi el aviso), y la salida decia igual "CONFIRMADO: los cambios
//     quedan en la base".
//
// POR QUE ES EL MISMO DEFECTO QUE EL DE `--confirmar` (ver `aplicar-migracion-banderas.test.ts`): la
// herramienta promete un modo y ejecuta el otro, sin error y sin pista. En ese script no se perdio nada
// porque no alcanzaba ninguna fila; con la carga de la bodega habria dicho que cargo 1.810 unidades.
//
// SE PRUEBA EJECUTANDO LA HERRAMIENTA DE VERDAD y mirando la base despues. Un candado que buscara el
// `.replace` en el fuente pasaria verde el dia que el replace este pero el orden cambie, y lo que falla es
// el COMPORTAMIENTO: si la fila quedo o no quedo.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("aplicar-migracion con --commit no revierte (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let carpeta = "";
  const TABLA = "_candado_rollback_aplicar_migracion";

  /** Un script de operacion como los de verdad: su propio begin, su rollback al final, su commit comentado. */
  function escribir(nombre: string, cuerpo: string): string {
    const ruta = join(carpeta, nombre);
    writeFileSync(ruta, `begin;\n\n${cuerpo}\n\nrollback;\n-- commit;\n`, "utf8");
    return ruta;
  }

  function correr(ruta: string, ...banderas: string[]): string {
    return execFileSync("node", ["scripts/aplicar-migracion.mjs", ruta, ...banderas], {
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  const filas = async (): Promise<number> => {
    const [f] = await db.execute(
      dsql`select count(*)::int as n from pg_tables where tablename = ${TABLA}`,
    );
    if (Number(f.n) === 0) return 0;
    const [g] = await db.execute(dsql`select count(*)::int as n from ${dsql.raw(TABLA)}`);
    return Number(g.n);
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    carpeta = mkdtempSync(join(tmpdir(), "candado-aplicar-"));
    await db.execute(dsql`drop table if exists ${dsql.raw(TABLA)}`);
  }, 30_000);

  afterAll(async () => {
    if (!HAS_DB) return;
    await db.execute(dsql`drop table if exists ${dsql.raw(TABLA)}`);
    if (carpeta) rmSync(carpeta, { recursive: true, force: true });
  });

  it("el rollback del archivo NO decide: con --commit la fila queda", async () => {
    const ruta = escribir(
      "deja-una-fila.sql",
      `create table ${TABLA} (nota text);\ninsert into ${TABLA} (nota) values ('la dejo el candado');`,
    );
    const salida = correr(ruta, "--commit");
    expect(salida).toContain("CONFIRMADO");
    expect(
      await filas(),
      "la herramienta dijo CONFIRMADO y no quedo nada: es el defecto del 15 de octubre",
    ).toBe(1);
  }, 30_000);

  it("y lo dice en voz alta, porque cambiar el contenido de un script en silencio es la otra mitad", async () => {
    const ruta = escribir("solo-un-select.sql", `select 1 as uno;`);
    const salida = correr(ruta);
    expect(salida, "no avisa que retiro el control de transaccion del archivo").toMatch(/se retiro/i);
    expect(salida).toContain("rollback;");
  }, 30_000);

  it("sin la bandera sigue revirtiendo: el modo lo decide la bandera, no el archivo", async () => {
    await db.execute(dsql`drop table if exists ${dsql.raw(TABLA)}`);
    const ruta = escribir(
      "ensayo.sql",
      `create table ${TABLA} (nota text);\ninsert into ${TABLA} (nota) values ('no deberia quedar');`,
    );
    let salida = "";
    try {
      salida = correr(ruta);
    } catch (e) {
      salida = String((e as { stdout?: string }).stdout ?? "");
    }
    expect(salida).toContain("ENSAYO");
    expect(await filas(), "el ensayo dejo datos en la base").toBe(0);
  }, 30_000);
});
