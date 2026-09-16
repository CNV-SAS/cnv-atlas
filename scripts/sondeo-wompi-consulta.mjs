// ══════════════════════════════════════════════════════════════════════════════════════════════════
// SONDEO DE LA CONSULTA DE TRANSACCIONES DE WOMPI  ·  Bloque 3b, sesion 3  ·  v2, 2026-09-16
//
// POR QUE EXISTE: el cotejo (recuperar los pagos aprobados que a Atlas no le llegaron) necesita preguntarle a
// Wompi por sus transacciones. La documentacion confirma que eso va con la llave PRIVADA y que hay un listado
// paginado, pero NO documenta el filtro por referencia, y hay reportes de que no filtra. De eso depende la forma
// del cotejo, asi que se convierte en dato antes de construir.
//
// QUE APRENDIO LA v1 (Santiago, 2026-09-16): el listado EXISTE y exige tres parametros, que la v1 no mandaba:
//   {"from_date":["No esta presente"],"until_date":["No esta presente"],"page":["No esta presente", ...]}
// El tope de `page` en 10000 dice ademas que la paginacion es por NUMERO, no por cursor. Esta version los manda,
// prueba dos formatos de fecha, mide cuantas filas caben por pagina y recien entonces prueba el filtro.
//
// QUE HACE, Y QUE NO: SOLO LEE (GET). No crea, no anula y no toca la base de Atlas. Imprime la FORMA de la
// respuesta (claves, cuantas filas, si el filtro filtro de verdad), nunca los datos de nadie: ni nombres, ni
// correos, ni numeros de tarjeta. Las referencias que imprime son los identificadores de venta de Atlas.
//
// COMO SE CORRE (PowerShell), con la llave de SANDBOX:
//   $env:WOMPI_PRIVATE_KEY = "prv_test_..."
//   node scripts/sondeo-wompi-consulta.mjs
//
// Y AL TERMINAR:  Remove-Item Env:WOMPI_PRIVATE_KEY
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const LLAVE = process.env.WOMPI_PRIVATE_KEY;
const TIMEOUT_MS = 15_000;
const DIAS = 30;

if (!LLAVE) {
  console.error("Falta WOMPI_PRIVATE_KEY. Ponla en el shell (ver la cabecera de este archivo).");
  process.exit(1);
}
if (!LLAVE.startsWith("prv_")) {
  console.error("Esa no es una llave privada (empieza por prv_). La publica NO sirve para consultar.");
  process.exit(1);
}

const ES_SANDBOX = LLAVE.startsWith("prv_test_");
const BASE = ES_SANDBOX ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1";

console.log(`\nAmbiente: ${ES_SANDBOX ? "SANDBOX" : "PRODUCCION"}  (${BASE})`);
if (!ES_SANDBOX) console.log("OJO: es la llave de produccion. Solo lee, pero lo esperado aqui es la de sandbox.");
console.log(`Rango consultado: los ultimos ${DIAS} dias.\n`);

