// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL ITEM DE NUTRACEUTICOS DEL CIERRE, CONTRA LA PRESCRIPCION VIGENTE  ·  SOLO LECTURA  ·  2026-11-16
//
//   node --env-file=.env.production.local scripts/el-item-de-nutraceuticos-contra-la-vigente.mjs
//
// PARA QUE: Santiago vio que prescribir un nutraceutico, QUITARLO y dejar solo un producto LUVIA cierra
// el pendiente igual. La cuenta del cierre es `treatment_nutraceuticals.length`, que SI es la vigente
// (el writer reemplaza el set entero), pero cuenta CUALQUIER producto del catalogo, y LUVIA es un
// producto de TERCERO, no un nutraceutico de CNV. Este script mide cuantas consultas estan en ese caso
// y cuantas de ellas YA SE CERRARON con el pendiente resuelto por ese motivo.
//
// NO IMPRIME NINGUN DATO DE PACIENTE: solo cuentas, nombres de producto y ids de 8 caracteres.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const LLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !LLAVE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}
const sb = createClient(URL_SB, LLAVE, { auth: { persistSession: false } });
console.log("base: " + new URL(URL_SB).host + "\n");

/** Lee una tabla entera por paginas. Sin esto PostgREST devuelve mil filas y no lo dice. */
async function todas(tabla, cols, afinar, orden = "id") {
  const out = [];
  for (let desde = 0; ; desde += 1000) {
    let q = sb.from(tabla).select(cols);
    if (afinar) q = afinar(q);
    const { data, error } = await q.order(orden).range(desde, desde + 999);
    if (error) throw new Error(tabla + ": " + error.message);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const corto = (id) => String(id ?? "").slice(0, 8);

// ── 1 · EL CATALOGO, PARTIDO COMO LO PARTE LA PANTALLA DE PRESCRIBIR ──────────────────────────────
const catalogo = await todas("nutraceuticals", "id, name, ownership, is_test");
const porId = new Map(catalogo.map((c) => [c.id, c]));
const tercero = catalogo.filter((c) => c.ownership === "tercero");
const sinOwnership = catalogo.filter((c) => c.ownership == null);
console.log("═══ 1 · EL CATALOGO ═══");
console.log("productos: " + catalogo.length);
for (const g of ["propio", "tercero", null]) {
  const n = catalogo.filter((c) => (c.ownership ?? null) === g);
  if (n.length) console.log("  ownership " + String(g) + ": " + n.length + "  (" + n.map((c) => c.name).join(", ") + ")");
}
console.log("de TERCERO: " + (tercero.map((c) => c.name).join(", ") || "ninguno"));
console.log("sin ownership declarado: " + sinOwnership.length + "\n");

// ── 2 · LA PRESCRIPCION VIGENTE DE CADA TRATAMIENTO ───────────────────────────────────────────────
const tn = await todas("treatment_nutraceuticals", "id, treatment_id, nutraceutical_id");
const vigentePorTratamiento = new Map();
for (const f of tn) {
  const lista = vigentePorTratamiento.get(f.treatment_id) ?? [];
  lista.push(f.nutraceutical_id);
  vigentePorTratamiento.set(f.treatment_id, lista);
}
const esNutraceutico = (idProducto) => (porId.get(idProducto)?.ownership ?? "propio") !== "tercero";

// ── 3 · LOS TRATAMIENTOS, CON SU CONSULTA Y SU ESTADO ─────────────────────────────────────────────
const tratamientos = await todas(
  "treatments",
  "id, diagnosis_id, sin_prescripcion_motivo, nutraceutical_decision, diagnoses(evaluation_id)",
);
const evalDe = new Map();
for (const t of tratamientos) {
  const ev = t.diagnoses?.evaluation_id ?? null;
  if (ev) evalDe.set(t.id, ev);
}
const evaluaciones = await todas(
  "evaluations",
  "id, status, patient_id, patients(cuenta_como_de_prueba)",
);
const evalPorId = new Map(evaluaciones.map((e) => [e.id, e]));

// ── 4 · EL EFECTO DE LA REGLA, TRATAMIENTO A TRATAMIENTO ──────────────────────────────────────────
let soloTercero = 0;
let soloTerceroCerradas = 0;
let soloTerceroCerradasSinOtraSalida = 0;
let soloTerceroDePrueba = 0;
const detalle = [];
let conVigente = 0;
let conNutraceuticoVigente = 0;

for (const t of tratamientos) {
  const vig = vigentePorTratamiento.get(t.id) ?? [];
  if (vig.length) conVigente++;
  const nutras = vig.filter(esNutraceutico);
  if (nutras.length) conNutraceuticoVigente++;
  if (vig.length > 0 && nutras.length === 0) {
    const ev = evalPorId.get(evalDe.get(t.id) ?? "");
    const dePrueba = ev?.patients?.cuenta_como_de_prueba === true;
    soloTercero++;
    if (dePrueba) soloTerceroDePrueba++;
    const otraSalida = t.sin_prescripcion_motivo != null || t.nutraceutical_decision === "no";
    if (ev?.status === "completed") {
      soloTerceroCerradas++;
      if (!otraSalida) soloTerceroCerradasSinOtraSalida++;
    }
    detalle.push({
      consulta: corto(ev?.id),
      prueba: dePrueba,
      estado: ev?.status ?? "(sin consulta)",
      productos: vig.map((p) => porId.get(p)?.name ?? "(?)").join(" + "),
      otraSalida,
    });
  }
}

console.log("═══ 2 · LA PRESCRIPCION VIGENTE ═══");
console.log("tratamientos: " + tratamientos.length);
console.log("con algo prescrito (cualquier producto): " + conVigente);
console.log("con al menos un NUTRACEUTICO de CNV: " + conNutraceuticoVigente);
console.log("con prescripcion que es SOLO producto de tercero: " + soloTercero + "  (de prueba: " + soloTerceroDePrueba + ")");
console.log("");

console.log("═══ 3 · LO QUE PREGUNTO SANTIAGO (c) ═══");
console.log("consultas donde el item CIERRA HOY y con la regla nueva quedaria ABIERTO: " + soloTercero);
console.log("  de esas, YA CERRADAS (status=completed): " + soloTerceroCerradas);
console.log("  de esas cerradas, SIN otra salida registrada: " + soloTerceroCerradasSinOtraSalida);
for (const d of detalle) {
  console.log(
    "   · " + d.consulta + " · " + d.estado + (d.prueba ? " · DE PRUEBA" : "") + " · [" + d.productos + "]" + (d.otraSalida ? " · tiene otra salida" : ""),
  );
}
console.log("");

// ── 5 · EL HISTORIAL: LO QUE SE EMITIO ALGUNA VEZ CONTRA LO VIGENTE ───────────────────────────────
// `prescription_emissions.prescripcion` es la COPIA sellada de lo que se le entrego al paciente. Es el
// unico historial de la prescripcion que existe (treatment_nutraceuticals se reemplaza en bloque).
const emisiones = await todas("prescription_emissions", "id, treatment_id, evaluation_id, prescripcion");
console.log("═══ 4 · EL HISTORIAL (emisiones) CONTRA LO VIGENTE ═══");
console.log("emisiones: " + emisiones.length);
if (emisiones.length) {
  console.log("forma de una emision: " + JSON.stringify(Object.keys(emisiones[0].prescripcion ?? {})));
}

/** Saca los ids de nutraceuticos que trae una emision, sea cual sea la forma del jsonb. */
function idsDeLaEmision(p) {
  const out = new Set();
  const visitar = (v) => {
    if (!v) return;
    if (Array.isArray(v)) return v.forEach(visitar);
    if (typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (/nutraceutical_?[Ii]d/.test(k) && typeof val === "string") out.add(val);
        else visitar(val);
      }
    }
  };
  visitar(p);
  return out;
}

let conEmisionConNutraSinVigente = 0;
const porTratamientoEmitido = new Map();
for (const e of emisiones) {
  const ids = idsDeLaEmision(e.prescripcion);
  const prev = porTratamientoEmitido.get(e.treatment_id) ?? new Set();
  for (const i of ids) prev.add(i);
  porTratamientoEmitido.set(e.treatment_id, prev);
}
for (const [tid, ids] of porTratamientoEmitido) {
  const emitioNutraceutico = [...ids].some(esNutraceutico);
  const vig = (vigentePorTratamiento.get(tid) ?? []).filter(esNutraceutico);
  if (emitioNutraceutico && vig.length === 0) conEmisionConNutraSinVigente++;
}
console.log("tratamientos con emisiones que nombran un producto por id: " + [...porTratamientoEmitido.values()].filter((s) => s.size).length);
console.log("tratamientos con un NUTRACEUTICO emitido alguna vez y NINGUNO vigente: " + conEmisionConNutraSinVigente);
console.log("");

// ── 6 · LAS DEMAS SALIDAS QUE YA CIERRAN EL ITEM ──────────────────────────────────────────────────
const conSinPrescripcion = tratamientos.filter((t) => t.sin_prescripcion_motivo != null).length;
const conDecisionNo = tratamientos.filter((t) => t.nutraceutical_decision === "no").length;
const conDecisionPendiente = tratamientos.filter((t) => t.nutraceutical_decision === "pendiente").length;
console.log("═══ 5 · LAS OTRAS SALIDAS QUE CIERRAN EL ITEM ═══");
console.log('"No prescribo nutraceuticos" con motivo (sin_prescripcion_motivo): ' + conSinPrescripcion);
console.log('decision "no" de la pregunta vieja (retirada el 2026-09-26): ' + conDecisionNo);
console.log('decision "pendiente" (no cierra; cambia el texto del aviso): ' + conDecisionPendiente);
