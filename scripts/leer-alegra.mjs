import postgres from "postgres";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LEE UNA CUENTA DE ALEGRA Y LISTA LOS IDS QUE NECESITA `alegra_config`. SOLO LECTURA.  ·  Bloque 2b
//
// Para que sirve: el paso a produccion es insertar la fila de produccion de `alegra_config` y mapear los
// cinco productos. Esos ids se leen de la cuenta real, no se transcriben de un correo ni de una captura.
// Este script los pone en pantalla, agrupados como los pide `scripts/config-alegra-produccion.sql`.
//
// ── POR QUE NO PUEDE ESCRIBIR ───────────────────────────────────────────────────────────────────
//
// La unica funcion que habla con Alegra hace GET y nada mas; no hay forma de pasarle otro metodo. Se corre
// contra la cuenta de PRODUCCION de CNV, donde un POST equivocado es un documento fiscal.
//
// ── DE DONDE SALEN LAS CREDENCIALES ─────────────────────────────────────────────────────────────
//
// Del entorno. Las de produccion van en un archivo APARTE (`.env.produccion.local`, ignorado por git), no
// en `.env.local`: si entraran en `.env.local`, `pnpm dev` y los tests locales hablarian con la cuenta real.
//
// USO:
//   node --env-file=.env.produccion.local scripts/leer-alegra.mjs
//   node --env-file=.env.local            scripts/leer-alegra.mjs     (el sandbox, para comparar la forma)
//
// Si el entorno trae DATABASE_URL, tambien lee el catalogo de Atlas (un SELECT) y pone al lado de cada
// item de Alegra el producto de Atlas que le corresponde por nombre y si el precio coincide. Es una AYUDA
// para leer, no una decision: el id lo copia una persona, y el cotejo posterior lo comprueba.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const email = process.env.ALEGRA_EMAIL;
const apiKey = process.env.ALEGRA_API_KEY;
const base = (process.env.ALEGRA_BASE_URL ?? "").replace(/\/+$/, "");
if (!email || !apiKey || !base) {
  console.error("Faltan ALEGRA_EMAIL, ALEGRA_API_KEY o ALEGRA_BASE_URL en el entorno.");
  console.error("Uso: node --env-file=.env.produccion.local scripts/leer-alegra.mjs");
  process.exit(1);
}
const ambiente = /sandbox/i.test(base) ? "sandbox" : "produccion";
const auth = "Basic " + Buffer.from(`${email}:${apiKey}`).toString("base64");

