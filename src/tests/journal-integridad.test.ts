import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

// ═══ TODA MIGRACION ESCRITA TIENE SU ENTRADA EN EL JOURNAL ═══
//
// POR QUE EXISTE (2026-09-19): escribí `0149_pregunta_32_mas_clara.sql` a mano, como se hace con las
// migraciones de DATOS (drizzle-kit solo genera las de esquema), y NO le añadí su entrada al journal. El
// archivo quedó commiteado, y drizzle-kit lo ignora: `db:migrate` corrió sin aplicarlo, y Santiago se
// encontró con la pregunta 32 diciendo "hace" y un `db:check` en rojo.
//
// YA HABIA UN CONTROL, y funcionó: `scripts/check-migrations.mjs` lo detectó. Pero ese script lo corre una
// persona cuando se acuerda, y quien escribe la migración es justo quien no se acordó. Esto vive en la
// suite, que corre siempre, así que el hueco se cierra en el momento de abrirlo y no dos pasos después.
//
// LAS DOS DIRECCIONES SE MIRAN, porque fallan distinto:
//   · .sql sin entrada  -> nadie lo aplica y el cambio no llega a ninguna base (lo que pasó).
//   · entrada sin .sql  -> `db:migrate` truena al no encontrar el archivo.

const JOURNAL = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
  entries: { idx: number; tag: string }[];
};

const ARCHIVOS = readdirSync("drizzle")
  .filter((f) => f.endsWith(".sql"))
  .map((f) => f.replace(/\.sql$/, ""))
  .sort();

describe("el journal y los archivos .sql dicen lo mismo", () => {
  it("CONTROL: hay migraciones y hay entradas", () => {
    // Sin esto, dos listas vacías coincidirían perfectamente el día que cambie la estructura de carpetas.
    expect(ARCHIVOS.length).toBeGreaterThan(100);
    expect(JOURNAL.entries.length).toBeGreaterThan(100);
  });

  it("ningún .sql se queda fuera del journal (nadie lo aplicaría)", () => {
    const enJournal = new Set(JOURNAL.entries.map((e) => e.tag));
    const huerfanos = ARCHIVOS.filter((a) => !enJournal.has(a));
    expect(
      huerfanos,
      "estas migraciones existen en disco y drizzle-kit NO las va a aplicar: añade su entrada a drizzle/meta/_journal.json",
    ).toEqual([]);
  });

  it("ninguna entrada apunta a un archivo que no existe (db:migrate tronaría)", () => {
    const enDisco = new Set(ARCHIVOS);
    const perdidas = JOURNAL.entries.map((e) => e.tag).filter((t) => !enDisco.has(t));
    expect(perdidas, "el journal nombra migraciones que no están en drizzle/").toEqual([]);
  });

  it("los idx son únicos y consecutivos: el orden de aplicación no puede ser ambiguo", () => {
    const idx = JOURNAL.entries.map((e) => e.idx);
    expect(new Set(idx).size, "hay idx repetidos en el journal").toBe(idx.length);
    const ordenados = [...idx].sort((a, b) => a - b);
    expect(idx, "el journal no está en orden de idx").toEqual(ordenados);
  });
});
