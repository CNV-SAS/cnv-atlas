import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CANDADO DE LOS DOS CANALES DEL CATALOGO DE CONDICIONES BIS (2026-09-07).
//
// EL DEFECTO: el catalogo tiene dos canales, el SEED (local) y la MIGRACION (nube). Publicamos la v2 con
// el seed, en local bajo a doce condiciones, y **la nube se quedo en catorce** porque no habia canal a la
// nube en absoluto: el atajo `pnpm db:seed:bis` lleva `--env-file=.env.local` escrito dentro. Verificado
// en solo lectura: en la nube ni siquiera existia la fila de la version.
//
// Es la misma forma que ya nos costo con los dos canales del plan (seis cosas distintas antes de que un
// candado lo viera) y por eso la migracion se GENERA del seed en vez de escribirse.
//
// LO QUE ESTE CANDADO AFIRMA, y es lo unico que de verdad importa: que el SQL commiteado en `drizzle/` es
// EL QUE EL GENERADOR PRODUCE HOY desde el seed. Si alguien edita el seed y no regenera, o edita el SQL a
// mano, esto se pone rojo. No compara contra una copia escrita aqui, que seria una tercera fuente.
//
// LOS IDS SON LO CRITICO. Se derivan de (VERSION_NUMBER, clave) con la MISMA funcion en los dos canales
// porque el generador copia el cuerpo de `uuidFromKey` del seed en vez de re-implementarlo. Dos
// implementaciones de un id determinista es como se generan filas que nadie cruza: la nube quedaria con
// una version duplicada y las capturas selladas apuntando a la otra.

const MIGRACION = "drizzle/0101_condiciones_bis_v2.sql";
const SEED = readFileSync("supabase/seed-bis-conditions.ts", "utf8");

function generado(): string {
  return execFileSync("node", ["scripts/gen-bis-conditions-migration.mjs", "0101"], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
}

// Salto de linea normalizado: git puede dejar CRLF en el .sql del disco y el generador emite LF.
const norm = (s: string) => s.replace(/\r\n/g, "\n").trimEnd();

describe("la migración del catálogo se DERIVA del seed, no se escribe", () => {
  it("el control: el generador produce SQL con las dos tablas", () => {
    // Sin este control, un generador que fallara y devolviera vacio haria pasar la comparacion de abajo
    // si el fichero tambien estuviera vacio.
    const sql = generado();
    expect(sql).toContain("INSERT INTO bis_condition_versions");
    expect(sql).toContain("INSERT INTO bis_conditions");
    expect(sql.length).toBeGreaterThan(1000);
  });

  it("el .sql commiteado es EXACTAMENTE lo que el generador produce hoy", () => {
    expect(
      norm(readFileSync(MIGRACION, "utf8")),
      "el seed y la migración divergieron: regenera con `node scripts/gen-bis-conditions-migration.mjs 0101 > " +
        MIGRACION + "`",
    ).toBe(norm(generado()));
  });

  it("y lleva TODAS las condiciones del seed, ni una menos", () => {
    // Se DERIVA del seed el numero esperado, no se escribe aqui: una cifra a mano seria la tercera fuente.
    const bloque = SEED.slice(SEED.indexOf("const CONDS: Cond[] = ["), SEED.indexOf("\n];", SEED.indexOf("const CONDS")));
    const enElSeed = [...bloque.matchAll(/\{ key: "/g)].length;
    const enLaMigracion = [...generado().matchAll(/^ {2}\('[0-9a-f-]{36}', '[0-9a-f-]{36}', '/gm)].length;
    expect(enElSeed, "no se leyeron las condiciones del seed").toBeGreaterThan(0);
    expect(enLaMigracion).toBe(enElSeed);
  });

  it("la migración está registrada en el journal, o no la aplica nadie", () => {
    // Un .sql en el disco sin su entrada en el journal es un fichero que drizzle-kit ignora: el cambio
    // queda commiteado y no llega a ninguna base. Es la misma clase de hueco que el que esto cierra.
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: { tag: string }[];
    };
    expect(journal.entries.map((e) => e.tag)).toContain("0101_condiciones_bis_v2");
  });
});

describe("el generador no re-implementa la derivación de ids", () => {
  it("copia `uuidFromKey` del seed", () => {
    // Si algun dia se re-escribe aqui, los dos canales pueden dar ids distintos y NADA daria error hasta
    // que la nube quedara con la version duplicada.
    const GEN = readFileSync("scripts/gen-bis-conditions-migration.mjs", "utf8");
    expect(GEN).toContain("const uuidFromKey = \\(key: string\\): string => \\{");
    expect(GEN, "el generador dejó de leer el seed").toContain("supabase/seed-bis-conditions.ts");
    // Y el control de que la copia se USA: el id de la version sale de esa funcion, no de un literal.
    expect(GEN).toContain("uuidFromKey(`version:${VERSION_NUMBER}`)");
    expect(GEN, "un UUID escrito a mano en el generador es la segunda fuente").not.toMatch(
      /['"][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}['"]/,
    );
  });
});
