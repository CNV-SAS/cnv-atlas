import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ CNV NO LE FACTURA AL PACIENTE UNA VENTA DE DISTRIBUCION · EL CANDADO DEL RIESGO CENTRAL (0210) ═══
//
// ── QUE PASARIA SIN ESTO, Y POR QUE ES FACIL QUE PASE ──────────────────────────────────────────────
//
// Bajo Distribucion el paciente le paga AL INTEGRANTE y EL le factura con su propia numeracion. Una venta
// registrada bajo esa modalidad nace `paid`, porque ESTA pagada. Y toda la cola de facturacion recoge por
// `status = 'paid'`.
//
// O SEA QUE ENTRARIA SOLA, sin que nadie escriba nada mal, y CNV le emitiria al paciente una factura por un
// producto que YA FACTURO LA INTEGRANTE: dos documentos fiscales por una sola venta, uno de ellos falso. Una
// factura electronica emitida solo se deshace con nota credito.
//
// ── POR QUE CONTRA BASE REAL, Y VIA POR VIA ───────────────────────────────────────────────────────
//
// Esto no lo ve `tsc`, ni el lint, ni un test con la base mockeada: es un `where` que falta. Y se comprueban
// las SEIS vias POR SEPARADO y no una sola vez, porque son seis consultas distintas y la que se olvide es
// justamente la que emite. Que compartan el fragmento `LA_FACTURA_ES_DE_CNV` es el arreglo, no la prueba.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("una venta de Distribucion no entra en la facturacion (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let repo: typeof import("@/modules/payments/data/facturacion-repository");
  let orgId: string;
  let profId: string;
  let patientId: string;
  let nutraId: string;
  const ventas: string[] = [];

  /**
   * Una venta PAGADA y sin documento, sellada con la modalidad que se pida.
   *
   * SIN `alegra_invoice_state`, a proposito: asi cumple `LE_FALTA_ALGO` y es exactamente lo que la cola busca.
   * Si el fixture ya la diera por facturada, el candado pasaria sin probar nada.
   */
  const venta = async (modality: "comision" | "distribucion"): Promise<string> => {
    const [t] = await db.execute(dsql`
      insert into transactions (organization_id, patient_id, professional_id, status, amount, currency,
                                payment_method, wompi_env, idempotency_key)
      values (${orgId}, ${patientId}, ${profId}, 'paid', '119000', 'COP', 'efectivo', 'test',
              ${`fact-${modality}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`})
      returning id`);
    ventas.push(t.id);
    await db.execute(dsql`
      insert into transaction_items (transaction_id, nutraceutical_id, quantity, unit_price, modality)
      values (${t.id}, ${nutraId}, 1, '119000', ${modality})`);
    return t.id;
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    repo = await import("@/modules/payments/data/facturacion-repository");

    const [prof] = await db.execute(dsql`
      select pp.id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by (select count(*) from transactions t where t.professional_id = pp.id), pp.created_at
       limit 1`);
    profId = prof.id;
    orgId = prof.organization_id;

    const [pa] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number)
      values (${orgId}, 'CC', ${`FACT-${Date.now()}`})
      returning id`);
    patientId = pa.id;

    const [n] = await db.execute(dsql`
      select id from nutraceuticals where coalesce(is_test, false) = false order by name limit 1`);
    nutraId = n.id;
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of ventas) {
      await db.execute(dsql`delete from cnv_revenue where transaction_id = ${id}::uuid`);
      await db.execute(dsql`delete from professional_revenue where transaction_id = ${id}::uuid`);
      await db.execute(dsql`delete from transaction_items where transaction_id = ${id}::uuid`);
      await db.execute(dsql`delete from transactions where id = ${id}::uuid`);
    }
    await db.execute(dsql`delete from patients where id = ${patientId}::uuid`);
    await db.execute(dsql`set session_replication_role = default`);
  });

  // ── VIA 1 · LA LISTA QUE VE ADMIN ──
  it("1 · no aparece en la bandeja de ventas sin documento", async () => {
    const dist = await venta("distribucion");
    const com = await venta("comision");
    const lista = await repo.listarVentasSinDocumento(200, null, true);
    const ids = lista.map((v: any) => v.id);
    expect(ids, "una venta de Distribucion aparece como pendiente de facturar").not.toContain(dist);
    // Y LA DE COMISION SI: si el filtro escondiera las dos, el candado pasaria sin probar nada.
    expect(ids, "el filtro se llevo tambien las de Comision").toContain(com);
  });

  // ── VIA 2 · EL BOTON "REINTENTAR", que reclama la venta para facturarla ──
  it("2 · el boton de reintentar no la puede reclamar", async () => {
    const dist = await venta("distribucion");
    expect(await repo.reclamarParaFacturar(dist), "el boton reclamo una venta de Distribucion").toBe(false);
    const com = await venta("comision");
    expect(await repo.reclamarParaFacturar(com), "el boton dejo de reclamar las de Comision").toBe(true);
  });

  // ── VIA 3 · EL BARRIDO AUTOMATICO DE REINTENTOS ──
  //
  // EL TOPE VA ALTO A PROPOSITO, y esto es una correccion a mi primera version. `listarFacturasPendientes`
  // devuelve las 50 mas VIEJAS de la cola; una venta creada por este candado es la mas nueva de todas, asi que
  // con el tope por defecto NO APARECERIA NI CUANDO EL FILTRO LA DEJA PASAR. El caso pasaba trivialmente, que
  // es peor que no tenerlo: afirmaba estar probando un porton que nunca llego a tocar.
  //
  // Con la cola entera, la ausencia de la de Distribucion significa algo, y la presencia de la de Comision
  // demuestra que el filtro no se llevo las dos.
  it("3 · el barrido de reintentos no la toma, y si toma las de Comision", async () => {
    const dist = await venta("distribucion");
    const com = await venta("comision");
    const pendientes = await repo.listarFacturasPendientes(5, 1_000_000);
    const ids = pendientes.map((v: any) => v.id);
    expect(ids, "el barrido automatico tomo una venta de Distribucion").not.toContain(dist);
    expect(ids, "el filtro se llevo tambien las de Comision").toContain(com);
  });

  // ── VIAS 4 Y 5 · LOS DOS CONTEOS, que alimentan el aviso de "faltan documentos" ──
  it("4 y 5 · no cuenta en los contadores de ventas sin documento", async () => {
    const antes = await repo.contarVentasSinDocumento();
    const antesPorDia = await repo.contarVentasSinDocumentoPorDia(1);
    await venta("distribucion");
    const despues = await repo.contarVentasSinDocumento();
    const despuesPorDia = await repo.contarVentasSinDocumentoPorDia(1);
    expect(despues.total - antes.total, "subio el contador de documentos faltantes").toBe(0);
    const suma = (xs: any[]) => xs.reduce((s, x) => s + Number(x.total), 0);
    expect(suma(despuesPorDia) - suma(antesPorDia), "subio el conteo por dia").toBe(0);
  });

  // ── VIA 6 · LA CONFIRMACION MANUAL DE UNA TRANSFERENCIA ──
  //
  // ES LA QUE MAS FACIL SE OLVIDA porque no parece una cola: es la lectura de UNA venta. Pero termina en una
  // factura, asi que sin su filtro una venta de Distribucion confirmada por aqui se facturaria igual, aunque
  // las otras cinco la excluyan.
  it("6 · confirmar una transferencia a mano tampoco la alcanza", async () => {
    const dist = await venta("distribucion");
    expect(
      await repo.getVentaParaConfirmarTransferencia(dist),
      "la confirmacion manual alcanza una venta de Distribucion",
    ).toBeNull();
    const com = await venta("comision");
    expect(
      await repo.getVentaParaConfirmarTransferencia(com),
      "la confirmacion manual dejo de alcanzar las de Comision",
    ).not.toBeNull();
  });

  // ── Y LA OTRA DIRECCION: QUE EL FILTRO NO SE LLEVE LO QUE SI HAY QUE FACTURAR ──
  //
  // Un filtro de mas es tan malo como uno de menos: dejaria ventas de CNV sin su documento fiscal, y eso no
  // avisa nadie hasta que la DIAN pregunta.
  it("y una venta de Comision sigue entrando por las vias que se pueden observar", async () => {
    const com = await venta("comision");
    const lista = await repo.listarVentasSinDocumento(200, null, true);
    expect(lista.map((v: any) => v.id)).toContain(com);
    expect(await repo.getVentaParaConfirmarTransferencia(com)).not.toBeNull();
    expect(await repo.reclamarParaFacturar(com)).toBe(true);
  });


});
