// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL OMEGA: DONDE LO SUGIERE EL MODELO Y EN CUANTAS CONSULTAS SE PRESCRIBIO  ·  SOLO LECTURA
//
// COMO SE CORRE:
//
//   node --env-file=.env.production.local scripts/el-omega-en-la-cohorte.mjs
//
// NO ESCRIBE NADA y NO IMPRIME NINGUN DATO DE PACIENTE: solo cuentas, nombres de producto y numeros de
// estado de la Diana.
//
// LAS DOS MITADES SON DISTINTAS Y HAY QUE LEERLAS APARTE:
//
//   · SUGERIDO es del MODELO: sale de `snapshot.nutraceuticos`, la lista que el motor sello en el informe
//     de esa consulta. Es una propiedad del estado de la Diana, no una decision de nadie;
//   · PRESCRITO es del PROFESIONAL: sale de `treatment_nutraceuticals`, o sea de lo que firmo en la ruta
//     de atencion. El motor propone y el profesional dispone (Regla 0), asi que la diferencia entre las
//     dos cifras NO es un error: es la decision clinica, y eso es lo que hay que decirle al gerente.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createRequire } from "node:module";

import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const core = require("../src/clinical-engine/frozen/engine.core.js");

const ES_OMEGA = /omega/i;

// ── 1 · EL MAPA DE LOS 81 ESTADOS, del motor congelado (sin tocar la base) ──
const ORDEN = [[3,1],[3,2],[2,1],[2,2],[3,3],[2,3],[1,1],[1,2],[1,3]];
const PALABRA = { 3: "Alto", 2: "Normal", 1: "Bajo" };
const rank = (a, b) => ORDEN.findIndex(([x, y]) => x === a && y === b);
const estados = [];
for (let ifc = 1; ifc <= 3; ifc++)
  for (let irc = 1; irc <= 3; irc++)
    for (let ffmi = 1; ffmi <= 3; ffmi++)
      for (let fmi = 1; fmi <= 3; fmi++) {
        const dx = core.getDX(ifc, irc, ffmi, fmi);
        const productos = String((dx && dx.n) || "").split(",").map((p) => p.trim()).filter(Boolean);
        estados.push({
          num: rank(ifc, irc) * 9 + rank(ffmi, fmi) + 1,
          etiqueta: `A${rank(ifc, irc) + 1}·S${rank(ffmi, fmi) + 1}`,
          ifc: PALABRA[ifc], irc: PALABRA[irc], ffmi: PALABRA[ffmi], fmi: PALABRA[fmi],
          productos,
          omega: productos.filter((p) => ES_OMEGA.test(p)),
        });
      }
const conOmega = estados.filter((e) => e.omega.length > 0);
const sinOmega = estados.filter((e) => e.omega.length === 0);
console.log(`── EL MODELO ──`);
console.log(`estados de la Diana: ${estados.length} · lo sugieren ${conOmega.length} · no lo sugieren ${sinOmega.length}`);
console.log(`producto exacto: ${[...new Set(estados.flatMap((e) => e.omega))].join(" | ")}`);
console.log(`los que NO lo sugieren:`);
for (const e of sinOmega.sort((a, b) => a.num - b.num)) {
  console.log(`  #${e.num} ${e.etiqueta}  IFC ${e.ifc} · IRC ${e.irc} · FFMI ${e.ffmi} · FMI ${e.fmi}  ->  ${e.productos.join(", ")}`);
}

// ── 2 · LA COHORTE ──
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: evs } = await sb
  .from("evaluations")
  .select("id")
  .is("superseded_at", null)
  .is("retirada_at", null);
const vigentes = new Set((evs ?? []).map((e) => e.id));

// Las consultas CON TRATAMIENTO (el denominador que pidio el gerente).
const { data: dgs } = await sb.from("diagnoses").select("id, evaluation_id");
const evalPorDx = new Map((dgs ?? []).map((d) => [d.id, d.evaluation_id]));
const { data: trs } = await sb.from("treatments").select("id, diagnosis_id");
const evalPorTratamiento = new Map();
for (const t of trs ?? []) {
  const e = evalPorDx.get(t.diagnosis_id);
  if (e && vigentes.has(e)) evalPorTratamiento.set(t.id, e);
}
const conTratamiento = new Set(evalPorTratamiento.values());

