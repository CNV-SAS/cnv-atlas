// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL INVENTARIO DE HOY CONTRA LO QUE CADA INTEGRANTE RECIBIO  ·  SOLO LECTURA
//
// COMO SE CORRE:
//
//   node --env-file=.env.production.local scripts/EL_INVENTARIO_CONTRA_LO_RECIBIDO_2026-11-17.mjs
//
// NO ESCRIBE NADA. Imprime nombres de PRODUCTO, de LOTE y de INTEGRANTE (que no son datos de paciente) y
// cuentas. Ningun nombre ni documento de paciente sale por aqui.
//
// ═══ QUE PREGUNTA RESPONDE ═══
//
// La lista de lo entregado la dio Santiago el 2026-11-17, y su regla es: el inventario de cada Integrante
// se carga con TODO LO QUE RECIBIO, sin descontar las ventas de antes del arranque (que estan marcadas de
// prueba en Atlas y facturadas a mano en Alegra, y que entraran despues por un xlsx como ventas atrasadas).
// Asi que el sistema va a mostrar MAS que el fisico, a proposito y temporalmente.
//
// Para poder cargar eso hay que saber tres cosas, y son las tres mitades de este script:
//
//   1. QUE TIENE EL CATALOGO (precio con IVA, lote, vencimiento, item de Alegra y su ambiente), para
//      cotejarlo contra la lista y contra Alegra;
//   2. QUE SALDO MUESTRA HOY cada ubicacion, y cuanto se aparta de lo recibido;
//   3. SI LAS VENTAS MARCADAS DE PRUEBA MOVIERON UNIDADES. Esta es la que decide si el script de carga
//      puede sumar o tiene que FIJAR: una venta de prueba que descontio deja el saldo por debajo de lo
//      recibido, y sumar la diferencia encima de un saldo contaminado da otra cifra equivocada.
//
// LA MARCA DE PRUEBA NO DEVUELVE UNIDADES, Y ESO YA ESTA ESCRITO EN EL PROYECTO: la 0217 y el arranque del
// 15 de octubre lo dicen con estas palabras, "lo que la marca quita es el AVISO, no el hueco". Aqui se
// MIDE, en vez de suponerlo.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

import { todasLasFilas } from "./lib/todas-las-filas.mjs";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const corto = (id) => String(id ?? "").slice(0, 8);
const num = (n) => Number(n ?? 0).toLocaleString("es-CO");

// ── LO QUE DIJO SANTIAGO EL 2026-11-17 (la fuente, en un solo sitio) ──────────────────────────────
//
// El codigo de Alegra y la referencia van juntos a proposito: antes se creyo que NUT-001 era el codigo, y
// es la REFERENCIA. El codigo es el numero.
const CATALOGO_ESPERADO = [
  { nombre: "MULTI-CELL BASE", referencia: "NUT-001", codigo: "2", pvp: 107100, lote: "19826", vence: "2028-07-18", inicial: 500 },
  { nombre: "OMEGA COMPLEX", referencia: "NUT-002", codigo: "3", pvp: 107100, lote: "20226", vence: "2028-07-22", inicial: 500 },
  { nombre: "CURCUMIN BIOACTIV", referencia: "NUT-003", codigo: "4", pvp: 107100, lote: "20526", vence: "2028-07-25", inicial: 426 },
  { nombre: "D3-K2 OSTEO", referencia: "NUT-004", codigo: "5", pvp: 166600, lote: "19726", vence: "2028-07-17", inicial: 300 },
  { nombre: "LUVIA", referencia: "EXT-001", codigo: "6", pvp: 90000, lote: "04197232", vence: "2028-07-10", inicial: 84 },
];

