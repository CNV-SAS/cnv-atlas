// ══════════════════════════════════════════════════════════════════════════════════════════════════
// HOMBRES CON EL ICA-BIS ALTERADO  ·  SOLO LECTURA  ·  2026-11-16
//
//   node --env-file=.env.production.local scripts/hombres-con-el-ica-bis-alterado.mjs
//
// PARA QUE: la tabla "Índices ANI-BIS-E alterados" de la historia clínica muestra SOLO lo alterado, así
// que para verificar la fila del ICA-BIS en un hombre no sirve cualquier consulta: hace falta una donde
// esa fila ENTRE. Santiago no la encontraba a ojo (2026-11-16).
//
// QUE CUENTA COMO ALTERADO: no se copia ningún corte a este archivo. Se le pregunta a `cPABU`, que es
// quien tiene la Tabla 7.3 de su v17, con el sexo del SELLO; la fila entra en la HC cuando esa
// clasificación trae severidad (color distinto del óptimo) y el sello tiene su rótulo. Es exactamente lo
// que hace `indicesAniAlterados`, y por eso esto predice lo que se va a ver en pantalla.
//
// EL ICA-BIS SE DERIVA DE LA PABU SELLADA (v17 §4: ICA-BIS = PABU − φ, CON SIGNO), que es lo que hace la
// aplicación: el valor sellado en informes viejos está en magnitud y diría otra cosa.
//
// NO IMPRIME NINGUN DATO DE PACIENTE: ni nombre, ni documento, ni fecha. Solo el id abreviado a 8, si la
// consulta es de prueba, y los valores del indicador, que son variables clínicas seudonimizadas y son
// justo lo que hay que ver.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";

import { todasLasFilas } from "./lib/todas-las-filas.mjs";

const require = createRequire(import.meta.url);
// EL MOTOR CONGELADO, el MISMO que corre en la aplicación.
const core = require("../src/clinical-engine/frozen/engine.core.derived.js");

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const LLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !LLAVE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}
const sb = createClient(URL_SB, LLAVE, { auth: { persistSession: false } });
console.log(`base: ${new URL(URL_SB).host}`);

const PHI = 1.618;
const corto = (id) => String(id).slice(0, 8);

// La misma aritmética del color que `clinical-engine/severity.ts`. Es de FORMA (cómo se lee un
// hexadecimal), no de ciencia: ningún corte clínico se copia aquí.
function colorSev(c) {
  if (typeof c !== "string" || !/^#[0-9a-fA-F]{6}$/.test(c)) return null;
  const r = parseInt(c.slice(1, 3), 16);
  const g = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0 || (max - min) / max < 0.28) return null;
  if (g > r) return 0;
  if (g >= 80) return 2;
  return 3;
}
const AZUL = /^#(3b82f6|60a5fa|2563eb|1d4ed8|93c5fd|bfdbfe|0ea5e9|38bdf8)$/i;
function veredictoSev(v) {
  if (!v) return null;
  if (typeof v.c === "string" && AZUL.test(v.c)) return /óptim|optim/i.test(String(v.l ?? "")) ? 0 : 2;
  return colorSev(v.c);
}

console.log(`referencia del ICA-BIS en hombres (su v17, Tabla 7.3): ${core.icaBisRefTxt("M")}`);
console.log(`referencia en mujeres: ${core.icaBisRefTxt("F")}\n`);

// ─── Los informes sellados, el más reciente por consulta ──────────────────────────────────────────
const informes = await todasLasFilas(sb, "reports", "evaluation_id, snapshot, created_at", undefined, {
  orden: "evaluation_id,created_at",
});
const ultimo = new Map();
for (const r of informes) ultimo.set(r.evaluation_id, r); // ordenado por created_at: el último gana

// ─── Qué consultas son de prueba (la bandera vive en el PACIENTE, no en la evaluación) ────────────
const evals = await todasLasFilas(sb, "evaluations", "id, patient_id, patients(cuenta_como_de_prueba)");
const dePrueba = new Map(evals.map((e) => [e.id, Boolean(e.patients?.cuenta_como_de_prueba)]));

const hombres = [];
for (const [evaluationId, r] of ultimo) {
  const snap = r.snapshot;
  const ind = snap?.indicators;
  if (!ind || snap.sexo !== "M") continue;
  const pabu = ind.pabu;
  if (pabu == null || !Number.isFinite(pabu)) continue;
  const ica = Math.round((pabu - PHI) * 1e4) / 1e4;
  const clas = core.cPABU(pabu, "M");
  const sev = veredictoSev(clas);
  const rotuloSellado = snap.classifications?.PABU?.label ?? null;
  hombres.push({
    evaluationId,
    prueba: dePrueba.get(evaluationId) ?? false,
    pabu,
    ica,
    etiqueta: String(clas?.l ?? ""),
    sev,
    entraEnLaHc: (sev ?? 0) >= 1 && Boolean(rotuloSellado),
  });
}

const alterados = hombres.filter((h) => h.entraEnLaHc).sort((a, b) => Math.abs(b.ica) - Math.abs(a.ica));
console.log(`hombres con informe sellado: ${hombres.length}`);
console.log(`de ellos, con el ICA-BIS ALTERADO (la fila entra en la HC): ${alterados.length}`);
console.log(`   de prueba: ${alterados.filter((h) => h.prueba).length}`);

const muestra = [...alterados.filter((h) => h.prueba), ...alterados.filter((h) => !h.prueba)];
console.log("\nlos primeros (de prueba primero):");
const vistos=new Set();for (const h of muestra.filter((h)=>{const k=h.prueba+":"+h.ica;if(vistos.has(k))return false;vistos.add(k);return true;}).slice(0, 14)) {
  const ica = h.ica > 0 ? `+${h.ica.toFixed(2)}` : h.ica.toFixed(2);
  console.log(
    `  ${corto(h.evaluationId)}  ICA-BIS ${ica.padStart(6)}  PABU ${h.pabu.toFixed(3)}  ` +
      `${h.prueba ? "de prueba" : "real     "}  ${h.etiqueta}`,
  );
}
