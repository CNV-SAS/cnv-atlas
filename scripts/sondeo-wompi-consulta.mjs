// ══════════════════════════════════════════════════════════════════════════════════════════════════
// SONDEO DE LA CONSULTA DE TRANSACCIONES DE WOMPI  ·  Bloque 3b, sesion 3  ·  v3, 2026-09-16
//
// POR QUE EXISTE: el cotejo (recuperar los pagos aprobados que a Atlas no le llegaron) necesita preguntarle a
// Wompi por sus transacciones, y ESE LISTADO NO ESTA DOCUMENTADO. La documentacion publica solo describe el
// listado de dispersiones, que es otro producto. Asi que la forma del cotejo se descubre probando, no leyendo.
//
// POR QUE ESTA VERSION SE CORRIGE SOLA (Santiago, 2026-09-16): las v1 y v2 gastaron una vuelta cada una para
// descubrir un parametro obligatorio. El 422 de Wompi SI nombra varios a la vez (la v1 recibio from_date,
// until_date y page juntos), pero valida por capas: `page_size` no aparecio hasta que `page` estuvo presente. Con
// un listado no documentado eso puede repetirse, asi que aqui el sondeo LEE el error, agrega el parametro que le
// falta y reintenta, hasta cinco veces. Si aparece uno que no sabe rellenar, para y lo dice por su nombre.
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
const errorDe = (r) => (r.cuerpo?.error ? JSON.stringify(r.cuerpo.error.messages ?? r.cuerpo.error) : (r.error ?? r.crudo));
const consulta = (p) => Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");

const hasta = new Date();
const desde = new Date(hasta.getTime() - DIAS * 86_400_000);

// Lo que el sondeo sabe rellenar si Wompi lo pide. Si pide algo que no esta aqui, para y lo nombra.
const VALORES = {
  from_date: desde.toISOString(),
  until_date: hasta.toISOString(),
  page: "1",
  page_size: "200",
  limit: "200",
  offset: "0",
  order_by: "created_at",
  order: "desc",
  status: "APPROVED",
};

/** Pide el listado agregando los parametros que el 422 vaya reclamando. Devuelve la primera respuesta buena. */
async function listadoQueSeCorrigeSolo(iniciales) {
  const params = { ...iniciales };
  for (let intento = 1; intento <= 5; intento++) {
    const r = await pedir(`/transactions?${consulta(params)}`);
    console.log(`   Intento ${intento} con [${Object.keys(params).join(", ")}]: HTTP ${r.status} en ${r.ms} ms`);
    if (r.ok) return { r, params };
    const mensajes = r.cuerpo?.error?.messages;
    if (r.status !== 422 || !mensajes) {
      console.log(`   No es un problema de parametros: ${errorDe(r)}`);
      return { r: null, params };
    }
    const faltantes = Object.entries(mensajes)
      .filter(([, ms]) => (Array.isArray(ms) ? ms : [ms]).some((m) => String(m).toLowerCase().includes("no está presente") || String(m).toLowerCase().includes("no esta presente")))
      .map(([k]) => k)
      .filter((k) => !(k in params));
    const otros = Object.keys(mensajes).filter((k) => !faltantes.includes(k) && k in params);
    if (otros.length > 0) console.log(`   Wompi objeta lo que ya se mando: ${JSON.stringify(mensajes)}`);
    if (faltantes.length === 0) {
      console.log(`   Sin parametros nuevos que agregar. Error: ${errorDe(r)}`);
      return { r: null, params };
    }
    const desconocidos = faltantes.filter((k) => !(k in VALORES));
    if (desconocidos.length > 0) {
      console.log(`   PIDE ALGO QUE NO SE RELLENAR: ${desconocidos.join(", ")}. Pasame esta linea y lo agrego.`);
      return { r: null, params };
    }
    for (const k of faltantes) params[k] = VALORES[k];
    console.log(`   Agrega: ${faltantes.join(", ")}`);
  }
  console.log("   Cinco intentos sin lograrlo.");
  return { r: null, params };
}

// ── 1. EL LISTADO, y de paso que formato de fecha acepta ──────────────────────────────────────────
console.log("── 1. GET /transactions (el listado que no esta documentado) ──");
const { r: primera, params: PARAMS } = await listadoQueSeCorrigeSolo({
  from_date: VALORES.from_date,
  until_date: VALORES.until_date,
  page: "1",
  page_size: "200",
});

