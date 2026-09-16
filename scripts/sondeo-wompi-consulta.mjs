// ══════════════════════════════════════════════════════════════════════════════════════════════════
// SONDEO DE LA CONSULTA DE TRANSACCIONES DE WOMPI  ·  Bloque 3b, sesion 3  ·  2026-09-16
//
// POR QUE EXISTE: el cotejo (recuperar los pagos aprobados que a Atlas no le llegaron) necesita preguntarle a
// Wompi por sus transacciones. La documentacion confirma que eso va con la llave PRIVADA y que existe un listado
// paginado, pero NO documenta el filtro por referencia, y hay reportes de que no filtra. Construir sobre una
// suposicion ahi seria construir a ciegas: este sondeo la convierte en dato.
//
// QUE HACE, Y QUE NO: SOLO LEE (tres GET). No crea, no anula y no toca la base de Atlas. Imprime la FORMA de la
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
if (!ES_SANDBOX) {
  console.log("OJO: es la llave de produccion. Solo lee, pero lo esperado aqui es la de sandbox.\n");
}

async function pedir(ruta) {
  const url = `${BASE}${ruta}`;
  const inicio = Date.now();
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${LLAVE}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const ms = Date.now() - inicio;
    const texto = await res.text();
    let cuerpo = null;
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      // Respuesta que no es JSON: se informa el principio, sin volcar la pagina entera.
    }
    return { ok: res.ok, status: res.status, ms, cuerpo, crudo: texto.slice(0, 200) };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - inicio, error: e instanceof Error ? e.message : String(e) };
  }
}

const filasDe = (cuerpo) => (Array.isArray(cuerpo?.data) ? cuerpo.data : Array.isArray(cuerpo) ? cuerpo : null);

// ── 1. EL LISTADO: existe, y con que forma ─────────────────────────────────────────────────────────
console.log("── 1. GET /transactions (listado) ─────────────────────────────");
const listado = await pedir("/transactions");
console.log(`   HTTP ${listado.status} en ${listado.ms} ms`);
if (listado.error) console.log(`   ERROR: ${listado.error}`);

let referenciaDePrueba = null;
const filas = filasDe(listado.cuerpo);
if (filas) {
  console.log(`   Filas en la primera pagina: ${filas.length}`);
  console.log(`   Claves de una fila: ${Object.keys(filas[0] ?? {}).join(", ") || "(ninguna)"}`);
  console.log(`   Meta de paginacion: ${JSON.stringify(listado.cuerpo?.meta ?? null)}`);
  const conFecha = filas.filter((f) => f.created_at);
  if (conFecha.length > 1) {
    const orden = conFecha[0].created_at > conFecha[conFecha.length - 1].created_at ? "de la mas NUEVA a la mas vieja" : "de la mas VIEJA a la mas nueva";
    console.log(`   Orden por fecha: ${orden} (${conFecha[0].created_at} ... ${conFecha[conFecha.length - 1].created_at})`);
  }
  const estados = {};
  for (const f of filas) estados[f.status] = (estados[f.status] ?? 0) + 1;
  console.log(`   Estados: ${JSON.stringify(estados)}`);
  referenciaDePrueba = filas.find((f) => f.reference)?.reference ?? null;
} else {
  console.log(`   Sin arreglo de datos. Respuesta: ${listado.crudo}`);
}

// ── 2. EL FILTRO POR REFERENCIA: filtra de verdad, o devuelve todo ────────────────────────────────
console.log("\n── 2. GET /transactions?reference=... (el filtro que la documentacion NO confirma) ──");
if (!referenciaDePrueba) {
  console.log("   Sin una referencia de la que partir (el listado vino vacio). Paso 2 omitido.");
} else {
  console.log(`   Referencia usada: ${referenciaDePrueba}`);
  const filtrado = await pedir(`/transactions?reference=${encodeURIComponent(referenciaDePrueba)}`);
  console.log(`   HTTP ${filtrado.status} en ${filtrado.ms} ms`);
  const f2 = filasDe(filtrado.cuerpo);
  if (f2) {
    const coinciden = f2.filter((f) => f.reference === referenciaDePrueba).length;
    console.log(`   Filas devueltas: ${f2.length}; de esas, con la referencia pedida: ${coinciden}`);
    console.log(
      f2.length > 0 && coinciden === f2.length
        ? "   ✔ EL FILTRO SIRVE: el cotejo puede preguntar venta por venta."
        : "   ✘ EL FILTRO NO SIRVE (devuelve de mas): el cotejo tiene que recorrer el listado y comparar aqui.",
    );
  } else {
    console.log(`   Sin arreglo de datos. Respuesta: ${filtrado.crudo}`);
  }
}

// ── 3. UNA TRANSACCION POR SU ID ──────────────────────────────────────────────────────────────────
console.log("\n── 3. GET /transactions/{id} (una sola) ───────────────────────");
const unId = filas?.[0]?.id ?? null;
if (!unId) {
  console.log("   Sin un id del que partir. Paso 3 omitido.");
} else {
  const una = await pedir(`/transactions/${encodeURIComponent(unId)}`);
  console.log(`   HTTP ${una.status} en ${una.ms} ms`);
  const d = una.cuerpo?.data ?? una.cuerpo;
  if (d) {
    console.log(`   Campos utiles: status=${d.status}, reference=${d.reference}, amount_in_cents=${d.amount_in_cents}, payment_method_type=${d.payment_method_type}, created_at=${d.created_at}`);
    console.log(`   finalized_at presente: ${d.finalized_at !== undefined}; status_message presente: ${d.status_message !== undefined}`);
  } else {
    console.log(`   Respuesta: ${una.crudo}`);
  }
}

console.log("\nListo. Pasame esta salida tal cual: con eso se construye el cotejo sobre lo que Wompi hace de verdad.\n");
