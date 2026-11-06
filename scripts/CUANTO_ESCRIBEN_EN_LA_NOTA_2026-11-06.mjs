// SOLO LECTURA · 2026-11-06 · Cuanto mide la observacion que la profesional escribe en el tratamiento.
// POR QUE: el informe del paciente muestra la ULTIMA nota del tratamiento, y Santiago pidio un limite de
// caracteres que mantenga el informe inicial en una hoja. El limite medido sobre el PDF es 210. Antes de
// imponerlo hay que saber si eso recorta lo que la gente escribe de verdad, porque esa nota es un
// registro clinico, no un campo de maquetacion.
// NO IMPRIME NI UNA NOTA: solo largos.
import { createClient } from "@supabase/supabase-js";
import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Faltan variables."); process.exit(1); }
anunciarBase(url, "largo de las notas de tratamiento (SOLO LECTURA)");
const db = createClient(url, key, { auth: { persistSession: false } });

const filas = [];
for (let desde = 0; ; desde += 500) {
  const { data, error } = await db.from("treatment_notes").select("id, note").order("id").range(desde, desde + 499);
  if (error) throw new Error(error.message);
  filas.push(...(data ?? []));
  if ((data ?? []).length < 500) break;
}
const largos = filas.map((f) => (f.note ?? "").trim().length).filter((n) => n > 0).sort((a, b) => a - b);
const pct = (p) => largos[Math.min(largos.length - 1, Math.floor((p / 100) * largos.length))];
console.log(`\nNotas con texto: ${largos.length} de ${filas.length}`);
if (largos.length) {
  console.log(`  minimo ${largos[0]} · mediana ${pct(50)} · p75 ${pct(75)} · p90 ${pct(90)} · p95 ${pct(95)} · maximo ${largos[largos.length - 1]}`);
  for (const corte of [200, 210, 300, 500]) {
    const pasan = largos.filter((n) => n <= corte).length;
    console.log(`  caben en ${corte}: ${pasan} de ${largos.length} (${((pasan / largos.length) * 100).toFixed(1)} %)`);
  }
}
console.log("\nFin. Nada se escribio.");
