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
// USO:
//   node --env-file=.env.local scripts/aplicar-migracion.mjs drizzle/0111_un_pase_qr_a_la_vez.sql
//   (contra la nube: exportar DATABASE_URL de la nube y correrlo sin --env-file)
//
//   Con --commit al final, confirma en vez de revertir. Solo cuando se sepa lo que se esta haciendo.

const archivo = process.argv[2];
const confirmar = process.argv.includes("--commit");
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
    await tx.unsafe(readFileSync(archivo, "utf8"));
    console.log("La migracion corrio SIN ERRORES.");
    if (!confirmar) {
      console.log("Revirtiendo (ensayo). Para aplicarla de verdad: pnpm db:migrate");
      throw new Error("__ensayo__");
    }
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
