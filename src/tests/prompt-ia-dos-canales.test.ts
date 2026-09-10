import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CANDADO DE LOS DOS CANALES DEL PROMPT DE IA (2026-09-08).
//
// EL DEFECTO, y es el unico de los tres catalogos que estaba desincronizado DE VERDAD y no en potencia:
//
//   LOCAL   criterio.generate v1 inactive · v2 ACTIVE
//   NUBE    criterio.generate v1 ACTIVE
//
// La v2 (el bloque de formato que Gildardo pidio en su §8 del 2026-09-01, el que prohibe markdown) nunca
// llego a produccion. `ai_prompts` solo lo publicaba `supabase/seed.ts`, el seed DESTRUCTIVO que no se
// corre contra la nube.
//
// Y ES PEOR QUE UNA FILA AUSENTE. `getActivePrompt` hace que la fila de BASE GANE sobre el texto canonico
// del codigo: con la v1 activa, la nube NO caia al texto del repositorio, corria el viejo. Una fila
// ausente si cae al canonico, y eso es deliberado (`menu.adapt` se diseño asi a proposito).
//
// LA SEVERIDAD, CALIBRADA: el filtro de salida (`limpiarMarcadores`) corre igual, asi que el markdown se
// limpiaba de todos modos. Su §8 pidio las DOS mitades ("por si el modelo desobedece, que es lo que
// hacen"); en la nube habia una. No estaba roto: faltaba una de dos guardas que creiamos tener.
//
// LO QUE SE FIJA: que el .sql commiteado sea EL QUE EL GENERADOR PRODUCE HOY desde el seed, y que el seed
// y el JSON canonico sigan siendo la misma fuente. No se compara contra una copia escrita aqui, que seria
// la cuarta copia del mismo parrafo.

// LA MIGRACION VIGENTE, no la primera. Este candado se puso rojo el mismo dia que se escribio, al subir
// el prompt a v3: estaba anclado a la 0102 (que publica la v2) y el generador produce SIEMPRE la version
// que el seed declara. Fue un rojo LEGITIMO y el alcance es lo que estaba mal, no la asercion.
//
// LA 0102 NO SE REGENERA NUNCA MAS: esta aplicada, y una migracion aplicada no se modifica (forward-only).
// Publico la v2 y ese es su trabajo, hecho.
//
// SEGUNDA VEZ, Y ESTABA PREVISTO (2026-09-10, al subir a la v4 con las alertas clinicas). El comentario de
// arriba lo decia con todas sus letras: al subir de version, esta constante se mueve y la anterior queda
// congelada. El ANCLA se mueve; la asercion es la misma.
const MIGRACION = "drizzle/0117_prompt_criterio_v4.sql";
const MIGRACIONES_HISTORICAS = [
  "drizzle/0102_prompt_criterio_v2.sql",
  "drizzle/0103_prompt_criterio_v3.sql",
];
const SEED = readFileSync("supabase/seed.ts", "utf8");