/** Lo entregado a cada Integrante. El nombre es el que usa Santiago; se cruza por coincidencia parcial. */
const ENTREGADO = {
  Katherine: { "MULTI-CELL BASE": 24, "OMEGA COMPLEX": 24, "CURCUMIN BIOACTIV": 24, "D3-K2 OSTEO": 24 },
  Zoraida: { "MULTI-CELL BASE": 15, "OMEGA COMPLEX": 14, "CURCUMIN BIOACTIV": 14, "D3-K2 OSTEO": 14 },
  "Maria Camila": { "MULTI-CELL BASE": 15, "OMEGA COMPLEX": 15, "CURCUMIN BIOACTIV": 15, "D3-K2 OSTEO": 15, LUVIA: 15 },
  Valentina: { "MULTI-CELL BASE": 15, "OMEGA COMPLEX": 15, "CURCUMIN BIOACTIV": 15, "D3-K2 OSTEO": 15, LUVIA: 10 },
  Angela: { "MULTI-CELL BASE": 31, "OMEGA COMPLEX": 32, "CURCUMIN BIOACTIV": 31, "D3-K2 OSTEO": 23, LUVIA: 11 },
  Camilo: { "MULTI-CELL BASE": 15, "OMEGA COMPLEX": 15, "CURCUMIN BIOACTIV": 15, "D3-K2 OSTEO": 15, LUVIA: 10 },
  Frank: { "MULTI-CELL BASE": 10, "OMEGA COMPLEX": 10, "CURCUMIN BIOACTIV": 10, "D3-K2 OSTEO": 10, LUVIA: 5 },
  // Diana Marcela e inactivos: el arranque le carga SOLO las 3 unidades que vendio (1 OMEGA, 1 CURCUMIN,
  // 1 D3-K2), para que el xlsx de ventas atrasadas las descuente y quede en cero. Roberto: nada.
  "Diana Marcela": { "OMEGA COMPLEX": 1, "CURCUMIN BIOACTIV": 1, "D3-K2 OSTEO": 1 },
  Roberto: {},
};

