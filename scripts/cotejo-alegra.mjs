import postgres from "postgres";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COTEJA EL CATALOGO DE ATLAS CONTRA EL DE ALEGRA. SOLO LECTURA.
//
// ── POR QUE EXISTE, Y POR QUE EL CANDADO DE VITEST NO BASTA ─────────────────────────────────────
//
// `src/tests/mapa-alegra.test.ts` compara el catalogo de Atlas contra una tabla de precios ESCRITA EN EL
// TEST. Eso protege contra que Atlas cambie, y es real. Pero esa tabla es una TERCERA transcripcion a
// mano del mismo dato: si Alegra cambia, el test sigue verde y los dos sistemas ya no dicen lo mismo.
// Un candado que compara contra una copia no puede ver que el original se movio.
//
// Un test unitario no debe llamar a una API externa (credenciales, red, intermitencia), asi que la
// comprobacion contra la fuente de verdad vive aqui: un script que se corre A PROPOSITO.
//
// CUANDO CORRERLO, y esto no es opcional en el segundo caso:
//   · cuando alguien toque un precio, en cualquiera de los dos lados;
//   · SIEMPRE antes del paso a produccion (Bloque 2b). Es lo que impide estrenar produccion con un mapa
//     de sandbox o con precios que dejaron de coincidir.
//
// ── LA FUENTE DE VERDAD ES LA BASE SIN IVA ─────────────────────────────────────────────────────
//
// No el PVP. Tres razones y ninguna es de gusto: es lo que Alegra guarda en el item, es sobre lo que se
// calcula TODO el reparto (principio 1 del modelo), y es la unica de las dos que no depende de una
// politica de redondeo. El PVP se DERIVA: base + IVA redondeado al peso.
//
// USO:
//   node --env-file=.env.local scripts/cotejo-alegra.mjs
//   (contra la nube: exportar su DATABASE_URL y correrlo sin --env-file; las credenciales de Alegra
//    salen del entorno igual, asi que se coteja el ambiente que digan ALEGRA_BASE_URL y el mapa)
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const IVA_RATE = 0.19;
const alPeso = (n) => Math.round(n);
const baseDe = (pvp, tarifa) => alPeso(pvp / (1 + tarifa));
const pvpDe = (base, tarifa) => alPeso(base) + alPeso(alPeso(base) * tarifa);

const url = process.env.DATABASE_URL;
const email = process.env.ALEGRA_EMAIL;
const apiKey = process.env.ALEGRA_API_KEY;
const alegraBase = (process.env.ALEGRA_BASE_URL ?? "https://api.alegra.com/api/v1").replace(/\/+$/, "");
if (!url || !email || !apiKey) {
  console.error("Faltan DATABASE_URL, ALEGRA_EMAIL o ALEGRA_API_KEY.");
  process.exit(1);
}