function generado(): string {
  return execFileSync("node", ["scripts/gen-ai-prompt-migration.mjs", "0117", "criterio.generate"], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
}

const norm = (s: string) => s.replace(/\r\n/g, "\n").trimEnd();

describe("la migración del prompt se DERIVA del seed, no se escribe", () => {
  it("el control: el generador produce las tres sentencias", () => {
    // Sin control, un generador que devolviera vacio pasaria la comparacion si el fichero tambien lo
    // estuviera. Y las TRES importan: retirar, insertar y (en re-aplicacion) activar.
    const sql = generado();
    expect(sql).toContain("UPDATE ai_prompts SET status = 'inactive'");
    expect(sql).toContain("INSERT INTO ai_prompts");
    expect(sql).toContain("UPDATE ai_prompts SET status = 'active'");
    expect(sql.length).toBeGreaterThan(1500);
  });

  it("el .sql commiteado es EXACTAMENTE lo que el generador produce hoy", () => {
    expect(
      norm(readFileSync(MIGRACION, "utf8")),
      "el prompt canónico y la migración divergieron: regenera con " +
        "`node scripts/gen-ai-prompt-migration.mjs 0117 criterio.generate > " + MIGRACION + "`",
    ).toBe(norm(generado()));
  });

  it("y lleva el texto ÍNTEGRO del JSON canónico, no un resumen", () => {
    // Se DERIVA del JSON, no se escribe la longitud aqui. Un texto truncado en el SQL publicaria un
    // prompt a medias, que es peor que no publicarlo: el modelo obedece lo que lee.
    const canonico = JSON.parse(
      readFileSync("src/modules/diagnoses/ai/prompts/criterion.system.v4.json", "utf8"),
    ).system as string;
    const sql = generado();
    // El SQL duplica las comillas simples; se deshace para comparar el texto real.
    expect(sql.replace(/''/g, "'")).toContain(canonico.slice(0, 400));
    expect(sql.replace(/''/g, "'")).toContain(canonico.slice(-300));
  });

  it("respeta el índice de UNA SOLA activa: desactiva ANTES de insertar", () => {
    // Es donde ya nos estrellamos una vez: el upsert del seed no chocaba con la otra version, chocaba con
    // su ESTADO (`ai_prompts_one_active_idx`). El orden de las sentencias es la garantía.
    const sql = generado();
    const iRetirar = sql.indexOf("SET status = 'inactive'");
    const iInsertar = sql.indexOf("INSERT INTO ai_prompts");
    expect(iRetirar).toBeGreaterThan(-1);
    expect(iRetirar, "insertar antes de retirar violaría el índice parcial").toBeLessThan(iInsertar);
  });

  it("y NO pisa una edición del admin", () => {
    // Mismo criterio que el seed: solo se retira lo ANTERIOR (`version <`), y la insercion se activa solo
    // si no quedo ninguna activa. Verificado contra Postgres real en los cuatro escenarios, con rollback.
    const sql = generado();
    expect(sql).toContain("AND version < 4");
    expect(sql).toContain("THEN 'inactive' ELSE 'active' END");
  });

  it("las migraciones ANTERIORES no se regeneran: están aplicadas", () => {
    // Forward-only. Una migracion aplicada no se modifica; si el prompt sube de version se escribe otra.
    // Este caso existe para que el dia que alguien "actualice" la 0102 con el texto nuevo, se ponga rojo.
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: { tag: string }[];
    };
    for (const ruta of MIGRACIONES_HISTORICAS) {
      const tag = ruta.replace("drizzle/", "").replace(".sql", "");
      expect(journal.entries.map((e) => e.tag), `${tag} desapareció del journal`).toContain(tag);
      // LA VERSION SE DERIVA DEL NOMBRE, igual que el tag, y por el mismo motivo. Estaba escrita a mano
      // ("...', 2,") porque cuando se escribió solo había UNA histórica; al aparecer la segunda, el caso
      // exigía que la v3 publicara la v2. Es la misma lección que el comentario de abajo ya enseñaba, en
      // la línea de al lado: un literal a mano se desincroniza en cuanto la lista crece.
      const version = /_v(\d+)\.sql$/.exec(ruta)?.[1];
      expect(version, `no se puede leer la versión de ${ruta}`).toBeTruthy();
      // Cada migración publica SU versión: si alguien le mete el texto de otra, esto lo dice.
      expect(readFileSync(ruta, "utf8")).toContain(`'criterio.generate', ${version},`);
    }
  });

  it("la migración está registrada en el journal, o no la aplica nadie", () => {
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: { tag: string }[];
    };
    // El tag se DERIVA de la ruta. Escribirlo a mano ya me lo desincronizo una vez en este mismo
        // archivo: un reemplazo global me dejo el sufijo v2 en el tag de la migracion v3.
        const tag = MIGRACION.replace("drizzle/", "").replace(".sql", "");
        expect(
          journal.entries.map((e) => e.tag),
          `${tag} no está en el journal: no la aplica nadie`,
        ).toContain(tag);
  });
});

describe("la versión que publica la migración es la que el seed declara", () => {
  it("sale de PROMPTS_SEED, no de un número escrito en el generador", () => {
    // Si se escribiera a mano, el seed podria subir a v3 y la migracion seguir publicando la v2 sin que
    // nada diera error: las dos bases coherentes consigo mismas y distintas entre si.
    const GEN = readFileSync("scripts/gen-ai-prompt-migration.mjs", "utf8");
    expect(GEN).toContain("const PROMPTS_SEED");
    expect(GEN, "el generador dejó de leer el seed").toContain("supabase/seed.ts");
    // Y la version que el seed declara HOY para esta clave aparece en el SQL.
    const bloque = /const PROMPTS_SEED = \[([\s\S]*?)\];/.exec(SEED)![1];
    const v = /prompt_key:\s*"criterio\.generate",\s*version:\s*(\d+)/.exec(bloque)![1];
    expect(generado()).toContain(`'criterio.generate', ${v},`);
  });
});
