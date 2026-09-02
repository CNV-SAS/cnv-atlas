// MEDICION: ¿cuantos tratamientos darian el aviso de desfase HOY?
// Se ejecuta la MISMA funcion que la pantalla, sobre los snapshots reales de la base.
import postgres from "postgres";
import { computeProtocoloEfectivo } from "../src/clinical-engine/protocolo.ts";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const SIN_AJUSTES = { geb: null, pal: null, kcalObj: null, protGkg: null, fatPct: null, deficit: null, pesoMeta: null };

const filas = await sql`
  select t.id, t.status, t.protocol_suggested as snap,
         pp.first_name || ' ' || pp.last_name as paciente
  from treatments t
  join diagnoses d on d.id = t.diagnosis_id
  join evaluations e on e.id = d.evaluation_id
  join patients p on p.id = e.patient_id
  join patient_profiles pp on pp.patient_id = p.id
  order by t.created_at desc`;

let total = 0, sinSnap = 0, sinCalorico = 0, avisan = 0, iguales = 0, errores = 0;
const porVersion = new Map();
const ejemplos = [];

for (const f of filas) {
  total++;
  const snap = f.snap;
  if (!snap) { sinSnap++; continue; }
  if (!snap.calorico) { sinCalorico++; continue; }
  const v = snap.protocolEngineVersion ?? "(sin version)";
  porVersion.set(v, (porVersion.get(v) ?? 0) + 1);
  try {
    const hoy = computeProtocoloEfectivo(snap, SIN_AJUSTES).calorico;
    const kSel = Math.round(snap.calorico.kcalObj), kHoy = Math.round(hoy.kcalObj);
    const pSel = Math.round(snap.calorico.protG), pHoy = Math.round(hoy.protG);
    if (kSel !== kHoy || pSel !== pHoy) {
      avisan++;
      if (ejemplos.length < 6) ejemplos.push(`${f.paciente} | ${v} | kcal ${kSel}->${kHoy} | prot ${pSel}->${pHoy}`);
    } else iguales++;
  } catch (e) { errores++; if (errores <= 2) console.log("  ERROR:", String(e).slice(0, 120)); }
}

console.log(`tratamientos: ${total} | sin snapshot: ${sinSnap} | snapshot sin cadena: ${sinCalorico} | errores: ${errores}`);
console.log(`\nCON CADENA COMPARABLE: ${avisan + iguales}`);
console.log(`  AVISARIAN hoy: ${avisan}`);
console.log(`  identicos:     ${iguales}`);
console.log("\nversiones selladas vivas:");
for (const [v, n] of [...porVersion].sort((a,b)=>b[1]-a[1])) console.log(`  ${v}: ${n}`);
if (ejemplos.length) { console.log("\nejemplos que avisarian:"); for (const e of ejemplos) console.log("  " + e); }
await sql.end();
