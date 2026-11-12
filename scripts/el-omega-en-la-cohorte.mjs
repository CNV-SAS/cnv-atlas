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

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// TRAER TODAS LAS FILAS, Y NO LAS PRIMERAS MIL  ·  2026-11-12
//
// ═══ EL RIESGO QUE CIERRA, Y YA NOS COSTO UNA CIFRA ═══
//
// PostgREST devuelve como maximo MIL filas por consulta y **no lo dice**: no hay error, no hay aviso, la
// respuesta llega completa en apariencia. Un script de medicion que pida `reports` o `evaluations` sin
// paginar mide la cohorte que CABE en mil filas y reporta porcentajes sobre ella como si fueran de todas.
// Ya paso: una pantalla decia 316 y el dato real eran 136.
//
// EL ORDEN NO ES ESTETICO, ES LO QUE HACE QUE LA PAGINACION SIGNIFIQUE ALGO. Paginar sin un `order by`
// estable no define que trae cada pagina: el motor puede devolver la misma fila dos veces y perder otra,
// y el total sale mal por los dos lados a la vez. Se ordena por `id`, que es unico.
//
// Y FALLA RUIDOSO ante un error de base, en vez de devolver lo que alcanzo a traer: una medicion a medias
// con forma de medicion completa es peor que ninguna.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
const PAGINA = 1000;
async function traerTodo(tabla, columnas, filtrar = (q) => q, orden = "id") {
  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await filtrar(sb.from(tabla).select(columnas))
      .order(orden, { ascending: true })
      .range(desde, desde + PAGINA - 1);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    filas.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) return filas;
  }
}

const evs = await traerTodo("evaluations", "id", (q) => q.is("superseded_at", null).is("retirada_at", null));
const vigentes = new Set(evs.map((e) => e.id));

// Las consultas CON TRATAMIENTO (el denominador que pidio el gerente).
const dgs = await traerTodo("diagnoses", "id, evaluation_id");
const evalPorDx = new Map(dgs.map((d) => [d.id, d.evaluation_id]));
const trs = await traerTodo("treatments", "id, diagnosis_id");
const evalPorTratamiento = new Map();
for (const t of trs) {
  const e = evalPorDx.get(t.diagnosis_id);
  if (e && vigentes.has(e)) evalPorTratamiento.set(t.id, e);
}
const conTratamiento = new Set(evalPorTratamiento.values());

// PRESCRITO: una linea de `treatment_nutraceuticals` cuyo producto se llame omega.
const nts = await traerTodo("nutraceuticals", "id, name");
const idsOmega = new Set(nts.filter((n) => ES_OMEGA.test(String(n.name))).map((n) => n.id));
const nombresOmega = nts.filter((n) => idsOmega.has(n.id)).map((n) => n.name);
const tn = await traerTodo("treatment_nutraceuticals", "id, treatment_id, nutraceutical_id");
const prescrito = new Set();
for (const fila of tn) {
  if (!idsOmega.has(fila.nutraceutical_id)) continue;
  const e = evalPorTratamiento.get(fila.treatment_id);
  if (e) prescrito.add(e);
}

// SUGERIDO: la lista que el motor sello en el informe de esa consulta.
// Se pide con `id` para paginar por columna unica, y el MAS RECIENTE por consulta se elige despues
// ordenando en memoria (la paginacion ya ordena por id, asi que no puede ordenar por fecha a la vez).
const repsCrudos = await traerTodo("reports", "id, evaluation_id, created_at, snapshot", (q) => q.eq("type", "paciente"));
const reps = [...repsCrudos].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
const vistas = new Set();
const sugerido = new Set();
let conInforme = 0;
for (const r of reps) {
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
