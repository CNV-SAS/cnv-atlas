// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE DICE CADA SUPERFICIE DE CADA INDICE  ·  SOLO LECTURA  ·  2026-11-16
//
//   node --env-file=.env.production.local scripts/los-veredictos-de-la-hc-contra-el-dfi.mjs [id...]
//
// Sin ids, barre TODAS las consultas con informe sellado y resume. Con ids (completos o prefijo de 8),
// imprime el detalle de cada una.
//
// PARA QUE: Santiago reporto (2026-11-16) que en una consulta ya reemitida a 4.0.0 el diagnostico esta
// bien y la tabla "Indices ANI-BIS-E alterados" de la historia clinica no. Este script no arregla nada:
// MIDE, que es lo que decide si la causa que uno cree es la causa que hay. Compara, sobre el MISMO sello:
//
//   · la severidad que la HC usa HOY para decidir que entra en "alterados" (se computa con el snapshot
//     RECORTADO que recibe `componerHistoriaClinica`, que no lleva `sexo`), contra
//   · la severidad computada con el sexo del sello, que es la que usa la pantalla de Diagnostico.
//
// Esa diferencia es lo que hace que una fila ENTRE o NO ENTRE en un documento probatorio, y desde la v17
// pesa el doble: sus clasificadores por sexo (`cIFC`, `cPABU`, `cFMI`, `cFFMI`) ya no caen a un corte
// global, devuelven "sin sexo: no se clasifica" con color gris, y el gris no tiene severidad.
//
// Tambien coteja los TRES sitios donde el veredicto se puede decir dos veces:
//   · el rotulo de display del IEHH contra su clasificador `cIEHH` de la v17 (tres zonas);
//   · el fenotipo MCCB sellado (F1-F12) contra el sector de la Diana (S1-S9), que nombran el MISMO cruce;
//   · las alertas criticas contra las filas que la HC lista.
//
// NO IMPRIME NINGUN DATO DE PACIENTE: ni nombre, ni documento, ni fecha de nacimiento. Los VALORES de los
// indicadores si se imprimen en el modo detalle (son variables clinicas seudonimizadas, y son justo lo
// que hay que ver para saber de que lado del corte cae cada uno); en el modo barrido solo van cuentas.
//
// Y TODA CONSULTA LEE SU `error` Y LO IMPRIME: un script de diagnostico que calla un error de base da una
// respuesta en firme sobre algo que no pudo mirar.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import { todasLasFilas } from "./lib/todas-las-filas.mjs";

const require = createRequire(import.meta.url);
// EL MOTOR CONGELADO, el MISMO que corre en la aplicacion. No se copia ningun corte a este archivo: si
// se copiaran, el script podria decir que todo cuadra mientras la aplicacion usa otros numeros.
const core = require("../src/clinical-engine/frozen/engine.core.derived.js");

const PREFIJO = /^[0-9a-f]{8}$/i;
const COMPLETO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const LLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !LLAVE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}
const sb = createClient(URL_SB, LLAVE, { auth: { persistSession: false } });
console.log(`base: ${new URL(URL_SB).host}`);

// ─── LA MISMA ARITMETICA DEL COLOR QUE `clinical-engine/severity.ts` ──────────────────────────────
// Se reescribe aqui porque aquello es TypeScript y esto corre con node a secas. Es la unica copia del
// script, y es de FORMA (como se lee un hexadecimal), no de ciencia: ningun corte clinico se copia.
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

/** Las severidades de los indices ANI, con el sexo que se le pase (null = como las recibe la HC hoy). */
function severidades(ind, sexo) {
  const s = {};
  s.IFC = veredictoSev(core.cIFC(ind.ifc, sexo));
  s.IRC = veredictoSev(core.cIRC(ind.irc, sexo));
  s.PABU = veredictoSev(core.cPABU(ind.pabu, sexo));
  if (ind.iehh != null) s.IEHH = veredictoSev(core.cIEHH(ind.iehh));
  if (ind.iae != null) s.IAE = veredictoSev(core.cIAE(ind.iae));
  // La fila ICA-BIS de la HC toma la clasificacion del PABU (ATLAS_v8 L15425).
  s["ICA-BIS"] = s.PABU;
  return s;
}

/** El rotulo de display del IEHH que la aplicacion pinta HOY (indicator-ranges.ts, escalera de la v16). */
const rotuloIehhDeHoy = (v) =>
  v <= 0
    ? "Equilibrio hídrico óptimo"
    : v <= 1
      ? "Desequilibrio leve"
      : v <= 2
        ? "Desequilibrio moderado"
        : "Desequilibrio severo";

/** El clasificador de la fila ICA-BIS de la PANTALLA de Diagnostico: el porte de su `dICA`, por MAGNITUD. */
const claseIcaDeHoy = (ica) => {
  if (ica == null) return null;
  if (ica < 0) {
    if (ica > -0.15) return "Reserva bioeléctrica leve";
    if (ica > -0.5) return "Reserva bioeléctrica moderada";
    return "Reserva bioeléctrica superior";
  }
  if (ica <= 0.15) return "Zona φ — Homeostasis óptima";
  if (ica <= 0.5) return "Desviación leve";
  if (ica <= 1.5) return "Desviación moderada";
  if (ica <= 3.0) return "Desviación severa";
  return "Zona crítica";
};

