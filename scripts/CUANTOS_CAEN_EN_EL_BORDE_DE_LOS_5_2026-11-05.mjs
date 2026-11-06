// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CUANTOS PACIENTES CAEN EXACTAMENTE EN EL BORDE DE LOS ±5 DEL IAE  ·  SOLO LECTURA  ·  2026-11-05
//
// POR QUE: la v15 de Gildardo pasa los cortes del IAE a INCLUSIVOS en ±5 ("se ajustaron todos los sitios
// que definian «acelerado» con > 5": rutas R1 y R4, sintesis, alerta de estres y informes). En Atlas esos
// sitios estan hoy con el corte ABIERTO (`iae > 5`), mientras el texto que lee el paciente ya usa el
// cerrado (`>= +5`). Es la pregunta 7 de PENDIENTES_CIENTIFICOS.md.
//
// LO QUE ESTO MIDE ES EL COSTE DEL CAMBIO, que es lo unico que no se puede deducir: a cuantas personas
// REALES les cambiaria la ruta activa y el protocolo sellado si el corte pasa a ser inclusivo. Solo cambia
// para quien tenga el IAE EXACTAMENTE en 5,0 o en -5,0 (el valor crudo, no el redondeado de pantalla).
//
// Y de paso la distribucion alrededor del borde, para que la cifra no se lea sola.
//
// NO IMPRIME NI UN NOMBRE NI UN DOCUMENTO: conteos y cifras del indicador.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/CUANTOS_CAEN_EN_EL_BORDE_DE_LOS_5_2026-11-05.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "el borde de los 5 del IAE (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

const { data: defs, error: eDefs } = await db.from("indicator_definitions").select("id, code, name");
if (eDefs) throw new Error(eDefs.message);
console.log(`\nIndicadores definidos (${defs.length}): ${defs.map((d) => d.code).join(", ")}`);

const iae = defs.find((d) => /^iae$/i.test(d.code ?? ""));
if (!iae) {
  console.log("No hay definicion con codigo IAE: el indicador no se sella por separado.");
  process.exit(0);
}

// Paginado con orden estable: sin ORDER BY cada pagina es arbitraria.
const filas = [];
for (let desde = 0; ; desde += 1000) {
  const { data, error } = await db
    .from("indicator_values")
    .select("value, evaluation_id")
    .eq("indicator_definition_id", iae.id)
    .order("id", { ascending: true })
    .range(desde, desde + 999);
  if (error) throw new Error(error.message);
  filas.push(...(data ?? []));
  if ((data ?? []).length < 1000) break;
}

const vivos = filas.map((f) => (f.value == null ? null : Number(f.value))).filter((n) => n != null && !isNaN(n));
console.log(`\nValores de IAE sellados: ${filas.length} · con cifra: ${vivos.length} · nulos: ${filas.length - vivos.length}`);

const enRango = (a, b) => vivos.filter((n) => n >= a && n < b).length;
console.log(`\n── EL BORDE ──`);
console.log(`  exactamente +5,0: ${vivos.filter((n) => n === 5).length}`);
console.log(`  exactamente -5,0: ${vivos.filter((n) => n === -5).length}`);
console.log(`  en [+4,95 , +5,05): ${enRango(4.95, 5.05)}   (los que el redondeo de pantalla muestra como 5,0)`);
console.log(`  en [-5,05 , -4,95): ${enRango(-5.05, -4.95)}`);

console.log(`\n── A QUE LADO CAEN, CON CADA CORTE ──`);
console.log(`  acelerado con el corte ABIERTO (> +5):   ${vivos.filter((n) => n > 5).length}`);
console.log(`  acelerado con el corte CERRADO (>= +5):  ${vivos.filter((n) => n >= 5).length}`);
console.log(`  desacelerado con el ABIERTO (< -5):      ${vivos.filter((n) => n < -5).length}`);
console.log(`  desacelerado con el CERRADO (<= -5):     ${vivos.filter((n) => n <= -5).length}`);

console.log(`\nFin. Nada se escribio.`);
