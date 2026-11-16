// ══════════════════════════════════════════════════════════════════════════════════════════════════
// BORRAR LOS PRODUCTOS DE PRUEBA QUE LA SUITE DEJO EN LA BASE LOCAL  ·  2026-11-15
//
// COMO SE CORRE (Santiago):
//
//   node --env-file=.env.local scripts/limpiar-fixtures-de-la-suite.mjs            (solo cuenta, no borra)
//   node --env-file=.env.local scripts/limpiar-fixtures-de-la-suite.mjs --borrar   (borra)
//
// ═══ QUE HABIA, MEDIDO EL 15 DE NOVIEMBRE ═══
//
// **20.302 filas en `nutraceuticals`** contra unos 11 productos reales. No era UN test: son SEIS
// fixtures, cada uno dejando una fila por caso y por corrida, durante meses.
//
//   TEST ANULAR      12.334  (venta-anulacion-y-revision-db)
//   TEST VENTA        6.525  (venta-inventario)
//   CATALOGO PRUEBA     652  (catalogo-prescribible-db)
//   CATALOGO REAL       326  (catalogo-prescribible-db)
//   TABLERO PRUEBA      331  (tablero-direccion-inventario-db)
//   BODEGA PRUEBA       119  (tablero-direccion-inventario-db)
//
// ═══ UNA CORRECCION QUE IMPORTA MAS QUE LA LIMPIEZA ═══
//
// El 12 de noviembre se reporto esto como *"venta-inventario inserta un nutraceutico por corrida: 20.059
// filas"*. La cifra era casi buena y la ATRIBUCION estaba mal: ese test deja 6.525, y el que mas deja es
// otro. Y lo peor: los `CATALOGO REAL ...` **no llevan `is_test`** (a proposito, porque ese test compara
// productos reales contra productos de prueba), asi que una cuenta de "productos reales" hecha con
// `is_test = false` da 127 en local cuando los reales son unos 11. Contar sin separar la data de prueba
// infla el hallazgo, y aqui lo inflaba en dos sitios a la vez.
//
// ═══ QUE BORRA, Y POR QUE SE PUEDE BORRAR ═══
//
// Solo los nombres que empiezan por uno de esos SEIS prefijos, que los escriben esos tests y nadie mas, y
// solo si la base es LOCAL. No se filtra por `is_test`: justamente porque uno de los seis no lo lleva.
// Desde hoy los dos fixtures mas grandes limpian lo suyo al terminar
// (`src/tests/helpers/fixtures-de-nutraceuticos.ts`), asi que esto es para lo YA acumulado.
//
// ═══ Y SE NIEGA A CORRER CONTRA LA NUBE ═══
//
// Un script que borra tiene que ser INCAPAZ de borrar lo que no debe, no solo tener cuidado. Si el host
// no es `localhost`/`127.0.0.1`, se para antes de mirar nada. No hay bandera que lo fuerce: para la nube
// este script no existe.
//
// ═══ EL BORRADO VA EN UNA TRANSACCION CON LOS TRIGGERS APAGADOS ═══
//
// Los movimientos de inventario son append-only por trigger (registro de custodia) y una venta que movio
// inventario no se puede borrar (FK RESTRICT). Las dos cosas son correctas y son la razon por la que
// estas filas se quedaron. Asi que el borrado va dentro de UNA transaccion con
// `set local session_replication_role = replica`, que apaga triggers y FK **solo ahi dentro**.
//
// IMPRIME CUENTAS, NUNCA DATOS.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import postgres from "postgres";

const URL_BD = process.env.DATABASE_URL;
if (!URL_BD) {
  console.error("Falta DATABASE_URL en el entorno (usa --env-file=.env.local).");
  process.exit(1);
}

const host = (() => {
  try {
    return new URL(URL_BD).hostname;
  } catch {
    return "";
  }
})();
if (host !== "localhost" && host !== "127.0.0.1") {
  console.error(`Este script SOLO corre contra la base local. El host del DATABASE_URL es "${host}".`);
  process.exit(1);
}