async function pedir(ruta) {
  const inicio = Date.now();
  try {
    const res = await fetch(`${BASE}${ruta}`, {
      headers: { Authorization: `Bearer ${LLAVE}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const texto = await res.text();
    let cuerpo = null;
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      // Respuesta que no es JSON: se informa el principio, sin volcar la pagina entera.
    }
    return { ok: res.ok, status: res.status, ms: Date.now() - inicio, cuerpo, crudo: texto.slice(0, 300) };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - inicio, error: e instanceof Error ? e.message : String(e) };
  }
}

const filasDe = (c) => (Array.isArray(c?.data) ? c.data : Array.isArray(c) ? c : null);
const errorDe = (r) => (r.cuerpo?.error ? JSON.stringify(r.cuerpo.error.messages ?? r.cuerpo.error) : r.crudo);

const hasta = new Date();
const desde = new Date(hasta.getTime() - DIAS * 86_400_000);
// Dos formatos, porque la documentacion no dice cual: el primero que responda 200 es el que usa el cotejo.
const FORMATOS = [
  { nombre: "fecha y hora ISO", desde: desde.toISOString(), hasta: hasta.toISOString() },
  { nombre: "solo fecha (AAAA-MM-DD)", desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) },
];

// ── 1. EL LISTADO, con los tres parametros que exige ──────────────────────────────────────────────
console.log("── 1. GET /transactions?from_date=&until_date=&page= ──────────");
let formatoBueno = null;
let primeraPagina = null;
for (const f of FORMATOS) {
  const r = await pedir(`/transactions?from_date=${encodeURIComponent(f.desde)}&until_date=${encodeURIComponent(f.hasta)}&page=1`);
  console.log(`   ${f.nombre}: HTTP ${r.status} en ${r.ms} ms${r.ok ? "" : ` · ${errorDe(r)}`}`);
  if (r.ok && !formatoBueno) {
    formatoBueno = f;
    primeraPagina = r;
  }
}

if (!formatoBueno) {
  console.log("\n   NINGUN FORMATO SIRVIO. Pasame las dos lineas de arriba tal cual y ajusto el sondeo.\n");
  process.exit(0);
}

const rango = `from_date=${encodeURIComponent(formatoBueno.desde)}&until_date=${encodeURIComponent(formatoBueno.hasta)}`;
console.log(`   ✔ El cotejo usara: ${formatoBueno.nombre}.`);

const filas = filasDe(primeraPagina.cuerpo) ?? [];
console.log(`   Filas en la pagina 1: ${filas.length}`);
console.log(`   Claves de una fila: ${Object.keys(filas[0] ?? {}).join(", ") || "(ninguna)"}`);
console.log(`   Meta: ${JSON.stringify(primeraPagina.cuerpo?.meta ?? null)}`);
if (filas.length > 1) {
  const conFecha = filas.filter((f) => f.created_at);
  if (conFecha.length > 1) {
    const nuevaPrimero = conFecha[0].created_at > conFecha[conFecha.length - 1].created_at;
    console.log(`   Orden: ${nuevaPrimero ? "de la mas NUEVA a la mas vieja" : "de la mas VIEJA a la mas nueva"} (${conFecha[0].created_at} ... ${conFecha[conFecha.length - 1].created_at})`);
  }
}
const estados = {};
for (const f of filas) estados[f.status] = (estados[f.status] ?? 0) + 1;
console.log(`   Estados: ${JSON.stringify(estados)}`);

// ── 2. CUANTO CABE POR PAGINA: decide si el cotejo diario es una llamada o veinte ─────────────────
console.log("\n── 2. El tamano de pagina ─────────────────────────────────────");
const pagina2 = await pedir(`/transactions?${rango}&page=2`);
const filas2 = filasDe(pagina2.cuerpo) ?? [];
console.log(`   Pagina 2: HTTP ${pagina2.status}, ${filas2.length} filas${pagina2.ok ? "" : ` · ${errorDe(pagina2)}`}`);
const repetidas = filas2.filter((b) => filas.some((a) => a.id === b.id)).length;
if (filas2.length > 0) console.log(`   Filas de la pagina 2 que ya estaban en la 1: ${repetidas} (si son todas, el numero de pagina se ignora)`);
console.log(
  filas.length === 0
    ? "   El sandbox no tiene transacciones en el rango: el tamano de pagina queda por medir con datos."
    : `   Por ahora, ${filas.length} por pagina. Con eso, un cotejo diario en produccion serian pocas llamadas.`,
);

// ── 3. EL FILTRO POR REFERENCIA: filtra de verdad, o devuelve de mas ──────────────────────────────
console.log("\n── 3. ¿Sirve ?reference= ? (lo que la documentacion NO confirma) ──");
const referencia = filas.find((f) => f.reference)?.reference ?? null;
if (!referencia) {
  console.log("   Sin una referencia de la que partir (no hubo filas). Haz un pago de prueba y vuelve a correrlo.");
} else {
  console.log(`   Referencia usada: ${referencia}`);
  const r = await pedir(`/transactions?${rango}&page=1&reference=${encodeURIComponent(referencia)}`);
  const f3 = filasDe(r.cuerpo) ?? [];
  console.log(`   HTTP ${r.status} en ${r.ms} ms; filas devueltas: ${f3.length}`);
  const coinciden = f3.filter((f) => f.reference === referencia).length;
  if (f3.length > 0) {
    console.log(`   De esas, con la referencia pedida: ${coinciden}`);
    console.log(
      coinciden === f3.length && f3.length < filas.length
        ? "   ✔ EL FILTRO SIRVE: el cotejo pregunta venta por venta."
        : "   ✘ EL FILTRO NO SIRVE (devuelve de mas): el cotejo recorre el rango y compara en Atlas.",
    );
  } else {
    console.log(`   ${r.ok ? "Devolvio vacio: el parametro no sirve como filtro." : errorDe(r)}`);
  }
}

// ── 4. UNA TRANSACCION POR SU ID ──────────────────────────────────────────────────────────────────
console.log("\n── 4. GET /transactions/{id} ──────────────────────────────────");
const unId = filas[0]?.id ?? null;
if (!unId) {
  console.log("   Sin un id del que partir.");
} else {
  const r = await pedir(`/transactions/${encodeURIComponent(unId)}`);
  const d = r.cuerpo?.data ?? r.cuerpo;
  console.log(`   HTTP ${r.status} en ${r.ms} ms`);
  if (d?.status) {
    console.log(`   status=${d.status}, reference=${d.reference}, amount_in_cents=${d.amount_in_cents}, payment_method_type=${d.payment_method_type}`);
    console.log(`   created_at=${d.created_at}; finalized_at presente: ${d.finalized_at !== undefined}; status_message presente: ${d.status_message !== undefined}`);
  } else {
    console.log(`   ${errorDe(r)}`);
  }
}

console.log("\nListo. Pasame esta salida tal cual.\n");
