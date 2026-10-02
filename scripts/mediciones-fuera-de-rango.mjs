// ══════════════════════════════════════════════════════════════════════════════════════════════════
// MEDICIONES CON INSUMOS FUERA DE RANGO FISIOLOGICO
//
// SOLO LECTURA. No escribe nada. Responde la pregunta de Santiago del 2026-10-02 tras el caso de la
// capacitancia C=16.22: ¿es una sola medicion rara, o hay varias?
//
// POR QUE IMPORTA LA RESPUESTA, y no es curiosidad: si salen VARIAS, el rango esta mal fijado o el
// equipo mide distinto de lo que supusimos, y entonces la pregunta a Gildardo pesa mucho mas. Si es UNA
// en 160 pacientes, es un caso raro de verdad y se resuelve repitiendo esa toma.
//
// ── POR QUE IMPORTA LOS RANGOS DEL MOTOR EN VEZ DE ESCRIBIRLOS AQUI ──
//
// Copiarlos a este script crearia una SEGUNDA definicion de "fuera de rango", y la diferencia entre las
// dos se veria como una medicion que el sistema frena y este conteo no lista, o al reves. Es la misma
// razon por la que el conteo de encuestas importa `isAnswered` en vez de reescribirlo en SQL.
//
// COMO SE CORRE (va con `tsx` porque importa modulos TypeScript del motor):
//
//   Contra la NUBE (PowerShell, igual que db:probar:cloud):
//     $env:DATABASE_URL="<cadena de la nube>"; pnpm tsx scripts/mediciones-fuera-de-rango.mjs
//
//   Contra la base LOCAL (la cadena se pasa igual; `node --env-file` NO sirve aqui porque no resuelve
//   los imports de TypeScript sin extension):
//     $env:DATABASE_URL="postgresql://...54322/postgres"; pnpm tsx scripts/mediciones-fuera-de-rango.mjs
//
// NO IMPRIME DATOS DE PACIENTE: el documento va recortado (los ultimos cuatro digitos) para poder
// buscarlo sin dejar el numero entero en una salida que se pega en un chat.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import postgres from "postgres";

import { BIODY_COLUMNS } from "../src/clinical-engine/edge/biody-columns.ts";
import { SANITY } from "../src/clinical-engine/edge/biody-import.ts";
import { normalizeHeader } from "../src/modules/bis/services/header-map.ts";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

// El nombre con el que cada insumo vive en `bis_raw_values` (el header normalizado del export).
const columna = Object.fromEntries(
  Object.keys(SANITY).map((campo) => [campo, normalizeHeader(BIODY_COLUMNS[campo].header)]),
);

const filas = await sql`
  select v.variable_name, v.value::float8 as valor, m.evaluation_id, m.import_batch_id is not null as importada,
         e.created_at::date as fecha, p.document_number, d.id is not null as tiene_diagnostico
    from bis_raw_values v
    join bis_measurements m on m.id = v.measurement_id
    join evaluations e on e.id = m.evaluation_id
    join patients p on p.id = e.patient_id
    left join diagnoses d on d.evaluation_id = e.id
   where coalesce(p.is_test, false) = false`;

const fuera = [];
for (const f of filas) {
  const campo = Object.keys(columna).find((c) => columna[c] === f.variable_name);
  if (!campo) continue;
  const [min, max] = SANITY[campo];
  if (f.valor < min || f.valor > max) {
    fuera.push({ ...f, campo, min, max });
  }
}

const mediciones = new Set(fuera.map((f) => f.evaluation_id));
console.log("MEDICIONES CON ALGUN INSUMO FUERA DE RANGO");
console.log("  evaluaciones afectadas:", mediciones.size);
console.log("  valores fuera de rango :", fuera.length);
console.log("  (de", filas.length, "valores crudos mirados, pacientes no de prueba)");

if (fuera.length === 0) {
  console.log("\nNinguna. El caso de la capacitancia seria el unico, y ya no tiene medicion guardada o se corrigio.");
} else {
  const porCampo = new Map();
  for (const f of fuera) porCampo.set(f.campo, (porCampo.get(f.campo) ?? 0) + 1);
  console.log("\nPOR INSUMO (cuantas veces cae fuera cada uno):");
  for (const [campo, n] of [...porCampo.entries()].sort((a, b) => b[1] - a[1])) {
    const [min, max] = SANITY[campo];
    console.log(`  ${campo.padEnd(6)} ${String(n).padStart(4)}   rango ${min}-${max}`);
  }
  console.log("\nEL DETALLE (una linea por valor fuera de rango):");
  for (const f of fuera.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))) {
    const doc = String(f.document_number ?? "");
    console.log(
      `  ${String(f.fecha).slice(0, 10)}  doc ...${doc.slice(-4)}  ${f.campo}=${f.valor}  (rango ${f.min}-${f.max})` +
        `${f.importada ? "  [importada del HTML]" : ""}${f.tiene_diagnostico ? "  [YA tiene diagnostico]" : "  [SIN diagnostico]"}`,
    );
  }
  console.log(
    "\nOJO CON LAS QUE DICEN [YA tiene diagnostico]: se sellaron ANTES de que la puerta existiera o por otra via.\n" +
      "Esas hay que mirarlas aparte: su diagnostico se calculo con un valor que hoy el sistema no dejaria entrar.",
  );
}

await sql.end();