const CODIGOS = ["IFC", "IRC", "ISCM", "IEHH", "EB", "IAE", "PABU", "ICA-BIS"];

/** Lee un resultado de PostgREST diciendo en voz alta si fallo. `null` = no se pudo mirar. */
function leer(etiqueta, { data, error }) {
  if (error) {
    console.log(`  ! ${etiqueta}: la base respondio con error -> ${error.message}`);
    return null;
  }
  return data;
}

function porId(q, arg) {
  if (COMPLETO.test(arg)) return q.eq("evaluation_id", arg);
  return q
    .gte("evaluation_id", `${arg}-0000-0000-0000-000000000000`)
    .lte("evaluation_id", `${arg}-ffff-ffff-ffff-ffffffffffff`);
}

/** El informe mas reciente de una consulta, con su snapshot del motor. */
async function ultimoInforme(arg) {
  const q = sb
    .from("reports")
    .select("evaluation_id, snapshot, created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  return leer(`reports ${arg}`, await porId(q, arg));
}

/** Lo que cada superficie dice de este sello. Puro: ni lee ni imprime. */
function analizar(snap) {
  const ind = snap?.indicators ?? null;
  if (!ind) return null;
  const sexo = snap.sexo ?? null;
  const conSexo = severidades(ind, sexo);
  const sinSexo = severidades(ind, undefined); // lo que recibe la HC hoy
  const clas = snap.classifications ?? {};

  const filas = CODIGOS.map((cod) => {
    const valor = { IFC: ind.ifc, IRC: ind.irc, ISCM: ind.iscm, IEHH: ind.iehh, EB: ind.eb, IAE: ind.iae, PABU: ind.pabu, "ICA-BIS": ind.icaBis }[cod];
    const sello = clas[cod]?.label ?? (cod === "ICA-BIS" ? (clas.PABU?.label ?? null) : null);
    const entraHoy = valor != null && Number.isFinite(valor) && (sinSexo[cod] ?? 0) >= 1 && !!sello;
    const entraConSexo = valor != null && Number.isFinite(valor) && (conSexo[cod] ?? 0) >= 1 && !!sello;
    return { cod, valor, sello, sevHoy: sinSexo[cod] ?? null, sevConSexo: conSexo[cod] ?? null, entraHoy, entraConSexo };
  });

  const iehh = ind.iehh;
  const iehhZona = iehh != null ? core.cIEHH(iehh).l : null;
  const iehhDisplay = iehh != null ? rotuloIehhDeHoy(iehh) : null;
  // El empate se decide por la ZONA, no por el texto: su clasificador dice "Óptimo" y el display
  // "Equilibrio hídrico óptimo", que son la misma cosa dicha con mas palabras.
  const iehhDiscrepa =
    iehh != null && (iehhZona === "Óptimo") !== (iehhDisplay === "Equilibrio hídrico óptimo");

  // EL ICA-BIS: la PANTALLA lo clasifica con el porte de su `dICA` (magnitud, cinco escalones) y la HC
  // con `cPABU` (percentiles del sexo, v17). Su v17 BORRO `dICA`, asi que la pantalla se quedo sola con
  // una regla que ya no esta en su archivo, aplicada ademas a un valor que desde la v17 lleva signo.
  const icaDerivado = ind.pabu ? Math.round((ind.pabu - 1.618) * 1e4) / 1e4 : null;
  const icaPantalla = claseIcaDeHoy(icaDerivado);
  const icaHc = sexo && ind.pabu ? String(core.cPABU(ind.pabu, sexo).l) : null;
  const icaDiscrepa = icaPantalla != null && icaHc != null && icaPantalla !== icaHc;
  // Y el caso que mas cuesta: la pantalla dice "reserva bioelectrica" (que se lee como algo bueno, y va
  // en azul) donde su clasificador dice desplazamiento por EXCESO.
  const icaReservaPorExceso = icaDerivado != null && icaDerivado < 0 && /reserva/i.test(icaPantalla ?? "");

  const fenotipo = snap.fenotipoMCCB?.nombre ?? null;
  const sector = snap.sectorDiana ? `${snap.sectorDiana.id} · ${snap.sectorDiana.fenotipo}` : null;

  return { sexo, filas, iehh, iehhZona, iehhDisplay, iehhDiscrepa, icaPantalla, icaHc, icaDiscrepa, icaReservaPorExceso, fenotipo, sector };
}

const args = process.argv.slice(2);

if (args.length > 0) {
  for (const arg of args) {
    console.log(`\n══ ${arg} ══`);
    if (!COMPLETO.test(arg) && !PREFIJO.test(arg)) {
      console.log("  ! no parece un uuid ni un prefijo de 8; se salta");
      continue;
    }
    const filas = await ultimoInforme(arg);
    if (filas == null) continue;
    if (filas.length === 0) {
      console.log("  sin informe sellado");
      continue;
    }
    const a = analizar(filas[0].snapshot);
    if (!a) {
      console.log("  el informe no trae indicadores del motor");
      continue;
    }
    console.log(`  sexo en el sello: ${a.sexo ?? "(no viene)"}`);
    console.log("  indice     valor      sello                          sev HC  sev c/sexo  ¿entra hoy?  ¿debería?");
    for (const f of a.filas) {
      const v = f.valor == null ? "—" : Number(f.valor).toFixed(2);
      console.log(
        `  ${f.cod.padEnd(9)} ${String(v).padStart(8)}  ${String(f.sello ?? "—").padEnd(30)} ` +
          `${String(f.sevHoy ?? "—").padStart(5)}  ${String(f.sevConSexo ?? "—").padStart(9)}  ` +
          `${(f.entraHoy ? "sí" : "no").padStart(10)}  ${(f.entraConSexo ? "sí" : "no").padStart(9)}` +
          (f.entraHoy !== f.entraConSexo ? "   <<< difiere" : ""),
      );
    }
    if (a.iehh != null) {
      console.log(
        `  IEHH: zona del clasificador "${a.iehhZona}" · rótulo que pinta la app "${a.iehhDisplay}"` +
          (a.iehhDiscrepa ? "   <<< se contradicen" : ""),
      );
    }
    if (a.icaPantalla || a.icaHc) {
      console.log(`  ICA-BIS: pantalla "${a.icaPantalla ?? "—"}" · HC y su v17 "${a.icaHc ?? "—"}"` + (a.icaDiscrepa ? "   <<< se contradicen" : ""));
    }
    console.log(`  composición: fenotipo MCCB "${a.fenotipo ?? "—"}" · sector de la Diana "${a.sector ?? "—"}"`);
  }
} else {
  // ─── EL BARRIDO: solo cuentas ───────────────────────────────────────────────────────────────────
  // POR PAGINAS Y ORDENADO, no `.limit(5000)`: PostgREST devuelve mil filas y no lo dice. La primera
  // corrida de este script dio 251 consultas donde hay mas de quinientas, y el numero era creible.
  const data = await todasLasFilas(sb, "reports", "evaluation_id, snapshot, created_at", undefined, {
    orden: "evaluation_id,created_at",
  });
  // Ascendente, asi que la ULTIMA fila de cada consulta es su informe mas reciente.
  const ultimo = new Map();
  for (const r of data) ultimo.set(r.evaluation_id, r);

  const c = { total: 0, sinIndicadores: 0, sinSexo: 0, difieren: 0, iehhDiscrepa: 0, icaDiscrepa: 0, icaReserva: 0, fenotipoYSector: 0, nombresDistintos: 0 };
  const porIndice = new Map();
  for (const r of ultimo.values()) {
    c.total++;
    const a = analizar(r.snapshot);
    if (!a) {
      c.sinIndicadores++;
      continue;
    }
    if (!a.sexo) c.sinSexo++;
    let difiere = false;
    for (const f of a.filas) {
      if (f.entraHoy !== f.entraConSexo) {
        difiere = true;
        const clave = f.cod + (f.entraConSexo ? "  (faltaba)" : "  (sobraba)");
        porIndice.set(clave, (porIndice.get(clave) ?? 0) + 1);
      }
    }
    if (difiere) c.difieren++;
    if (a.iehhDiscrepa) c.iehhDiscrepa++;
    if (a.icaDiscrepa) c.icaDiscrepa++;
    if (a.icaReservaPorExceso) c.icaReserva++;
    if (a.fenotipo && a.sector) {
      c.fenotipoYSector++;
      if (!a.sector.endsWith(a.fenotipo)) c.nombresDistintos++;
    }
  }

  console.log(`\nconsultas con informe sellado: ${c.total}`);
  console.log(`  sin indicadores del motor en el sello: ${c.sinIndicadores}`);
  console.log(`  sin sexo en el sello: ${c.sinSexo}`);
  console.log(`\nLA TABLA DE LA HC CONTRA LA PANTALLA (filas que entran o salen por la severidad sin sexo):`);
  console.log(`  consultas en las que al menos una fila difiere: ${c.difieren} de ${c.total}`);
  for (const [cod, n] of [...porIndice.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cod.padEnd(22)} ${String(n).padStart(4)}`);
  }
  console.log(`\nEL IEHH: rótulo de la app contra su clasificador de la v17`);
  console.log(`  consultas en las que se contradicen: ${c.iehhDiscrepa} de ${c.total}`);
  console.log(`\nEL ICA-BIS: la pantalla (el porte de su "dICA", que su v17 BORRÓ) contra "cPABU"`);
  console.log(`  consultas en las que se contradicen: ${c.icaDiscrepa} de ${c.total}`);
  console.log(`  de ellas, las que la pantalla llama "reserva bioeléctrica" y su v17 llama exceso: ${c.icaReserva}`);
  console.log(`\nLA COMPOSICIÓN: fenotipo MCCB contra sector de la Diana`);
  console.log(`  consultas con los dos sellados: ${c.fenotipoYSector}`);
  console.log(`  con nombres distintos para el mismo cruce: ${c.nombresDistintos}`);
}
