// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS PENDIENTES QUE LA FRANJA CUENTA DE VERDAD
//
// SOLO LECTURA. Reemplaza la consulta SQL que mandé el 2026-10-03, que APROXIMABA las condiciones de cada
// rama y por eso dio 12 filas donde la pantalla cuenta 3. En particular, `sin_documento` no es "sin numero
// de factura": es `LE_FALTA_ALGO` (sin emitir O sin pago registrado en Alegra, y no retroactiva) junto con
// `FACTURABLE` (no en revision, o resuelta como segunda compra o efectivo no recibido).
//
// ESCRIBIR ESAS CONDICIONES A MANO EN SQL ES CREAR UNA SEGUNDA DEFINICION, y la diferencia entre las dos se
// ve como un conteo que no cuadra con la pantalla, que es exactamente lo que paso. Asi que esto LLAMA AL
// LECTOR DE LA APLICACION: el numero sale del mismo codigo que pinta la franja.
//
// COMO SE CORRE (va con `tsx` porque importa modulos TypeScript de la aplicacion):
//   $env:DATABASE_URL="<cadena de la nube>"; pnpm tsx --tsconfig tsconfig.scripts.json scripts/los-pendientes-de-verdad.mjs
//
// El --tsconfig es obligatorio: sustituye  por un stub. Ese paquete no existe en node_modules
// (Next lo resuelve en su build), asi que sin el stub cualquier import de un modulo server-only falla.
//
// NO IMPRIME DATOS DE PACIENTE: tipo, fecha, monto, causa y el id de la venta.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { listarPendientesDeAccion } from "../src/modules/avisos/data/avisos-repository.ts";
import { limiteDe, pendientesVisibles } from "../src/modules/avisos/resumen.ts";

const ahora = new Date();
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(ahora);

// Lo que ve el correo y la franja (ya con los filtros de prueba aplicados).
const delCorreo = await listarPendientesDeAccion();
// Y lo mismo incluyendo los descartados, para ver si alguno esta callado por un descarte.
const conDescartados = await listarPendientesDeAccion({ incluirDescartados: true });

const { total, vencidos } = pendientesVisibles(delCorreo, ahora);

console.log("LA FRANJA DICE:", total, "pendientes", vencidos > 0 ? `(${vencidos} vencidos)` : "");
console.log("(lo que no entra en ese conteo esta en gestion, y vuelve en su fecha)\n");

const porTipo = new Map();
for (const p of delCorreo) porTipo.set(p.tipo, (porTipo.get(p.tipo) ?? 0) + 1);
console.log("POR TIPO:");
for (const [tipo, n] of [...porTipo.entries()].sort((a, b) => b[1] - a[1])) {
  console.log("  " + String(tipo).padEnd(16), n);
}

// Con tope: en una base de pruebas esta lista puede tener cientos y lo util es el conteo de arriba.
console.log(`\nUNO POR UNO${delCorreo.length > 30 ? " (los 30 primeros)" : ""}:`);
for (const p of delCorreo.slice(0, 30)) {
  const limite = limiteDe(p);
  const estado = hoy > limite ? "VENCIDO" : p.enGestionHasta && hoy <= p.enGestionHasta ? "en gestion" : "abierto";
  console.log(
    `  ${String(p.tipo).padEnd(16)} ${String(p.desde).slice(0, 10)}  ${Number(p.monto).toLocaleString("es-CO").padStart(10)} COP  ` +
      `${estado.padEnd(10)} plazo ${limite}  ${p.transactionId}`,
  );
  console.log(`      ${p.causa}`);
}

const descartados = conDescartados.filter((p) => p.descarte != null && !p.descarte.caducado);
if (descartados.length > 0) {
  console.log("\nY ESTOS ESTAN DESCARTADOS (no cuentan, y se ven en 'Pendientes sin salida'):");
  for (const p of descartados) {
    console.log(`  ${String(p.tipo).padEnd(16)} ${p.transactionId}  por ${p.descarte.por}: ${p.descarte.motivo}`);
  }
}

// ── Y EL CONTROL: cuantas quedaron FUERA por ser de prueba ──
//
// Es la pregunta que abrio esto. Si la diferencia no es la esperada, el filtro no esta haciendo lo que dice.
const { db } = await import("../src/db/index.ts");
const { sql } = await import("drizzle-orm");
const [f] = await db.execute(sql`
  select count(*) filter (where cuenta_como_de_prueba)::int as de_prueba,
         count(*) filter (where cuenta_como_de_prueba and stock_state = 'sin_saldo')::int as sin_saldo_de_prueba
    from transactions`);
console.log(
  `\nVENTAS MARCADAS DE PRUEBA: ${f.de_prueba} en total, de las cuales ${f.sin_saldo_de_prueba} son 'sin saldo'.`,
);
console.log(
  "Las de prueba NO cuentan como pendientes, salvo las 'sin saldo': ahi el producto es real, la unidad salio\n" +
    "de verdad de la vitrina, y ese descuadre es fisico (ver el comentario del lector).",
);

process.exit(0);