// PRESCRITO: una linea de `treatment_nutraceuticals` cuyo producto se llame omega.
const { data: nts } = await sb.from("nutraceuticals").select("id, name");
const idsOmega = new Set((nts ?? []).filter((n) => ES_OMEGA.test(String(n.name))).map((n) => n.id));
const nombresOmega = (nts ?? []).filter((n) => idsOmega.has(n.id)).map((n) => n.name);
const { data: tn } = await sb.from("treatment_nutraceuticals").select("treatment_id, nutraceutical_id");
const prescrito = new Set();
for (const fila of tn ?? []) {
  if (!idsOmega.has(fila.nutraceutical_id)) continue;
  const e = evalPorTratamiento.get(fila.treatment_id);
  if (e) prescrito.add(e);
}

// SUGERIDO: la lista que el motor sello en el informe de esa consulta.
const { data: reps } = await sb
  .from("reports")
  .select("evaluation_id, created_at, snapshot")
  .eq("type", "paciente")
  .order("created_at", { ascending: false });
const vistas = new Set();
const sugerido = new Set();
let conInforme = 0;
for (const r of reps ?? []) {
  if (!conTratamiento.has(r.evaluation_id) || vistas.has(r.evaluation_id)) continue;
  vistas.add(r.evaluation_id);
  conInforme++;
  if (ES_OMEGA.test(String(r.snapshot?.nutraceuticos ?? ""))) sugerido.add(r.evaluation_id);
}

// ── 3 · LAS TRES POBLACIONES, SEPARADAS (y la razon de separarlas) ──
// La corrida del 11 de noviembre dio "prescrito SIN que el modelo lo sugiriera: 31" con el modelo
// sugiriendolo en 434 de 434 consultas con informe. Las dos cifras juntas solo pueden significar una
// cosa: esas 31 son consultas CON TRATAMIENTO y SIN INFORME SELLADO, o sea sin snapshot contra el que
// comparar. Decir de ellas que el profesional se aparto del modelo es afirmar algo que el dato no
// sostiene, asi que desde aqui se cuentan aparte.
const sinInforme = new Set([...conTratamiento].filter((e) => !vistas.has(e)));
const pc = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(1)} %` : "-");
console.log(`\n── LA COHORTE ──`);
console.log(`productos de catalogo que son omega: ${nombresOmega.join(", ") || "(ninguno)"}`);
console.log(`consultas vigentes CON TRATAMIENTO: ${conTratamiento.size}`);
console.log(`  de ellas con informe de paciente sellado: ${conInforme} · sin informe: ${sinInforme.size}`);
console.log(`  el modelo lo SUGIRIO en: ${sugerido.size} (${pc(sugerido.size, conInforme)} de las que tienen informe)`);
console.log(`  el profesional lo PRESCRIBIO en: ${prescrito.size} (${pc(prescrito.size, conTratamiento.size)} de las que tienen tratamiento)`);

const sugeridoYprescrito = [...sugerido].filter((e) => prescrito.has(e)).length;
const prescritoSinSugerencia = [...prescrito].filter((e) => vistas.has(e) && !sugerido.has(e)).length;
const prescritoSinInforme = [...prescrito].filter((e) => !vistas.has(e)).length;
console.log(`\n  sugerido Y prescrito: ${sugeridoYprescrito}`);
console.log(`  sugerido y NO prescrito: ${sugerido.size - sugeridoYprescrito}`);
console.log(`  prescrito con informe que NO lo sugirio: ${prescritoSinSugerencia}  ← esto si es apartarse del modelo`);
console.log(`  prescrito SIN informe para comparar: ${prescritoSinInforme}  ← no se sabe que sugirio el modelo`);

// Un cuadre: las tres poblaciones de "prescrito" tienen que sumar el total prescrito.
const suma = sugeridoYprescrito + prescritoSinSugerencia + prescritoSinInforme;
if (suma !== prescrito.size) {
  console.log(`\n  ! las cuentas no cuadran: ${suma} contra ${prescrito.size} prescritos. No usar estas cifras.`);
}
