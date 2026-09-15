import postgres from "postgres";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// ADOPTAR UNA FACTURA HUERFANA: EMITIDA EN ALEGRA, SIN ID EN ATLAS  ·  2026-09-14
//
// EL CASO: la emision se corto por tiempo, Alegra SI emitio la factura, y la venta quedo `fallida` sin id de
// factura. Un reintento sin este paso EMITIRIA UNA SEGUNDA factura del mismo pago. Paso con SETP990214715 en
// el smoke del Bloque 3.
//
// Desde el 2026-09-14 la factura lleva la referencia de la venta (`observations`) y el reintento la encuentra
// solo. ESTE SCRIPT ES PARA LAS QUE NO LA LLEVAN (emitidas antes de ese arreglo) o para confirmar a mano cual
// es la venta de una factura concreta.
//
// QUE HACE: lee la factura en Alegra, busca la venta de Atlas que le corresponde y comprueba, una por una:
//   1. AMBIENTE: la venta es del mismo ambiente que la cuenta de Alegra (prueba con sandbox, real con produccion).
//   2. CLIENTE: el documento del cliente de la factura es el del paciente de la venta.
//   3. TOTAL: el total de la factura es lo cobrado.
//   4. FECHA: la fecha de la factura esta a un dia o menos de la fecha de la venta (en Colombia).
//   5. LINEAS: los mismos items de Alegra con las mismas cantidades.
//   6. Que la factura no este ya asociada a otra venta, y que la venta no tenga ya otra factura.
// Si queda EXACTAMENTE una venta que cumple todo, con --commit le guarda el id de la factura. Despues, "Reintentar"
// en /pagos ya no emite: relee esa factura y registra el pago que falta.
//
// COMO SE CORRE (PowerShell, con DATABASE_URL de la nube y las ALEGRA_* del ambiente de la factura):
//   node scripts/adoptar-factura-alegra.mjs --numero SETP990214715     (ensayo: comprueba y no escribe)
//   node scripts/adoptar-factura-alegra.mjs --numero SETP990214715 --commit
//   (o --factura <id interno> en vez de --numero, si se tiene el id)
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const conocidas = new Set(["--factura", "--numero", "--commit"]);
for (const a of args.filter((x) => x.startsWith("-"))) {
  if (!conocidas.has(a)) {
    console.error(`No reconozco ${a}, asi que no corro nada. Banderas: --numero <consecutivo> o --factura <id>, y --commit.`);
    process.exit(1);
  }
}
const valor = (bandera) => {
  const k = args.indexOf(bandera);
  return k >= 0 ? (args[k + 1] ?? null) : null;
};
// EL NUMERO VISIBLE (SETP990214715, FE7) es lo que se ve en la pantalla de Alegra; el id interno no siempre.
const numeroPedido = valor("--numero");
let facturaId = valor("--factura");
const confirmar = args.includes("--commit");
if (!numeroPedido && (!facturaId || !/^\d+$/.test(facturaId))) {
  console.error("Falta --numero <consecutivo de la factura, p. ej. SETP990214715> (o --factura <id interno>).");
  process.exit(1);
}

const { DATABASE_URL, ALEGRA_EMAIL, ALEGRA_API_KEY } = process.env;
const ALEGRA_BASE_URL = (process.env.ALEGRA_BASE_URL ?? "").replace(/\/+$/, "");
if (!DATABASE_URL || !ALEGRA_EMAIL || !ALEGRA_API_KEY || !ALEGRA_BASE_URL) {
  console.error("Faltan DATABASE_URL, ALEGRA_EMAIL, ALEGRA_API_KEY o ALEGRA_BASE_URL en el entorno.");
  process.exit(1);
}
const ambiente = /sandbox/i.test(ALEGRA_BASE_URL) ? "sandbox" : "produccion";
const wompiEnvEsperado = ambiente === "sandbox" ? "test" : "produccion";

const fechaColombia = (d) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const diasEntre = (a, b) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);