const auth = "Basic " + Buffer.from(`${email}:${apiKey}`).toString("base64");
async function alegra(ruta) {
  const r = await fetch(`${alegraBase}${ruta}`, {
    headers: { Authorization: auth, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Alegra ${ruta}: ${r.status} ${texto.slice(0, 200)}`);
  return JSON.parse(texto);
}

const sql = postgres(url, { max: 1 });
let problemas = 0;
const pega = (linea) => {
  problemas++;
  console.log(`  [X] ${linea}`);
};

try {
  console.log(`Base de datos: ${new URL(url).host}`);
  console.log(`Alegra:        ${alegraBase}`);
  console.log("");

  const [cfg] = await sql`
    select env, invoice_template_id, credit_note_template_id, iva_tax_id,
           cost_center_propio_id, cost_center_tercero_id,
           bank_account_efectivo_id, bank_account_pasarela_id
      from alegra_config
     order by env`;
  if (!cfg) {
    console.log("  [X] No hay ninguna fila en alegra_config.");
    process.exit(1);
  }
  console.log(`Ambiente configurado: ${cfg.env}\n`);

  // ── 1. LOS PRECIOS, que es lo que este script viene a mirar ──────────────────────────────────
  const items = await alegra("/items?limit=30");
  const porId = new Map(items.map((i) => [String(i.id), i]));
  const productos = await sql`
    select name, unit_price, vat_rate, alegra_item_id, alegra_env, ownership
      from nutraceuticals
     where alegra_item_id is not null
     order by name`;

  console.log(`── PRECIOS (${productos.length} productos mapeados) ──`);
  for (const p of productos) {
    const item = porId.get(String(p.alegra_item_id));
    if (!item) {
      pega(`${p.name}: apunta al item ${p.alegra_item_id} y ese item NO EXISTE en este ambiente de Alegra.`);
      continue;
    }
    if (p.alegra_env !== cfg.env) {
      pega(`${p.name}: su item es del ambiente "${p.alegra_env}" y se esta cotejando "${cfg.env}".`);
    }

    const tarifa = Number(p.vat_rate ?? IVA_RATE);
    const baseAtlas = baseDe(Number(p.unit_price), tarifa);
    const precios = item.price ?? [];
    const principal = Array.isArray(precios) ? (precios.find((x) => x.main) ?? precios[0]) : null;
    const baseAlegra = principal ? Number(principal.price) : null;

    if (baseAlegra === null) {
      pega(`${p.name}: el item ${item.id} no tiene precio en Alegra.`);
      continue;
    }
    const ok = baseAtlas === baseAlegra;
    const pvpReconstruido = pvpDe(baseAlegra, tarifa);
    const pvpOk = pvpReconstruido === Number(p.unit_price);

    console.log(
      `  ${ok && pvpOk ? "ok " : "[X]"} ${String(p.name).padEnd(20)} item ${String(item.id).padEnd(3)} ` +
        `base Atlas ${String(baseAtlas).padStart(7)} | Alegra ${String(baseAlegra).padStart(7)} ` +
        `| PVP ${String(p.unit_price).padStart(7)} vs reconstruido ${String(pvpReconstruido).padStart(7)}`,
    );
    if (!ok) problemas++;
    // El PVP se DERIVA de la base: si al reconstruirlo no vuelve al que Atlas cobra, el paciente pagaria
    // una cifra y la factura diria otra. Es el descuadre que nadie sabe explicar despues.
    else if (!pvpOk) problemas++;

    // El IMPUESTO del item. Sin el, Alegra factura al 0% y nada falla: la factura sale validada por la
    // DIAN, solo que sin IVA, y eso en produccion es IVA que CNV asume de su margen.
    const impuestos = item.tax ?? [];
    if (impuestos.length === 0) pega(`${p.name}: el item ${item.id} NO TIENE IMPUESTO configurado.`);
    else if (!impuestos.some((t) => String(t.id) === String(cfg.iva_tax_id))) {
      pega(
        `${p.name}: el item ${item.id} lleva el impuesto ${impuestos.map((t) => `${t.id} (${t.percentage}%)`).join(", ")}, ` +
          `y el mapa dice que el IVA es el ${cfg.iva_tax_id}.`,
      );
    }
    // `productKey` es el codigo estandar del bien o servicio. Sin el, la DIAN acepta CON OBSERVACION
    // (regla FAZ09), y una observacion que se repite factura a factura ensucia el historial.
    if (!item.productKey) {
      console.log(`      aviso: sin productKey (la DIAN acepta con observacion FAZ09)`);
    }
  }

  // ── 2. QUE EL MAPA APUNTE A COSAS QUE EXISTEN ────────────────────────────────────────────────
  console.log("\n── EL MAPA ──");
  const plantillas = await alegra("/number-templates");
  const porPlantilla = new Map(plantillas.map((t) => [String(t.id), t]));
  const factura = porPlantilla.get(String(cfg.invoice_template_id));
  if (!factura) pega(`la numeracion de factura ${cfg.invoice_template_id} no existe.`);
  else {
    console.log(`  ok  factura: ${factura.name} (prefijo ${factura.prefix ?? "-"}), electronica: ${factura.isElectronic}`);
    if (!factura.isElectronic) pega("la numeracion de factura NO es electronica: no habria CUFE.");
  }
  if (cfg.credit_note_template_id) {
    const nc = porPlantilla.get(String(cfg.credit_note_template_id));
    if (!nc) pega(`la numeracion de nota credito ${cfg.credit_note_template_id} no existe.`);
    else {
      console.log(`  ok  nota credito: ${nc.name} (prefijo ${nc.prefix ?? "-"}), electronica: ${nc.isElectronic}`);
      // Una nota credito no electronica contra una factura electronica no es lo que la DIAN espera.
      if (factura?.isElectronic && !nc.isElectronic) {
        pega("la nota credito NO es electronica y la factura SI: no se corresponden.");
      }
    }
  } else {
    console.log("  --  nota credito: sin configurar (la reversa no se puede emitir).");
  }

  const centros = await alegra("/cost-centers?limit=30");
  const porCentro = new Map((Array.isArray(centros) ? centros : (centros.data ?? [])).map((c) => [String(c.id), c]));
  for (const [rotulo, id] of [["propio", cfg.cost_center_propio_id], ["tercero", cfg.cost_center_tercero_id]]) {
    const c = porCentro.get(String(id));
    if (!c) pega(`el centro de costo de ${rotulo} (${id}) no existe.`);
    else console.log(`  ok  centro ${rotulo}: ${c.name} / ${c.code ?? "-"}`);
  }

  const cuentas = await alegra("/bank-accounts?limit=30");
  const porCuenta = new Map((Array.isArray(cuentas) ? cuentas : (cuentas.data ?? [])).map((c) => [String(c.id), c]));
  for (const [rotulo, id] of [["efectivo", cfg.bank_account_efectivo_id], ["pasarela", cfg.bank_account_pasarela_id]]) {
    const c = porCuenta.get(String(id));
    if (!c) pega(`la cuenta de ${rotulo} (${id}) no existe.`);
    else {
      console.log(`  ok  cuenta ${rotulo}: ${c.name} (tipo ${c.type})`);
      // Las dos son PUENTE: la plata no ha llegado al banco cuando Atlas registra el pago. Una cuenta de
      // tipo `bank` aqui diria que si llego, y el banco dejaria de cuadrar contra su extracto.
      if (c.type === "bank") pega(`la cuenta de ${rotulo} es un BANCO, y tiene que ser una cuenta puente.`);
    }
  }

  console.log("");
  if (problemas === 0) console.log("COTEJO LIMPIO: los dos catalogos dicen lo mismo.");
  else console.log(`COTEJO CON ${problemas} PROBLEMA(S). No pasar a produccion asi.`);
  process.exitCode = problemas === 0 ? 0 : 1;
} catch (e) {
  console.error("\nFALLO:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