function quienEs(nombreUbicacion) {
  for (const clave of Object.keys(ENTREGADO)) {
    if (nombreUbicacion.toLowerCase().includes(clave.toLowerCase())) return clave;
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 1 · EL CATALOGO
// ══════════════════════════════════════════════════════════════════════════════════════════════════
const productos = await todasLasFilas(
  sb,
  "nutraceuticals",
  "id, name, unit_price, vat_rate, ownership, commercial_availability, is_test, alegra_item_id, alegra_env, supplier_id",
);

console.log("══ 1 · EL CATALOGO EN LA BASE, CONTRA LA LISTA DEL 17 DE NOVIEMBRE ══\n");
console.log(`productos en el catalogo: ${productos.length} · de prueba: ${productos.filter((p) => p.is_test).length}`);

const lotes = await todasLasFilas(sb, "lots", "id, nutraceutical_id, code, expires_on, received_on");
const lotesDe = new Map();
for (const l of lotes) {
  if (!lotesDe.has(l.nutraceutical_id)) lotesDe.set(l.nutraceutical_id, []);
  lotesDe.get(l.nutraceutical_id).push(l);
}

const porNombre = new Map();
for (const esperado of CATALOGO_ESPERADO) {
  const hallados = productos.filter((p) => p.name.toUpperCase().includes(esperado.nombre.toUpperCase()));
  console.log(`\n── ${esperado.nombre} ── (esperado: ref ${esperado.referencia} · codigo ${esperado.codigo} · PVP ${num(esperado.pvp)} · lote ${esperado.lote} · vence ${esperado.vence})`);
  if (hallados.length === 0) {
    console.log("  ⛔ NO ESTA EN EL CATALOGO");
    continue;
  }
  for (const p of hallados) {
    porNombre.set(esperado.nombre, p);
    const difPrecio = Number(p.unit_price ?? 0) === esperado.pvp ? "=" : `⛔ difiere (base ${num(p.unit_price)})`;
    console.log(`  id ${corto(p.id)} · "${p.name}" · prueba=${p.is_test} · propiedad=${p.ownership ?? "(null)"} · disponibilidad=${p.commercial_availability}`);
    console.log(`     precio base ${num(p.unit_price)} ${difPrecio} · IVA en base ${p.vat_rate ?? "(null)"} · proveedor ${p.supplier_id ? corto(p.supplier_id) : "(null)"}`);
    console.log(`     item de Alegra ${p.alegra_item_id ?? "(sin id)"} · ambiente ${p.alegra_env ?? "(sin ambiente)"}`);
    const suyos = lotesDe.get(p.id) ?? [];
    if (suyos.length === 0) console.log("     ⛔ sin ningun lote registrado");
    for (const l of suyos) {
      const marca = l.code === esperado.lote && l.expires_on === esperado.vence ? "=" : "⛔ difiere";
      console.log(`     lote "${l.code}" vence ${l.expires_on} recibido ${l.received_on ?? "(sin fecha)"} ${marca}`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 2 · EL SALDO DE HOY, UBICACION POR UBICACION
// ══════════════════════════════════════════════════════════════════════════════════════════════════
const ubicaciones = await todasLasFilas(sb, "inventory_locations", "id, name, kind, sellable, professional_id, is_active");
const saldos = await todasLasFilas(sb, "nutraceutical_inventory", "id, location_id, nutraceutical_id, lot_id, stock_quantity");
const nombreDeProducto = new Map(productos.map((p) => [p.id, p.name]));
const codigoDeLote = new Map(lotes.map((l) => [l.id, l.code]));

console.log("\n\n══ 2 · EL SALDO DE HOY CONTRA LO RECIBIDO ══\n");
console.log(`ubicaciones: ${ubicaciones.length} (central ${ubicaciones.filter((u) => u.kind === "central").length} · integrante ${ubicaciones.filter((u) => u.kind === "integrante").length} · cuarentena ${ubicaciones.filter((u) => u.kind === "cuarentena").length})`);

const porUbicacion = new Map();
for (const s of saldos) {
  if (!porUbicacion.has(s.location_id)) porUbicacion.set(s.location_id, []);
  porUbicacion.get(s.location_id).push(s);
}

const totalEnIntegrantes = {};
for (const u of ubicaciones.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))) {
  const filas = (porUbicacion.get(u.id) ?? []).filter((f) => f.stock_quantity !== 0);
  const quien = quienEs(u.name);
  const lista = quien ? ENTREGADO[quien] : null;
  if (filas.length === 0 && !lista) continue;
  console.log(`\n── ${u.name}  [${u.kind}${u.sellable ? "" : " · NO vendible"}${u.is_active ? "" : " · INACTIVA"}]  ${quien ? `(lista: ${quien})` : ""}`);
  const vistos = new Set();
  for (const f of filas.sort((a, b) => (nombreDeProducto.get(a.nutraceutical_id) ?? "").localeCompare(nombreDeProducto.get(b.nutraceutical_id) ?? ""))) {
    const nombre = nombreDeProducto.get(f.nutraceutical_id) ?? corto(f.nutraceutical_id);
    const esperadoCat = CATALOGO_ESPERADO.find((c) => nombre.toUpperCase().includes(c.nombre.toUpperCase()));
    const esperado = lista && esperadoCat ? (lista[esperadoCat.nombre] ?? 0) : null;
    if (esperadoCat) vistos.add(esperadoCat.nombre);
    const dif = esperado == null ? "" : f.stock_quantity === esperado ? " = lo recibido" : ` ⛔ lo recibido son ${esperado} (difiere ${f.stock_quantity - esperado})`;
    console.log(`   ${nombre} · lote "${codigoDeLote.get(f.lot_id) ?? corto(f.lot_id)}" · ${f.stock_quantity}${dif}`);
    if (u.kind === "integrante" && esperadoCat) {
      totalEnIntegrantes[esperadoCat.nombre] = (totalEnIntegrantes[esperadoCat.nombre] ?? 0) + f.stock_quantity;
    }
  }
  if (lista) {
    for (const [nombre, cuantas] of Object.entries(lista)) {
      if (!vistos.has(nombre)) console.log(`   ⛔ FALTA EN EL SISTEMA: ${nombre} · lo recibido son ${cuantas} y no hay fila`);
    }
    if (Object.keys(lista).length === 0 && filas.length > 0) {
      console.log("   ⚠ la lista dice que no le queda nada: todo lo de arriba habria que retirarlo");
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 3 · LA CUENTA DE LA BODEGA
// ══════════════════════════════════════════════════════════════════════════════════════════════════
console.log("\n\n══ 3 · LA BODEGA: LA CUENTA DE SANTIAGO CONTRA EL SISTEMA ══\n");
const central = ubicaciones.filter((u) => u.kind === "central");
console.log("producto            inicial   entregado   esperado en bodega   el sistema dice");
for (const c of CATALOGO_ESPERADO) {
  const entregado = Object.values(ENTREGADO).reduce((s, l) => s + (l[c.nombre] ?? 0), 0);
  const esperadoBodega = c.inicial - entregado;
  const prod = porNombre.get(c.nombre);
  const enSistema = prod
    ? central.reduce(
        (s, u) => s + (porUbicacion.get(u.id) ?? []).filter((f) => f.nutraceutical_id === prod.id).reduce((x, f) => x + f.stock_quantity, 0),
        0,
      )
    : null;
  const marca = enSistema === esperadoBodega ? "=" : `⛔ difiere ${enSistema == null ? "(sin producto)" : enSistema - esperadoBodega}`;
  console.log(
    `${c.nombre.padEnd(20)}${String(c.inicial).padStart(5)}${String(entregado).padStart(12)}${String(esperadoBodega).padStart(21)}${String(enSistema ?? "-").padStart(18)}   ${marca}`,
  );
}
console.log("\nnota: 'entregado' suma TODAS las lineas de la lista, incluidas las 3 de la integrante inactiva.");
console.log("en integrantes, el sistema tiene hoy:", JSON.stringify(totalEnIntegrantes));

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 4 · ¿UNA VENTA MARCADA DE PRUEBA DESCONTIO INVENTARIO?
// ══════════════════════════════════════════════════════════════════════════════════════════════════
console.log("\n\n══ 4 · LAS VENTAS DE PRUEBA Y EL INVENTARIO ══\n");

const ventas = await todasLasFilas(
  sb,
  "transactions",
  "id, status, cuenta_como_de_prueba, marcada_como_prueba_at, operated_at, created_at, professional_id, location_id, wompi_env",
);
console.log(`ventas en total: ${ventas.length}`);
console.log(`  cuentan como de prueba: ${ventas.filter((v) => v.cuenta_como_de_prueba).length}`);
console.log(`  marcadas A MANO: ${ventas.filter((v) => v.marcada_como_prueba_at).length}`);
console.log(`  reales (no de prueba): ${ventas.filter((v) => !v.cuenta_como_de_prueba).length}`);
console.log(`  pagadas: ${ventas.filter((v) => v.status === "paid").length}`);
console.log(`  selladas en ambiente de pruebas (wompi_env=test): ${ventas.filter((v) => v.wompi_env === "test").length}`);

const items = await todasLasFilas(sb, "transaction_items", "id, transaction_id, nutraceutical_id, quantity");
const ventaDelItem = new Map(items.map((i) => [i.id, i.transaction_id]));
const deQuien = new Map(ventas.map((v) => [v.id, v]));

const movs = await todasLasFilas(
  sb,
  "nutraceutical_stock_movements",
  "id, type, delta, nutraceutical_id, location_id, transaction_item_id, created_at",
  (q) => q.eq("type", "venta"),
);
console.log(`\nmovimientos de tipo "venta": ${movs.length}`);

let dePrueba = 0;
let unidadesDePrueba = 0;
const porProductoPrueba = {};
for (const m of movs) {
  const v = deQuien.get(ventaDelItem.get(m.transaction_item_id));
  if (!v?.cuenta_como_de_prueba) continue;
  dePrueba += 1;
  unidadesDePrueba += Math.abs(m.delta);
  const nombre = nombreDeProducto.get(m.nutraceutical_id) ?? corto(m.nutraceutical_id);
  porProductoPrueba[nombre] = (porProductoPrueba[nombre] ?? 0) + Math.abs(m.delta);
}
console.log(`  de ventas que HOY cuentan como de prueba: ${dePrueba} movimientos · ${unidadesDePrueba} unidades`);
console.log(`  por producto: ${JSON.stringify(porProductoPrueba)}`);
console.log(
  dePrueba > 0
    ? "\n⛔ RESPUESTA: SI. Una venta marcada de prueba YA habia descontado, y la marca NO devuelve la unidad.\n   Entonces el script de carga tiene que FIJAR el saldo en lo recibido (conciliacion), no sumar encima."
    : "\n✅ RESPUESTA: NO hay ningun descuento vivo de una venta de prueba.",
);

// ── 5 · LOS MOVIMIENTOS, POR TIPO, para saber que camino uso cada unidad ──
const todosLosMovs = await todasLasFilas(sb, "nutraceutical_stock_movements", "id, type, delta, location_id, nutraceutical_id");
const porTipo = {};
for (const m of todosLosMovs) {
  porTipo[m.type] = porTipo[m.type] ?? { n: 0, suma: 0 };
  porTipo[m.type].n += 1;
  porTipo[m.type].suma += m.delta;
}
console.log("\n\n══ 5 · TODOS LOS MOVIMIENTOS, POR TIPO ══\n");
for (const [t, v] of Object.entries(porTipo).sort()) {
  console.log(`  ${t.padEnd(16)} ${String(v.n).padStart(5)} movimientos · delta neto ${v.suma}`);
}

// ── 6 · INTEGRANTES: QUIEN ESTA ACTIVO, SU MODALIDAD Y SI ES DE PRUEBA ──
const perfiles = await todasLasFilas(sb, "professional_profiles", "id, profile_id, is_test, profession, commission_rate");
const cuentas = await todasLasFilas(sb, "profiles", "id, full_name, status, inactivo_desde, inactivacion_motivo");
const nombreDePerfil = new Map(cuentas.map((c) => [c.id, c]));
const modalidades = await todasLasFilas(sb, "professional_modalities", "id, professional_id, modality, valid_from, valid_to");
const vigente = new Map(modalidades.filter((m) => m.valid_to == null).map((m) => [m.professional_id, m.modality]));

console.log("\n\n══ 6 · LOS INTEGRANTES ══\n");
for (const p of perfiles) {
  const c = nombreDePerfil.get(p.profile_id);
  const ub = ubicaciones.find((u) => u.professional_id === p.id);
  const unidades = ub ? (porUbicacion.get(ub.id) ?? []).reduce((s, f) => s + f.stock_quantity, 0) : 0;
  console.log(
    `  ${corto(p.id)} · ${(c?.full_name ?? "(sin nombre)").padEnd(30)} ${String(c?.status ?? "?").padEnd(9)} prueba=${p.is_test} modalidad=${(vigente.get(p.id) ?? "(ninguna vigente)").padEnd(18)} comision=${p.commission_rate} · ubicacion ${ub ? `"${ub.name}" activa=${ub.is_active} vendible=${ub.sellable}` : "(ninguna)"} · ${unidades} unidades`,
  );
}

// ── 7 · LA FECHA DE ARRANQUE Y LA CONFIGURACION COMERCIAL ──
const { data: cfg } = await sb.from("commercial_config").select("fecha_de_arranque, updated_at").limit(1);
console.log("\n\n══ 7 · LA CONFIGURACION COMERCIAL ══\n");
console.log(`  fecha_de_arranque = ${cfg?.[0]?.fecha_de_arranque ?? "(null)"} · tocada el ${cfg?.[0]?.updated_at ?? "?"}`);
const { data: alegra, error: errAlegra } = await sb.from("alegra_config").select("*").limit(5);
if (errAlegra) console.log(`  alegra_config: ${errAlegra.message}`);
else {
  console.log(`  filas en alegra_config: ${alegra?.length ?? 0}`);
  for (const a of alegra ?? []) {
    // SIN LLAVES NI SECRETOS: solo los campos que dicen EN QUE AMBIENTE esta y si tiene algo puesto.
    const campos = Object.keys(a).filter((k) => !/token|key|secret|password|email/i.test(k));
    console.log(`    ${campos.map((k) => `${k}=${typeof a[k] === "string" && a[k].length > 24 ? "(largo)" : a[k]}`).join(" · ")}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 8 · LA SIMULACION DE LA CARGA AL ARRANQUE  ·  lo que HARIA, por persona y por producto
//
// NO ESCRIBE NADA. Se calcula aqui, leyendo, y no corriendo el script de carga en ensayo: un ensayo con
// `begin ... rollback` SI ejecuta los `insert` contra produccion, y este turno es de solo lectura.
//
// ── POR QUE SE FIJA EL SALDO Y NO SE SUMA LA DIFERENCIA ──
//
// Porque las ventas marcadas de prueba YA descontaron (lo mide el bloque 4) y la marca no devuelve la
// unidad: el libro de movimientos es append-only porque describe algo que PASO. Sumar encima de un saldo
// contaminado da otra cifra equivocada. "El saldo estaba mal y lo que hay es esto" es exactamente lo que
// dice un movimiento de `conciliacion`, asi que el camino existe y no hay que inventarlo.
//
// ── LO QUE NO SE TOCA ──
//
// Las ubicaciones que NO estan en la lista de Santiago (las cuentas de smoke y los integrantes sin entrega)
// se quedan como estan. Llevarlas a cero "porque no aparecen" es justo el riesgo de la bandera
// `llevar_a_cero_lo_no_listado`: una linea olvidada se interpreta como "ahi no hay nada".
// ══════════════════════════════════════════════════════════════════════════════════════════════════
console.log("\n\n══ 8 · SIMULACION DE LA CARGA AL ARRANQUE (no escribe nada) ══\n");

const BODEGA_OBJETIVO = { "MULTI-CELL BASE": 375, "OMEGA COMPLEX": 374, "CURCUMIN BIOACTIV": 301, "D3-K2 OSTEO": 183, LUVIA: 33 };
const loteDe = new Map();
for (const c of CATALOGO_ESPERADO) {
  const prod = porNombre.get(c.nombre);
  const suyos = prod ? (lotesDe.get(prod.id) ?? []) : [];
  const elSuyo = suyos.find((l) => l.code === c.lote) ?? suyos[0];
  loteDe.set(c.nombre, elSuyo ?? null);
}

const plan = [];
for (const u of ubicaciones) {
  if (u.kind === "cuarentena") continue;
  const quien = u.kind === "central" ? "__central__" : quienEs(u.name);
  if (quien == null) continue; // no esta en la lista: no se toca
  const objetivo = quien === "__central__" ? BODEGA_OBJETIVO : ENTREGADO[quien];
  const filas = porUbicacion.get(u.id) ?? [];
  for (const c of CATALOGO_ESPERADO) {
    const prod = porNombre.get(c.nombre);
    if (!prod) continue;
    const fila = filas.find((f) => f.nutraceutical_id === prod.id);
    const sistema = fila?.stock_quantity ?? 0;
    const quiere = objetivo[c.nombre] ?? 0;
    if (sistema === quiere) continue;
    plan.push({ ubicacion: u.name, producto: c.nombre, lote: c.lote, sistema, objetivo: quiere, ajuste: quiere - sistema });
  }
}

console.log("ubicacion                        producto             lote      sistema  objetivo  ajuste");
for (const p of plan.sort((a, b) => a.ubicacion.localeCompare(b.ubicacion) || a.producto.localeCompare(b.producto))) {
  console.log(
    `${p.ubicacion.slice(0, 32).padEnd(33)}${p.producto.padEnd(21)}${p.lote.padEnd(10)}${String(p.sistema).padStart(7)}${String(p.objetivo).padStart(10)}${String(p.ajuste).padStart(8)}`,
  );
}
console.log(`\nlineas que cambiarian: ${plan.length} · suben ${plan.filter((p) => p.ajuste > 0).length} · bajan ${plan.filter((p) => p.ajuste < 0).length}`);
const netoPorProducto = {};
for (const p of plan) netoPorProducto[p.producto] = (netoPorProducto[p.producto] ?? 0) + p.ajuste;
console.log("ajuste NETO por producto (deberia ser lo que las ventas de prueba se llevaron):", JSON.stringify(netoPorProducto));

// ── Y EL BLOQUE (2) DEL SCRIPT DE CARGA, LISTO PARA PEGAR ──
//
// Se imprime desde aqui porque los nombres tienen que ser los EXACTOS de la base (el script empareja por
// nombre y aborta si uno no existe), y teclearlos a mano es como se copia mal una ubicacion.
console.log("\n── el bloque (2) del script de carga, con los nombres exactos de la base ──\n");
console.log("insert into _conteo values");
const lineas = plan.map(
  (p) => `  ('${p.ubicacion.replace(/'/g, "''")}', '${p.producto}', '${p.lote}', ${p.objetivo})`,
);
console.log(lineas.join(",\n") + ";");
