import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ═══ UN BACKTICK DENTRO DE UNA PLANTILLA SQL LA PARTE EN DOS (2026-10-09) ═══
//
// ── POR QUE ESTE CANDADO EXISTE: ME PASO TRES VECES EN UN DIA ──────────────────────────────────────
//
// Las consultas van en plantillas (sql`...`), y escribir el nombre de una columna entre backticks dentro de un
// comentario de esa consulta TERMINA la plantilla. El error que sale es un `TS1005: ',' expected` en una linea
// que no tiene nada que ver, asi que se pierde un rato buscando donde esta la coma que falta.
//
// Me paso en `count-writer.ts`, en `avisos-repository.ts` y en `liquidacion-writer.ts`, las tres veces por el
// mismo motivo: estoy acostumbrado a citar identificadores entre backticks en los comentarios, y dentro de una
// plantilla eso no es una cita, es el fin de la cadena.
//
// ── LO QUE VIGILA, Y LO QUE NO ───────────────────────────────────────────────────────────────────
//
// Solo el INTERIOR de las plantillas sql. Un backtick en un comentario normal de TypeScript es correcto y util
// (es como se citan los identificadores en todo el proyecto), asi que prohibirlo en general seria cambiar el
// estilo del codigo para evitar un error que solo ocurre en un sitio.
//
// Y NO PUEDE REEMPLAZARSE POR tsc: tsc SI lo caza, pero con un mensaje que apunta al sitio equivocado. Esto lo
// nombra: archivo, linea, y que el problema es el backtick.

const raiz = process.cwd();

function archivosConSql(dir: string): string[] {
  const salida: string[] = [];
  const recorrer = (rel: string) => {
    for (const e of readdirSync(join(raiz, rel), { withFileTypes: true })) {
      const hijo = `${rel}/${e.name}`;
      if (e.isDirectory()) recorrer(hijo);
      else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) salida.push(hijo);
    }
  };
  recorrer(dir);
  return salida.filter((p) => /sql`/.test(readFileSync(join(raiz, p), "utf8")));
}

/**
 * Las lineas de COMENTARIO SQL (`-- ...`) que traen un backtick.
 *
 * ── POR QUE SOLO LOS COMENTARIOS, Y NO "DENTRO DE LA PLANTILLA" ───────────────────────────────────
 *
 * Mi primera version rastreaba donde empieza y acaba cada plantilla, y acuso a SEIS archivos correctos: una
 * plantilla ANIDADA (`${cond ? sql\`a\` : sql\`b\`}`) y un `sql.raw(\`...\`)` llevan backticks legitimos, y una
 * maquina de estados por lineas no los distingue del cierre.
 *
 * Un candado que acusa codigo correcto se desactiva a la segunda vez, asi que se acota a la forma EXACTA que me
 * fallo las tres veces: un backtick dentro de un comentario `--`. Ahi no hay ningun uso legitimo (SQL no cita
 * identificadores con backticks: eso es MySQL, y aqui es Postgres), y es donde yo meto la mano por costumbre de
 * citar identificadores en los comentarios de TypeScript.
 *
 * LO QUE DEJA PASAR: un backtick suelto en el cuerpo de la consulta, que no es algo que nadie escriba por error.
 */
function backticksEnComentariosSql(src: string): number[] {
  const culpables: number[] = [];
  src.split("\n").forEach((linea, i) => {
    const limpia = linea.trim();
    if (!limpia.startsWith("--")) return;
    if (limpia.includes("`")) culpables.push(i + 1);
  });
  return culpables;
}

describe("ninguna plantilla SQL se parte por un backtick en un comentario", () => {
  const archivos = archivosConSql("src/modules").concat(archivosConSql("src/db"));

  it("el barrido encuentra las plantillas", () => {
    expect(archivos.length, "no se encontro ninguna plantilla sql: cambio la forma de escribirlas").toBeGreaterThan(
      20,
    );
  });

  it.each(archivos)("%s no tiene backticks en comentarios SQL", (ruta) => {
    const lineas = backticksEnComentariosSql(readFileSync(join(raiz, ruta), "utf8"));
    expect(
      lineas,
      `${ruta}: hay un backtick en un comentario SQL (lineas ${lineas.join(", ")}). Dentro de una plantilla eso ` +
        `TERMINA la cadena, y tsc se queja de una coma en otro sitio. Escribe el identificador sin backticks.`,
    ).toEqual([]);
  });
});
