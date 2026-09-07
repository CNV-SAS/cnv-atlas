// GENERA LA MIGRACION DE UNA VERSION DEL CATALOGO DE CONDICIONES BIS, A PARTIR DEL SEED.
//
// POR QUE GENERADA Y NO ESCRITA A MANO. El mismo motivo que el generador de la encuesta, y aqui nos costo
// una tarde comprobarlo: el catalogo tiene DOS canales, el seed (local) y la migracion (nube). Escritos
// por separado divergen, y la divergencia no da error. El 2026-09-07 sembramos la v2 en local, las
// preguntas bajaron a doce, y la nube se quedo en catorce sin que nada lo dijera: no habia canal a la
// nube en absoluto. El seed es la fuente unica del contenido y esto se DERIVA de el.
//
// POR QUE NO ES EL MISMO SCRIPT QUE EL DE LA ENCUESTA, aunque el patron sea identico: cada generador
// extrae de SU seed unos fragmentos distintos (alli SURVEY_QUESTIONS, SECTION_LABELS y sectionFor; aqui
// CONDS y uuidFromKey). Unificarlos obligaria a parametrizar "que fragmentos evaluar", que es mas
// acoplamiento que el que ahorra con dos sitios de llamada. Lo que SI se comparte es la disciplina, y es
// la que importa: la funcion de id se toma del seed, NO se re-implementa. Dos implementaciones de un id
// determinista es exactamente como se generan filas que nadie cruza.
//
// Y NO SIRVE PARA `indicator_definitions`, que es el tercer catalogo: alli no hay tabla de versiones
// propia (las definiciones cuelgan de un `model_version_id` fijo y se actualizan EN SITIO por
// `(model_version_id, code)`), asi que desplegar un cambio exige un UPDATE y no un INSERT aditivo. Es una
// forma distinta, no una variante. Queda anotado en BACKLOG.
//
// Como se corre:  node scripts/gen-bis-conditions-migration.mjs <numero> > drizzle/NNNN_condiciones_bis_vN.sql
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const SEED = "supabase/seed-bis-conditions.ts";
const S = readFileSync(SEED, "utf8").replace(/\r\n/g, "\n");

const numero = process.argv[2];
if (!/^\d+$/.test(numero ?? "")) {
  console.error("Uso: node scripts/gen-bis-conditions-migration.mjs <numero de migracion>");
  console.error("     (el numero de la MIGRACION, p. ej. 0101; la version del catalogo sale del seed)");
  process.exit(2);
}

// ── La version, del seed. Si el seed no la declara como literal, se para: adivinarla seria abrir la
//    segunda fuente que este generador existe para cerrar. ──
const m = /^const VERSION_NUMBER = (\d+);$/m.exec(S);
if (!m) throw new Error(`no encuentro VERSION_NUMBER en ${SEED}`);
const VERSION_NUMBER = Number(m[1]);

// ── La MISMA derivacion de id que el seed: se copia su cuerpo, no se re-implementa. ──
const cuerpoUuid = /const uuidFromKey = \(key: string\): string => \{[\s\S]*?\n\};/.exec(S)?.[0];
if (!cuerpoUuid) throw new Error(`no encuentro uuidFromKey en ${SEED}`);
const ctx = { createHash };
createContext(ctx);
runInContext(cuerpoUuid.replace("(key: string): string", "(key)").replace(/^const /, "var "), ctx);
const uuidFromKey = (k) => ctx.uuidFromKey(k);

const VERSION_ID = uuidFromKey(`version:${VERSION_NUMBER}`);

// ── Las condiciones, del mismo arreglo que siembra el seed. Se le quitan solo las anotaciones de tipo,
//    que es lo unico que `vm` no entiende; el CONTENIDO no se toca. ──
const ini = S.indexOf("const CONDS: Cond[] = [");
if (ini < 0) throw new Error(`no encuentro CONDS en ${SEED}`);
const fin = S.indexOf("\n];", ini);
const c2 = {};
createContext(c2);
runInContext(`var _c = ${S.slice(S.indexOf("[", ini), fin + 2)};`, c2);
const CONDS = c2._c;
if (!Array.isArray(CONDS) || CONDS.length === 0) throw new Error("CONDS salio vacio del seed");