async function leer(ruta) {
  const r = await fetch(`${base}${ruta}`, {
    method: "GET",
    headers: { Authorization: auth, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  const texto = await r.text();
  if (r.status === 401) throw new Error(`Alegra respondio 401: las credenciales no son de ${base}.`);
  if (!r.ok) throw new Error(`Alegra ${ruta}: ${r.status} ${texto.slice(0, 200)}`);
  const json = JSON.parse(texto);
  return Array.isArray(json) ? json : (json.data ?? json);
}

// Alegra devuelve como maximo 30 por consulta (lo dice con un 400). Una cuenta con mas de 30 items
// escondia justo los que no caben, y "no tiene item" seria una negacion sobre una lista incompleta.
async function leerTodo(ruta) {
  const todo = [];
  for (let start = 0; ; start += 30) {
    const sep = ruta.includes("?") ? "&" : "?";
    const pagina = await leer(`${ruta}${sep}limit=30&start=${start}`);
    todo.push(...pagina);
    if (pagina.length < 30) return todo;
  }
}

// Mismo criterio que el cotejo: ignora guiones y espacios al emparejar nombres.
const normal = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const avisos = [];
const titulo = (t) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 90 - t.length))}`);

try {
  console.log(`Alegra:   ${base}`);
  console.log(`Ambiente: ${ambiente.toUpperCase()}${ambiente === "produccion" ? "   (cuenta REAL de CNV; este script solo lee)" : ""}`);

  const empresa = await leer("/company");
  console.log(`Empresa:  ${empresa.name ?? "-"}  ·  NIT ${empresa.identification ?? "-"}`);

  // ── 1. NUMERACIONES ─────────────────────────────────────────────────────────────────────────
  const plantillas = await leer("/number-templates");
  const hoy = new Date().toISOString().slice(0, 10);

  titulo("NUMERACIONES DE FACTURA  ->  invoice_template_id");
  const facturas = plantillas.filter((t) => t.documentType === "invoice");
  for (const t of facturas) {
    const electronica = t.isElectronic ? "ELECTRONICA" : "no electronica";
    const vence = t.endDate ?? "-";
    const quedan =
      t.maxInvoiceNumber != null && t.nextInvoiceNumber != null
        ? Number(t.maxInvoiceNumber) - Number(t.nextInvoiceNumber) + 1
        : null;
    console.log(
      `  id ${String(t.id).padEnd(4)} ${String(t.name).padEnd(28)} prefijo ${String(t.prefix ?? "-").padEnd(6)} ` +
        `${electronica.padEnd(15)} ${t.status}  siguiente ${t.nextInvoiceNumber ?? "-"}  ` +
        `rango ${t.minInvoiceNumber ?? "-"}..${t.maxInvoiceNumber ?? "-"}  vence ${vence}  resolucion ${t.resolutionNumber || "-"}`,
    );
    // Lo que se comprueba es lo que dejaria a Atlas sin poder emitir a mitad del dia: vencida o sin rango.
    if (t.isElectronic && t.status === "active") {
      if (t.endDate && t.endDate < hoy) avisos.push(`La numeracion ${t.id} (${t.prefix}) VENCIO el ${t.endDate}.`);
      if (quedan !== null && quedan <= 0) avisos.push(`La numeracion ${t.id} (${t.prefix}) NO TIENE RANGO disponible.`);
      else if (quedan !== null && quedan < 50) avisos.push(`A la numeracion ${t.id} (${t.prefix}) le quedan ${quedan} numeros.`);
    }
  }
  if (!facturas.some((t) => t.isElectronic && t.status === "active")) {
    avisos.push("No hay ninguna numeracion de FACTURA electronica activa: Atlas no podria emitir.");
  }

  titulo("NUMERACIONES DE NOTA CREDITO  ->  credit_note_template_id");
  const notas = plantillas.filter((t) => t.documentType === "creditNote");
  for (const t of notas) {
    console.log(
      `  id ${String(t.id).padEnd(4)} ${String(t.name).padEnd(28)} prefijo ${String(t.prefix ?? "-").padEnd(6)} ` +
        `${(t.isElectronic ? "ELECTRONICA" : "no electronica").padEnd(15)} ${t.status}  siguiente ${t.nextInvoiceNumber ?? "-"}`,
    );
  }
  if (!notas.some((t) => t.isElectronic && t.status === "active")) {
    avisos.push("No hay numeracion de NOTA CREDITO electronica activa: la reversa no se podria emitir.");
  }

  // Los ultimos documentos emitidos, SOLO numero y fecha (sin cliente): confirma desde donde continua Atlas.
  titulo("ULTIMOS DOCUMENTOS EMITIDOS (para saber desde que numero sigue Atlas)");
  const ultimasFacturas = await leer("/invoices?limit=5&order_direction=DESC");
  for (const f of ultimasFacturas) {
    console.log(`  factura      ${String(f.numberTemplate?.fullNumber ?? "(sin numero)").padEnd(16)} ${f.date}  estado ${f.status}`);
  }
  const ultimasNotas = await leer("/credit-notes?limit=3&order_direction=DESC");
  for (const n of ultimasNotas) {
    console.log(`  nota credito ${String(n.numberTemplate?.fullNumber ?? "(sin numero)").padEnd(16)} ${n.date}  estado ${n.status}`);
  }

  // ── 2. IMPUESTOS ────────────────────────────────────────────────────────────────────────────
  titulo("IMPUESTOS  ->  iva_tax_id (el de IVA al 19%)");
  const impuestos = await leer("/taxes");
  for (const t of impuestos) {
    console.log(`  id ${String(t.id).padEnd(4)} ${String(t.name).padEnd(20)} ${String(t.percentage).padStart(6)}%  tipo ${t.type}  ${t.status}`);
  }
  const iva19 = impuestos.filter((t) => t.type === "IVA" && Number(t.percentage) === 19 && t.status === "active");
  if (iva19.length === 0) avisos.push("No hay un impuesto IVA al 19% activo.");
  if (iva19.length > 1) avisos.push(`Hay ${iva19.length} impuestos IVA al 19% activos (${iva19.map((t) => t.id).join(", ")}): confirmar cual usan los items.`);

  // ── 3. CENTROS DE COSTO ─────────────────────────────────────────────────────────────────────
  titulo("CENTROS DE COSTO  ->  cost_center_propio_id / cost_center_tercero_id");
  const centros = await leerTodo("/cost-centers");
  for (const c of centros) {
    console.log(`  id ${String(c.id).padEnd(4)} ${String(c.code ?? "-").padEnd(10)} ${String(c.name).padEnd(28)} ${c.status}  ${c.description ?? ""}`);
  }
  if (centros.length < 2) avisos.push("Hacen falta DOS centros de costo (producto propio y producto de tercero).");

  // ── 4. CUENTAS ──────────────────────────────────────────────────────────────────────────────
  titulo("CUENTAS  ->  bank_account_efectivo_id / bank_account_pasarela_id (las PUENTE, nunca tipo bank)");
  const cuentas = await leerTodo("/bank-accounts");
  for (const c of cuentas) {
    const marca = c.type === "bank" ? "  <- BANCO: no sirve como puente" : "";
    console.log(`  id ${String(c.id).padEnd(4)} ${String(c.name).padEnd(36)} tipo ${String(c.type).padEnd(12)} ${c.status}${marca}`);
  }
  if (!cuentas.some((c) => /efectivo/i.test(c.name) && c.type !== "bank")) avisos.push('No se ve la cuenta puente "Efectivo en poder de Integrantes".');
  if (!cuentas.some((c) => /wompi/i.test(c.name) && c.type !== "bank")) avisos.push('No se ve la cuenta puente "Wompi por liquidar".');

  // ── 5. ITEMS, con el catalogo de Atlas al lado si hay base ─────────────────────────────────
  titulo("ITEMS  ->  el mapeo de los cinco productos");
  const items = await leerTodo("/items");
  let catalogo = [];
  if (process.env.DATABASE_URL) {
    const sql = postgres(process.env.DATABASE_URL, { max: 1 });
    try {
      catalogo = await sql`
        select name, unit_price, vat_rate, ownership
          from nutraceuticals
         where not is_test
           -- Solo lo que SE VENDE. Los "no disponible" no llegan a una factura, y avisar por ellos
           -- enterraria entre ruido el aviso de un producto vendible sin item.
           and commercial_availability <> 'no_disponible'
         order by name`;
      console.log(`  (catalogo de Atlas leido de ${new URL(process.env.DATABASE_URL).host})`);
    } finally {
      await sql.end();
    }
  } else {
    console.log("  (sin DATABASE_URL: no se compara contra el catalogo de Atlas)");
  }

  for (const i of items) {
    const principal = Array.isArray(i.price) ? (i.price.find((p) => p.main) ?? i.price[0]) : null;
    const baseAlegra = principal ? Number(principal.price) : null;
    const tax = (i.tax ?? []).map((t) => `${t.id}(${t.percentage}%)`).join(",") || "SIN IMPUESTO";
    let alLado = "";
    const producto = catalogo.find((p) => normal(p.name) === normal(i.name));
    if (producto) {
      const tarifa = Number(producto.vat_rate ?? 0.19);
      const baseAtlas = Math.round(Number(producto.unit_price) / (1 + tarifa));
      alLado = `  = Atlas "${producto.name}" (${producto.ownership}) base ${baseAtlas} ${baseAtlas === baseAlegra ? "precio ok" : "PRECIO DISTINTO"}`;
    }
    console.log(
      `  id ${String(i.id).padEnd(4)} ${String(i.name).padEnd(22)} ref ${String(i.reference ?? "-").padEnd(8)} ` +
        `base ${String(baseAlegra ?? "-").padStart(7)}  impuesto ${tax.padEnd(10)} ${i.status}${alLado}`,
    );
    if ((i.tax ?? []).length === 0 && producto) avisos.push(`El item ${i.id} (${i.name}) NO TIENE IMPUESTO: facturaria al 0%.`);
  }
  for (const p of catalogo) {
    const coincidencias = items.filter((i) => normal(i.name) === normal(p.name));
    if (coincidencias.length === 0) avisos.push(`El producto de Atlas "${p.name}" no tiene item con su nombre en Alegra.`);
    if (coincidencias.length > 1) {
      avisos.push(`El producto de Atlas "${p.name}" tiene ${coincidencias.length} items con su nombre (${coincidencias.map((i) => i.id).join(", ")}): elegir uno a proposito.`);
    }
  }

  titulo("AVISOS");
  if (avisos.length === 0) console.log("  Ninguno.");
  for (const a of avisos) console.log(`  [!] ${a}`);
  console.log("\nNada se escribio. Los ids se copian a scripts/config-alegra-produccion.sql.");
} catch (e) {
  console.error("\nFALLO:", e?.message ?? e);
  process.exitCode = 1;
}
