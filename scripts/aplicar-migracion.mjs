import { readFileSync } from "node:fs";

import postgres from "postgres";

// APLICA UNA MIGRACION SUELTA Y ENSEÑA EL ERROR DE POSTGRES.
//
// POR QUE EXISTE: `drizzle-kit migrate` se traga el mensaje. Cuando una migracion falla, lo unico que
// queda es un `exit 1` mudo, y con eso no se puede diagnosticar nada. Paso con la 0111 (un indice unico
// que no se podia crear porque los datos ya lo violaban): el motivo solo aparecio al ejecutarla a mano.
//
// QUE HACE: corre el archivo COMPLETO dentro de UNA transaccion y, si falla, imprime lo que Postgres dijo
// de verdad: mensaje, detalle, pista, restriccion y posicion.
//
// NO TOCA EL REGISTRO DE MIGRACIONES. Es una herramienta de DIAGNOSTICO: sirve para ver por que falla, no
// para aplicarla de forma oficial. Cuando el motivo este arreglado, se aplica con `pnpm db:migrate`, que
// es lo unico que deja constancia en `drizzle.__drizzle_migrations`. Por eso, por defecto, REVIERTE.
//
// SIRVE TAMBIEN PARA LOS SCRIPTS DE OPERACION, no solo para migraciones (2026-09-11). La purga y la
// carga de inventario son archivos que se corren UNA vez contra la nube y que, hasta ahora, no se podian
// ensayar en ningun sitio: en local abortan porque los ids son de la nube. Un script que no se ha corrido
// no esta verificado aunque se haya leido tres veces, y esa leccion ya costo un error de sintaxis que
// llevaba semanas escrito en el script de carga.
//
// DOS AJUSTES PARA QUE PUEDA CON ELLOS:
//
//   · PROTOCOLO SIMPLE. El protocolo extendido de postgres.js interpreta el signo de dolar como marcador
//     de parametro, asi que se atraganta con cualquier funcion plpgsql o bloque "do" con comillas de
//     dolar. Con el protocolo simple, el archivo viaja tal cual.
//   · SE QUITAN SU "begin;" Y SU "commit;". Un script de operacion trae los suyos porque se pega en el
//     editor de Supabase; aqui la transaccion la pone esta herramienta, y anidarlos haria que el commit
//     del archivo CONFIRMARA lo que el ensayo queria revertir. Es lo contrario de lo que promete.
//
// USO:
//   node --env-file=.env.local scripts/aplicar-migracion.mjs scripts/carga-inventario-inicial.sql
//   node --env-file=.env.local scripts/aplicar-migracion.mjs drizzle/0111_un_pase_qr_a_la_vez.sql
//   (contra la nube: exportar DATABASE_URL de la nube y correrlo sin --env-file)
//
//   Con --commit al final, confirma en vez de revertir. Solo cuando se sepa lo que se esta haciendo.
//
// ── POR QUE UNA BANDERA DESCONOCIDA ABORTA, Y NO SE IGNORA (2026-09-11) ─────────────────────────
//
// Paso lo peor que podia pasar con una herramienta asi: se corrio la carga de inventario con `--confirmar`
// (una bandera que NO existe; la real es `--commit`), la herramienta la ignoro en silencio, corrio en
// ensayo, revirtio, y quien la ejecuto creyo que habia aplicado la carga. La salida decia "Modo: ENSAYO",
// pero cuando uno cree haber pedido lo contrario, esa linea se lee como ruido.
//
// LA REGLA: en una herramienta donde la diferencia entre dos modos es "los datos quedan" contra "los datos
// no quedan", ignorar un argumento no es tolerancia, es dejar que el usuario se equivoque sin enterarse.
// Un argumento que no se entiende ABORTA antes de tocar la base.
const BANDERAS = new Set(["--commit"]);

const args = process.argv.slice(2);
const desconocidas = args.filter((a) => a.startsWith("-") && !BANDERAS.has(a));
if (desconocidas.length > 0) {
  console.error(`No reconozco ${desconocidas.join(", ")}, asi que no corro nada.`);
  console.error(`La unica bandera es --commit (confirma los cambios). Sin ella, ENSAYA y revierte.`);
  process.exit(1);
}

const archivo = args.find((a) => !a.startsWith("-"));
const confirmar = args.includes("--commit");
if (!archivo) {
  console.error("Falta el archivo. Ej: node scripts/aplicar-migracion.mjs drizzle/0111_x.sql");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: (n) => console.log(`NOTICE: ${n.message}`) });
console.log(`Base:    ${new URL(url).host}`);
console.log(`Archivo: ${archivo}`);
console.log(confirmar ? "Modo:    COMMIT (confirma los cambios)" : "Modo:    ENSAYO (revierte al final)");
console.log("");

let salida = 0;
try {
  await sql.begin(async (tx) => {
    // El "begin;"/"commit;" propio del archivo se retira: la transaccion la pone esta herramienta, y
    // dejar el commit del archivo confirmaria lo que el ensayo iba a revertir.
    const contenido = readFileSync(archivo, "utf8")
      .replace(/^[ 	]*begin[ 	]*;[ 	]*$/gim, "")
      .replace(/^[ 	]*commit[ 	]*;[ 	]*$/gim, "");
    await tx.unsafe(contenido).simple();
    console.log(`El archivo corrio SIN ERRORES.`);
    if (!confirmar) {
      // EL CONSEJO SE DERIVA DEL ARCHIVO, no es una frase fija. Decia siempre "para aplicarla de verdad:
      // pnpm db:migrate", que es cierto de una migracion y FALSO de un script de operacion: db:migrate
      // solo corre lo que esta en el journal de drizzle, y una carga o una purga no estan ahi. Un consejo
      // equivocado en el momento de aplicar es peor que ningun consejo.
      const esMigracion = /(^|[\\/])drizzle[\\/]\d{4}_/.test(archivo);
      console.log("Revirtiendo: esto fue un ENSAYO, no queda nada en la base.");
      console.log(
        esMigracion
          ? "  Para aplicarla de verdad: pnpm db:migrate (es lo unico que deja constancia en el journal)."
          : `  Para aplicarlo de verdad: el mismo comando con --commit al final.`,
      );
      throw new Error("__ensayo__");
    }
    console.log("CONFIRMADO: los cambios quedan en la base.");
  });
} catch (e) {
  if (e?.message === "__ensayo__") {
    // Reversion pedida: no es un fallo.
  } else {
    salida = 1;
    console.error("\nFALLO. Lo que dijo Postgres:\n");
    console.error(`  mensaje:     ${e?.message ?? e}`);
    for (const [rotulo, clave] of [
      ["detalle", "detail"],
      ["pista", "hint"],
      ["restriccion", "constraint_name"],
      ["tabla", "table_name"],
      ["columna", "column_name"],
      ["posicion", "position"],
      ["codigo", "code"],
    ]) {
      if (e?.[clave]) console.error(`  ${rotulo}:${" ".repeat(Math.max(1, 12 - rotulo.length))}${e[clave]}`);
    }
    if (e?.query) console.error(`\n  sentencia:\n${String(e.query).trim().slice(0, 600)}`);
  }
}
await sql.end();
process.exit(salida);
