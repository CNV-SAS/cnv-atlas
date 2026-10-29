// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS DOS VENTAS DE LA MISMA HORA  ·  SOLO LECTURA  ·  2026-10-28
//
// ═══ DE DONDE SALE ═══
//
// Santiago, 2026-10-28: *"Aparecen ventas duplicadas de Maria Camila al entrar como admin a /pagos: una ya
// estaba registrada como prueba y otra me aparece normal... ¿estan duplicadas o ella la registro 2 veces?
// aunque no creo ya que ambas aparecen registradas en la misma hora."*
//
// ═══ LAS TRES PREGUNTAS QUE HAY QUE SEPARAR ═══
//
//   1. ¿Son DOS filas o es UNA que se ve dos veces? (un embed mal resuelto puede duplicar en pantalla)
//   2. Si son dos, ¿se crearon en el mismo segundo (doble envio) o con minutos de diferencia (dos actos)?
//   3. ¿Por que una cuenta como de prueba y la otra no, si son de la misma profesional y el mismo dia?
//      La marca derivada mira TRES cosas (profesional, paciente, producto) mas la marca a mano, asi que
//      dos ventas gemelas con distinta marca significan que alguna de esas tres difiere.
//
// NO IMPRIME DATOS DE PACIENTE: ids cortos, montos, horas y las marcas.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/LAS_VENTAS_DUPLICADAS_2026-10-28.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";
import { todasLasFilas } from "./lib/todas-las-filas.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "mira las ventas gemelas de /pagos (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

const perfiles = await todasLasFilas(
  db,
  "professional_profiles",
  "id, is_test, profiles!profile_id(full_name)",
);
const nombreDe = new Map(perfiles.map((p) => [p.id, p.profiles?.full_name ?? p.id]));

const ventas = await todasLasFilas(
  db,
  "transactions",
  "id, professional_id, patient_id, amount, status, payment_method, created_at, cuenta_como_de_prueba, marcada_como_prueba_at, marcada_como_prueba_motivo, wompi_env, alegra_env, alegra_invoice_number, modalidad_de_la_venta",
);

console.log(`TRANSACCIONES EN TOTAL: ${ventas.length}`);

// ── GEMELAS: mismo profesional, mismo paciente, mismo monto, el mismo dia ───────────────────────────
const porLlave = new Map();
for (const v of ventas) {
  const dia = String(v.created_at).slice(0, 10);
  const k = `${v.professional_id}|${v.patient_id}|${v.amount}|${dia}`;
  const ya = porLlave.get(k) ?? [];
  ya.push(v);
  porLlave.set(k, ya);
}
const grupos = [...porLlave.values()].filter((g) => g.length > 1);

console.log(`\nGRUPOS DE VENTAS GEMELAS (mismo profesional, paciente, monto y dia): ${grupos.length}`);
for (const g of grupos.sort((a, b) => String(b[0].created_at).localeCompare(String(a[0].created_at)))) {
  const orden = [...g].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  console.log(`\n── ${nombreDe.get(orden[0].professional_id)} · ${orden.length} ventas ──`);
  for (const v of orden) {
    console.log(
      `  ${String(v.created_at).slice(0, 19)}  $${Number(v.amount).toLocaleString("es-CO")}  ` +
        `${v.status}/${v.payment_method}  ` +
        `cuenta_como_de_prueba=${v.cuenta_como_de_prueba}  modalidad=${v.modalidad_de_la_venta}` +
        `${v.marcada_como_prueba_at ? ` (marcada a mano: ${String(v.marcada_como_prueba_motivo ?? "").slice(0, 40)})` : ""}` +
        `  wompi=${v.wompi_env ?? "-"} alegra=${v.alegra_env ?? "-"}  id ${v.id.slice(0, 8)}`,
    );
  }
  const segundos = orden.map((v) => new Date(v.created_at).getTime());
  const dif = Math.round((segundos[segundos.length - 1] - segundos[0]) / 1000);
  console.log(`  >> separadas por ${dif} segundos`);

  // Las lineas de cada una: si son los mismos productos, es la misma venta registrada dos veces.
  for (const v of orden) {
    const { data: lineas } = await db
      .from("transaction_items")
      .select("nutraceutical_id, quantity, unit_price, nutraceuticals(name, is_test)")
      .eq("transaction_id", v.id);
    const txt = (lineas ?? [])
      .map(
        (l) =>
          `${l.nutraceuticals?.name ?? l.nutraceutical_id} x${l.quantity}` +
          `${l.nutraceuticals?.is_test ? " (producto DE PRUEBA)" : ""}`,
      )
      .join(" · ");
    console.log(`     ${v.id.slice(0, 8)}: ${txt || "(sin lineas)"}`);
  }
}

// ── Y LA PREGUNTA 3, SOBRE TODA LA BASE: que hace que una cuente de prueba y otra no ────────────────
console.log("\nLAS TRES ENTRADAS DE LA MARCA DERIVADA, CONTADAS");
const dePrueba = ventas.filter((v) => v.cuenta_como_de_prueba);
console.log(`  ventas que cuentan como de prueba: ${dePrueba.length} de ${ventas.length}`);
console.log(`  de esas, marcadas A MANO: ${dePrueba.filter((v) => v.marcada_como_prueba_at != null).length}`);
console.log(
  `  de esas, de un profesional de prueba: ${dePrueba.filter((v) => perfiles.find((p) => p.id === v.professional_id)?.is_test).length}`,
);

console.log("\nListo. Nada se escribio.\n");