if (!primera) {
  console.log("\n   El listado no respondio. Pasame la salida tal cual.\n");
  process.exit(0);
}

const filas = filasDe(primera.cuerpo) ?? [];
console.log(`   ✔ Sirve con: ${Object.keys(PARAMS).join(", ")} (fecha en formato ISO con hora)`);
console.log(`   Filas: ${filas.length} de un tope de ${PARAMS.page_size ?? "?"} por pagina`);
console.log(`   Claves de una fila: ${Object.keys(filas[0] ?? {}).join(", ") || "(ninguna)"}`);
console.log(`   Meta: ${JSON.stringify(primera.cuerpo?.meta ?? null)}`);
const conFecha = filas.filter((f) => f.created_at);
if (conFecha.length > 1) {
  const nuevaPrimero = conFecha[0].created_at > conFecha[conFecha.length - 1].created_at;
  console.log(`   Orden: ${nuevaPrimero ? "de la mas NUEVA a la mas vieja" : "de la mas VIEJA a la mas nueva"} (${conFecha[0].created_at} ... ${conFecha[conFecha.length - 1].created_at})`);
}
const estados = {};
for (const f of filas) estados[f.status] = (estados[f.status] ?? 0) + 1;
console.log(`   Estados: ${JSON.stringify(estados)}`);

// Y si el formato corto tambien sirve, el cotejo puede usar el mas simple.
const corto = await pedir(`/transactions?${consulta({ ...PARAMS, from_date: desde.toISOString().slice(0, 10), until_date: hasta.toISOString().slice(0, 10) })}`);
console.log(`   Fecha sin hora (AAAA-MM-DD): HTTP ${corto.status}${corto.ok ? " · tambien sirve" : ` · ${errorDe(corto)}`}`);

// ── 2. LA PAGINACION: que el numero de pagina se respete ──────────────────────────────────────────
console.log("\n── 2. La paginacion ───────────────────────────────────────────");
const pag2 = await pedir(`/transactions?${consulta({ ...PARAMS, page: "2" })}`);
const filas2 = filasDe(pag2.cuerpo) ?? [];
console.log(`   Pagina 2: HTTP ${pag2.status}, ${filas2.length} filas${pag2.ok ? "" : ` · ${errorDe(pag2)}`}`);
if (filas2.length > 0) {
  const repetidas = filas2.filter((b) => filas.some((a) => a.id === b.id)).length;
  console.log(`   Repetidas de la pagina 1: ${repetidas}${repetidas === filas2.length ? " · OJO: el numero de pagina se ignora" : ""}`);
} else if (filas.length > 0 && filas.length < Number(PARAMS.page_size ?? 200)) {
  console.log("   Vacia, y es lo correcto: todo cupo en la pagina 1.");
}

// ── 3. EL FILTRO POR REFERENCIA ───────────────────────────────────────────────────────────────────
console.log("\n── 3. ¿Sirve ?reference= ? ───────────────────────────────────");
const referencia = filas.find((f) => f.reference)?.reference ?? null;
if (!referencia) {
  console.log("   Sin una referencia de la que partir (no hubo filas). Haz un pago de prueba y vuelve a correrlo.");
} else {
  console.log(`   Referencia usada: ${referencia}`);
  const r = await pedir(`/transactions?${consulta({ ...PARAMS, reference: referencia })}`);
  const f3 = filasDe(r.cuerpo) ?? [];
  console.log(`   HTTP ${r.status} en ${r.ms} ms; filas devueltas: ${f3.length} (sin filtrar eran ${filas.length})`);
  if (f3.length > 0) {
    const coinciden = f3.filter((f) => f.reference === referencia).length;
    console.log(`   De esas, con la referencia pedida: ${coinciden}`);
    console.log(
      coinciden === f3.length && f3.length < filas.length
        ? "   ✔ EL FILTRO SIRVE: el cotejo pregunta venta por venta."
        : "   ✘ EL FILTRO NO SIRVE (devuelve de mas): el cotejo recorre el rango y compara en Atlas.",
    );
  } else {
    console.log(`   ${r.ok ? "Devolvio vacio: no sirve como filtro." : errorDe(r)}`);
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