// La NOTA de la version tambien sale del seed: es el gobierno del cambio (por que existe esta version) y
// tenerla escrita en dos sitios es tenerla mal en uno.
const nota = /notes:\s*"((?:[^"\\]|\\.)*)"/.exec(S)?.[1];
if (!nota) throw new Error(`no encuentro las notes de la version en ${SEED}`);

const esc = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const out = [];
const p = (l = "") => out.push(l);

p(`-- CATALOGO DE CONDICIONES DE LA TOMA BIS v${VERSION_NUMBER}: ADITIVO Y FORWARD-ONLY.`);
p(`--`);
p(`-- GENERADO por scripts/gen-bis-conditions-migration.mjs desde ${SEED}. NO editar a mano: el seed es`);
p(`-- la fuente unica del contenido y esto se deriva de el. Editarlo aqui hace que los dos canales`);
p(`-- (local por seed, nube por migracion) digan cosas distintas sin que nada de error.`);
p(`--`);
p(`-- POR QUE UNA MIGRACION Y NO CORRER EL SEED CONTRA LA NUBE: el seed es seguro (su delete esta acotado`);
p(`-- a su propia version), pero un comando manual no es un despliegue. El 2026-09-07 la v2 se sembro en`);
p(`-- local y la nube se quedo en la v1 sin que nada lo dijera. Una migracion la aplica el despliegue y`);
p(`-- queda registrada en la tabla de migraciones.`);
p(`--`);
p(`-- POR QUE LAS VERSIONES ANTERIORES QUEDAN INTACTAS: los ids se derivan de (VERSION_NUMBER, clave), asi`);
p(`-- que una version nueva produce filas NUEVAS. Las capturas ya hechas guardan su respuesta en`);
p(`-- evaluation_bis_intake.condition_answers (JSONB por clave) SELLADA contra su bis_condition_version_id,`);
p(`-- y la vista de solo lectura saca los rotulos del catalogo de ESA version. Sin esa propiedad, publicar`);
p(`-- una version nueva dejaria a las evaluaciones emitidas mostrando respuestas sin su pregunta.`);
p(`--`);
p(`-- CUAL QUEDA ACTIVA: la de mayor published_at (getActiveBisConditionCatalog). La columna es NOT NULL`);
p(`-- con DEFAULT now(), asi que insertar esta fila la vuelve la activa en el momento de aplicarla.`);
p(`--`);
p(`-- IDEMPOTENTE: ON CONFLICT DO NOTHING en las dos tablas. Aplicarla dos veces deja lo mismo.`);
p();
p(`INSERT INTO bis_condition_versions (id, version_number, notes) VALUES`);
p(`  ('${VERSION_ID}', ${VERSION_NUMBER}, ${esc(nota)})`);
p(`ON CONFLICT (id) DO NOTHING;`);
p();
// LAS MISMAS COLUMNAS Y LOS MISMOS VALORES QUE EL SEED, incluida `compromises_validity` (que decide si se
// sella un caveat en el diagnostico) y `order_index` (la posicion en pantalla). Escribirlas distinto aqui
// produciria un catalogo que se ve igual y se comporta distinto.
p(
  `INSERT INTO bis_conditions (id, bis_condition_version_id, key, label, scope, kind, input_type, requires_detail, detail_label, detail_type, compromises_validity, order_index) VALUES`,
);
const filas = CONDS.map((c, i) =>
  `  ('${uuidFromKey(`${VERSION_NUMBER}:${c.key}`)}', '${VERSION_ID}', ${esc(c.key)}, ${esc(c.label)}, ` +
  `${esc(c.scope)}, ${esc(c.kind)}, ${esc(c.inputType)}, ${c.requiresDetail}, ${esc(c.detailLabel)}, ` +
  `${esc(c.detailType)}, ${c.compromisesValidity ?? false}, ${i + 1})`,
);
p(filas.join(",\n"));
p(`ON CONFLICT (id) DO NOTHING;`);
p();
p(`-- ${CONDS.length} condiciones: ${CONDS.filter((c) => c.scope === "general").length} generales + ${CONDS.filter((c) => c.scope === "mujeres").length} femeninas.`);

console.log(out.join("\n"));
