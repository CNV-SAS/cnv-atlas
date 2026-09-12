import { sql as dsql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

// ═══ EL MAPA DE ALEGRA CUADRA CON EL CATALOGO DE ATLAS ═══
//
// POR QUE ESTO NECESITA CANDADO. Son dos catalogos que nadie obliga a coincidir: el de Atlas, que decide
// que se le cobra al paciente, y el de Alegra, que decide que dice la factura. Si divergen, **nada falla**:
// la venta se cobra bien, la factura se emite bien, y dicen cosas distintas. Un error que cuadra en el
// total es la peor forma de estar mal, porque no hay sintoma.
//
// LOS DOS MODOS DE FALLO CONCRETOS que esto vigila:
//
//   · DOS PRODUCTOS APUNTANDO AL MISMO ITEM. La factura sale con el producto equivocado y el total cuadra.
//     Hay un indice unico que lo impide; el test comprueba que el indice sigue ahi, porque un indice se
//     puede borrar en una migracion futura sin que nadie note lo que protegia.
//   · EL PRECIO DE LOS DOS LADOS DEJA DE COINCIDIR. El item de Alegra guarda la base sin IVA y Atlas
//     guarda el PVP con IVA. Los dos se teclearon a mano, por personas distintas, en dias distintos.
//
// SE MIDE CONTRA BD REAL porque el mapa ES datos: vive en `alegra_config` y en `nutraceuticals`, no en
// codigo, y esa fue la decision (nada de identificadores en el codigo, para que 2b sea insertar una fila).

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

// Lo que se leyo del sandbox por API el 2026-09-12. Si Santiago reconfigura Alegra, este test se pone
// rojo y eso es lo correcto: el mapa de la base tiene que volver a leerse, no adivinarse.
const BASES_SANDBOX: Record<string, number> = {
  "MULTICELL BASE": 90000, // NUT-001, item 5
  "OMEGA COMPLEX": 90000, // NUT-002, item 6
  "CURCUMIN BIOACTIV": 90000, // NUT-003, item 2
  "D3-K2 OSTEO": 140000, // NUT-004, item 3
  LUVIA: 75630, // EXT-001, item 4
};

describe.skipIf(!HAS_DB)("el mapa de Alegra (BD real)", () => {
  it("hay configuración de sandbox, con su numeración y su IVA", async () => {
    const { db } = await import("@/db");
    const [c] = await db.execute<{
      invoice_template_id: string;
      iva_tax_id: string;
      cost_center_propio_id: string;
      cost_center_tercero_id: string;
    }>(dsql`select invoice_template_id, iva_tax_id, cost_center_propio_id, cost_center_tercero_id
              from alegra_config where env = 'sandbox'`);
    expect(c, "no hay fila de sandbox en alegra_config").toBeDefined();
    // La 16 es la ELECTRONICA (prefijo SETP). La 1 tambien es de facturas y NO es electronica: elegirla
    // emitiria un documento sin CUFE, que no es factura electronica aunque lleve numero.
    expect(c.invoice_template_id).toBe("16");
    // El 4 es IVA 19%. El 1 es Exento y el 2 Excluido, los dos al 0%: confundirlos saca la factura sin
    // IVA y NADA falla. Ya hay una factura emitida asi en el sandbox, de 140.000 con IVA 0.
    expect(c.iva_tax_id).toBe("4");
    expect(c.cost_center_propio_id).not.toBe(c.cost_center_tercero_id);
  });

  it("la nota crédito usa la numeración ELECTRÓNICA, no la que no lo es", async () => {
    // El sandbox tiene DOS numeraciones de nota crédito: la 2, que no es electrónica, y la 17 (NTC), que
    // sí. La factura que emitimos es electrónica, así que una nota crédito no electrónica contra ella no
    // es lo que la DIAN espera. Elegir la 2 no falla: emite un documento que no corresponde.
    const { db } = await import("@/db");
    const [c] = await db.execute<{ credit_note_template_id: string | null }>(dsql`
      select credit_note_template_id from alegra_config where env = 'sandbox'`);
    expect(c.credit_note_template_id).toBe("17");
  });

  it("y las dos cuentas del pago son PUENTE y distintas entre sí", async () => {
    // Cuando Atlas registra el pago la plata no ha llegado al banco: está en el bolsillo del Integrante o
    // retenida en Wompi. Que sean distintas es lo que permite las dos conciliaciones independientes; que
    // ninguna sea el banco es lo que hace que Bancolombia siga cuadrando contra su extracto.
    const { db } = await import("@/db");
    const [c] = await db.execute<{ efectivo: string; pasarela: string }>(dsql`
      select bank_account_efectivo_id as efectivo, bank_account_pasarela_id as pasarela
        from alegra_config where env = 'sandbox'`);
    expect(c.efectivo).toBe("5");
    expect(c.pasarela).toBe("6");
    expect(c.efectivo, "el efectivo y la pasarela caen en la misma cuenta: se pierde la conciliación").not.toBe(c.pasarela);
  });

  it("ningún item de Alegra está repetido entre productos", async () => {
    const { db } = await import("@/db");
    const filas = await db.execute<{ alegra_item_id: string; n: number }>(dsql`
      select alegra_item_id, count(*)::int as n
        from nutraceuticals
       where alegra_item_id is not null
       group by alegra_item_id, alegra_env
      having count(*) > 1`);
    expect(
      filas.map((f) => f.alegra_item_id),
      "dos productos comparten item: la factura saldría con el producto equivocado y cuadraría en total",
    ).toEqual([]);
  });

  it("y el índice único que lo impide sigue existiendo", async () => {
    // El test de arriba mide el estado; este mide la GARANTIA. Sin el indice, el estado puede ser correcto
    // hoy y dejar de serlo con el siguiente UPDATE, sin que nada avise.
    const { db } = await import("@/db");
    const [r] = await db.execute<{ existe: boolean }>(dsql`
      select exists (
        select 1 from pg_indexes
         where tablename = 'nutraceuticals' and indexname = 'nutraceuticals_alegra_item_unico_idx'
      ) as existe`);
    expect(r?.existe).toBe(true);
  });

  it("el precio BASE de Atlas coincide con el del item en Alegra, producto por producto", async () => {
    // Los dos se teclearon a mano, por personas distintas, en dias distintos. Que coincidan no es
    // automatico: es lo que hay que comprobar.
    const { db } = await import("@/db");
    const filas = await db.execute<{ name: string; unit_price: string; vat_rate: string | null }>(dsql`
      select name, unit_price, vat_rate from nutraceuticals where alegra_item_id is not null`);
    expect(filas.length).toBe(Object.keys(BASES_SANDBOX).length);

    const desajustes: string[] = [];
    for (const f of filas) {
      const esperado = BASES_SANDBOX[f.name];
      expect(esperado, `producto mapeado que el test no conoce: ${f.name}`).toBeDefined();
      // Se redondea igual que en el checkout: la base es el PVP entre (1 + tarifa).
      const base = Math.round(Number(f.unit_price) / (1 + Number(f.vat_rate ?? 0.19)));
      if (base !== esperado) desajustes.push(`${f.name}: Atlas ${base} vs Alegra ${esperado}`);
    }
    expect(
      desajustes,
      `el precio de los dos catálogos dejó de coincidir:\n  ${desajustes.join("\n  ")}`,
    ).toEqual([]);
  });

  it("y LUVIA es el único de TERCERO, que es lo que decide su centro de costo", async () => {
    // El centro de costo no sale del item sino de la propiedad del producto, y es lo que permite medir
    // rentabilidad por linea. Con LUVIA clasificada como propia, su margen entraria al de Vitacellebis.
    const { db } = await import("@/db");
    const filas = await db.execute<{ name: string }>(dsql`
      select name from nutraceuticals where ownership = 'tercero'`);
    expect(filas.map((f) => f.name)).toEqual(["LUVIA"]);
  });
});