/** Los seis prefijos, con el test que los escribe. Si aparece un septimo, se agrega aqui. */
const FIXTURES = [
  { prefijo: "TEST ANULAR%", test: "venta-anulacion-y-revision-db" },
  { prefijo: "TEST VENTA %", test: "venta-inventario" },
  { prefijo: "CATALOGO PRUEBA%", test: "catalogo-prescribible-db" },
  { prefijo: "CATALOGO REAL%", test: "catalogo-prescribible-db (sin `is_test`, a proposito)" },
  { prefijo: "TABLERO PRUEBA%", test: "tablero-direccion-inventario-db" },
  { prefijo: "BODEGA PRUEBA%", test: "tablero-direccion-inventario-db" },
];

const borrar = process.argv.includes("--borrar");
const sql = postgres(URL_BD, { max: 1, onnotice: () => {} });

async function cuentas() {
  const filas = [];
  let total = 0;
  for (const f of FIXTURES) {
    const [r] = await sql`select count(*) as n from nutraceuticals where name like ${f.prefijo}`;
    filas.push({ ...f, n: Number(r.n) });
    total += Number(r.n);
  }
  const [t] = await sql`select count(*) as n from nutraceuticals`;
  return { filas, total, enLaTabla: Number(t.n) };
}

console.log(`base: ${host}`);
const antes = await cuentas();
for (const f of antes.filas) {
  console.log(`  ${f.prefijo.padEnd(18)} ${String(f.n).padStart(6)}   ${f.test}`);
}
console.log(`  ${"".padEnd(18)} ${String(antes.total).padStart(6)}   de ${antes.enLaTabla} filas en la tabla`);
console.log(`  quedarian: ${antes.enLaTabla - antes.total}`);

if (!borrar) {
  console.log("\nNo se borro nada (falta --borrar). Para borrarlos:");
  console.log("  node --env-file=.env.local scripts/limpiar-fixtures-de-la-suite.mjs --borrar");
  await sql.end();
  process.exit(0);
}

// LOS IDS SE RESUELVEN PRIMERO, en una lista, y PREFIJO POR PREFIJO: una subconsulta anidada dentro de la
// plantilla viaja como promesa y no como SQL, y un `or` armado con `sql.unsafe` mas parametros no se puede
// enlazar. Seis consultas de una columna sobre una tabla indexada no cuestan nada y se leen de un golpe.
const ids = [];
for (const f of FIXTURES) {
  const filas = await sql`select id from nutraceuticals where name like ${f.prefijo}`;
  for (const r of filas) ids.push(r.id);
}
console.log(`\nids a borrar: ${ids.length}`);

if (ids.length > 0) {
  await sql.begin(async (tx) => {
    // SOLO DENTRO DE ESTA TRANSACCION. Ver la nota de arriba.
    await tx`set local session_replication_role = replica`;
    await tx`delete from nutraceutical_stock_movements where nutraceutical_id in ${tx(ids)}`;
    await tx`delete from nutraceutical_inventory where nutraceutical_id in ${tx(ids)}`;
    await tx`delete from transaction_items where nutraceutical_id in ${tx(ids)}`;
    // Las ventas que quedaron SIN items eran solo de estos productos. Una con items de otros se conserva.
    await tx`
      delete from transactions t
       where not exists (select 1 from transaction_items ti where ti.transaction_id = t.id)`;
    await tx`delete from lots where nutraceutical_id in ${tx(ids)}`;
    await tx`delete from nutraceuticals where id in ${tx(ids)}`;
  });
}

const despues = await cuentas();
console.log(`\ndespues: ${despues.total} fixtures · ${despues.enLaTabla} filas en la tabla`);
console.log(`borradas: ${antes.enLaTabla - despues.enLaTabla} filas de nutraceuticals.`);
await sql.end();