const sql = postgres(DATABASE_URL, { max: 1 });
let salida = 0;
try {
  console.log(`Base:    ${new URL(DATABASE_URL).host}`);
  console.log(`Alegra:  ${ALEGRA_BASE_URL} (${ambiente})`);
  console.log(`Modo:    ${confirmar ? "COMMIT (guarda la asociacion)" : "ENSAYO (solo comprueba)"}\n`);

  const auth = "Basic " + Buffer.from(`${ALEGRA_EMAIL}:${ALEGRA_API_KEY}`).toString("base64");
  if (numeroPedido) {
    const r = await fetch(
      `${ALEGRA_BASE_URL}/invoices?numberTemplate_fullNumber=${encodeURIComponent(numeroPedido)}&limit=30`,
      { headers: { Authorization: auth, Accept: "application/json" }, signal: AbortSignal.timeout(30_000) },
    );
    if (!r.ok) throw new Error(`Alegra respondio ${r.status} al buscar la factura ${numeroPedido}.`);
    // Se exige la coincidencia EXACTA del numero, por si el filtro de Alegra fuera parcial.
    const exactas = ((await r.json()) ?? []).filter((x) => x.numberTemplate?.fullNumber === numeroPedido);
    if (exactas.length !== 1) {
      throw new Error(`Se esperaba UNA factura con el numero ${numeroPedido} y hay ${exactas.length}.`);
    }
    facturaId = String(exactas[0].id);
  }
  const res = await fetch(`${ALEGRA_BASE_URL}/invoices/${facturaId}`, {
    headers: { Authorization: auth, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Alegra respondio ${res.status} al leer la factura ${facturaId}.`);
  const f = await res.json();
  const numero = f.numberTemplate?.fullNumber ?? null;
  const itemsFactura = (f.items ?? []).map((it) => ({ id: String(it.id), cantidad: Number(it.quantity) }));
  console.log(`Factura ${facturaId}: ${numero ?? "(sin numero)"} · fecha ${f.date} · total ${f.total} · estado ${f.status} · saldo ${f.balance}`);
  console.log(`  cliente: documento ${f.client?.identification} · items: ${itemsFactura.map((x) => `${x.id} x${x.cantidad}`).join(", ")}`);
  if (f.status === "void" || f.status === "draft" || !numero) {
    throw new Error(`La factura ${facturaId} esta "${f.status}" o sin numero: no es una factura emitida que adoptar.`);
  }
  const referencia = typeof f.observations === "string" ? f.observations.match(/Atlas venta ([0-9a-f-]{36})/i)?.[1] : null;
  if (referencia) console.log(`  lleva la referencia de la venta ${referencia}`);

  const [yaAsociada] = await sql`
    select id from transactions where alegra_invoice_id = ${String(facturaId)} and alegra_env = ${ambiente}`;
  if (yaAsociada) throw new Error(`La factura ya esta asociada a la venta ${yaAsociada.id}. No se toca.`);

  const candidatas = await sql`
    select t.id, t.amount, t.created_at, t.wompi_env, t.alegra_env, t.alegra_invoice_state, p.document_number
      from transactions t
      join patients p on p.id = t.patient_id
     where t.status = 'paid'
       and t.alegra_invoice_id is null
       and (${referencia ?? null}::uuid is null or t.id = ${referencia ?? null}::uuid)
       and p.document_number = ${String(f.client?.identification ?? "")}`;

  const cumplen = [];
  for (const v of candidatas) {
    // El item del AMBIENTE de la factura (0144): cada ambiente tiene el suyo.
    const lineas = await sql`
      select ai.item_id as alegra_item_id, ai.env as alegra_env, ti.quantity
        from transaction_items ti
        left join alegra_items ai on ai.nutraceutical_id = ti.nutraceutical_id and ai.env = ${ambiente}
       where ti.transaction_id = ${v.id}`;
    const clave = (xs) => xs.map((x) => `${x.id}:${x.cantidad}`).sort().join("|");
    const fechaVenta = fechaColombia(new Date(v.created_at));
    const checks = [
      ["ambiente", v.wompi_env === wompiEnvEsperado && (v.alegra_env === null || v.alegra_env === ambiente),
        `venta ${v.wompi_env}/${v.alegra_env ?? "-"}, Alegra ${ambiente}`],
      ["cliente", v.document_number === String(f.client?.identification), `documento ${v.document_number}`],
      ["total", Math.round(Number(v.amount)) === Math.round(Number(f.total)), `cobrado ${v.amount}, factura ${f.total}`],
      ["fecha", Math.abs(diasEntre(f.date, fechaVenta)) <= 1, `venta ${fechaVenta}, factura ${f.date}`],
      ["lineas",
        lineas.every((l) => l.alegra_env === ambiente) &&
          clave(lineas.map((l) => ({ id: String(l.alegra_item_id), cantidad: Number(l.quantity) }))) === clave(itemsFactura),
        `venta ${lineas.map((l) => `${l.alegra_item_id} x${l.quantity}`).join(", ")}`],
      ["estado", ["fallida", "pendiente"].includes(v.alegra_invoice_state ?? ""), `factura en Atlas: ${v.alegra_invoice_state}`],
    ];
    const ok = checks.every(([, bien]) => bien);
    console.log(`\nVenta ${v.id} (${fechaVenta}, ${v.amount}):`);
    for (const [nombre, bien, detalle] of checks) console.log(`  ${bien ? "ok " : "[X]"} ${nombre.padEnd(9)} ${detalle}`);
    if (ok) cumplen.push(v);
  }

  console.log("");
  if (cumplen.length === 0) throw new Error("Ninguna venta cumple las comprobaciones. No se adopta nada.");
  if (cumplen.length > 1) {
    throw new Error(`${cumplen.length} ventas cumplen las comprobaciones (${cumplen.map((v) => v.id).join(", ")}). No se adopta ninguna: se decide a mano.`);
  }
  const venta = cumplen[0];
  console.log(`UNA venta cumple todo: ${venta.id}.`);

  if (!confirmar) {
    console.log("ENSAYO: no se escribio nada. Para asociarla, el mismo comando con --commit.");
  } else {
    const cufe = f.stamp?.cufe ?? null;
    const filas = await sql`
      update transactions set
        alegra_invoice_id     = ${String(facturaId)},
        alegra_env            = ${ambiente},
        alegra_invoice_number = ${numero},
        alegra_cufe           = ${cufe},
        alegra_legal_status   = ${f.stamp?.legalStatus ?? null},
        alegra_invoice_state  = ${cufe ? "emitida" : "emitida_sin_sellar"},
        alegra_last_error     = ${`Factura ${numero} adoptada a mano desde Alegra (no se emitio otra). Falta registrar el pago: pulsa Reintentar.`},
        updated_at            = now()
      where id = ${venta.id} and alegra_invoice_id is null
      returning id`;
    if (filas.length !== 1) throw new Error("La venta cambio mientras se comprobaba. No se escribio nada.");
    console.log(`CONFIRMADO: la venta ${venta.id} queda con la factura ${numero}.`);
    console.log('Siguiente paso: "Reintentar" en /pagos. Relee la factura y registra el pago; no emite otra.');
  }
} catch (e) {
  console.error(`\nABORTADO: ${e?.message ?? e}`);
  salida = 1;
} finally {
  await sql.end();
}
// exitCode y no exit(): con exit() inmediato, Node en Windows puede abortar mientras cierra las conexiones.
process.exitCode = salida;
