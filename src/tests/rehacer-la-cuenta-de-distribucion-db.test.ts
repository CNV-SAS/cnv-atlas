import { sql as dsql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ UNA CUENTA DE DISTRIBUCION SE PUEDE REHACER (0215) ═══
//
// EL DEFECTO: Santiago emitio la cuenta del corte, registro otra venta y al emitir otra vez salio "No se
// pudo emitir la cuenta" con `duplicate key` contra `distribucion_statements_una_viva_por_corte`.
//
// ── Y LO QUE SALIO AL BUSCARLO: EL MECANISMO ESTABA DISEÑADO Y SIN CABLEAR ────────────────────────
//
// La 0188 escribio el indice parcial y el comentario que lo explica ("un corte re-emitido tras una objecion
// tiene dos filas, y solo una sigue viva"), pero NINGUNA ruta del codigo escribia `replaced_by_id`. O sea
// que el PASO 6 DE LA PARTE 10 DEL SMOKE (objetar y "darle la razon y rehacerla") iba a reventar igual, y
// no se corrio porque el smoke se topo antes con el paso 4. El camino que el modelo EXIGE era inalcanzable.
//
// ── POR QUE CONTRA LA BASE REAL ───────────────────────────────────────────────────────────────────
//
// Porque lo que puede salir mal no es una rama que no se tomo: es el ORDEN de las escrituras contra un
// indice unico parcial y un trigger de inmutabilidad. Las cinco cosas que solo se ven mirando las filas:
//
//   1. que rehacer la cuenta deje UNA sola viva del corte (el `duplicate key` del smoke);
//   2. que la nueva lleve el corte COMPLETO, no solo la venta que llego despues: dos cuentas parciales del
//      mismo periodo serian dos documentos fiscales por un solo corte;
//   3. que la vieja quede con su RASTRO y apuntando a la nueva, no borrada;
//   4. que el camino de la objecion corregida (el paso 6) llegue hasta el final;
//   5. y que una cuenta PAGADA no se reemplace, porque la plata ya se movio. Ahi se dice una frase, que es
//      lo que admin necesita para decidir, en vez de reventar contra la base.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("rehacer la cuenta de Distribucion (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let writer: any;
  let profId: string;
  let actorId: string;
  let orgId: string;
  const nutraId = "77777777-7777-7777-7777-777777777702";
  const ventas: string[] = [];
  const cuentas: string[] = [];
  // Dentro de la primera quincena de septiembre, y el corte YA CERRO: la emision pide corte cerrado.
  const DIA = "2026-09-10";
  const CORTE_HASTA = "2026-09-15";

  async function venta(dia = DIA): Promise<string> {
    const [t] = await db.execute(dsql`
      insert into transactions (organization_id, professional_id, status, amount, currency, payment_method,
                                wompi_env, operated_at, idempotency_key)
      values (${orgId}, ${profId}, 'paid', '119000', 'COP', 'efectivo', 'test', ${`${dia}T15:00:00Z`}::timestamptz,
              ${`test-rehacer-${Date.now()}-${Math.random().toString(36).slice(2)}`})
      returning id`);
    ventas.push(t.id);
    await db.execute(dsql`
      insert into transaction_items (transaction_id, nutraceutical_id, quantity, unit_price, modality,
                                     vat_rate, commission_rate, supplier_share,
                                     base_amount, commission_amount, supplier_amount, cnv_amount, sealed_at)
      values (${t.id}, ${nutraId}, 1, '119000', 'distribucion',
              '0.19', '0.20', '0', '100000', '20000', '0', '80000', now())`);
    return t.id;
  }

  async function emitir() {
    const r = await writer.emitirCuenta({
      professionalId: profId,
      dia: DIA,
      actorId,
      actorEmail: null,
      ip: null,
    });
    cuentas.push(r.statementId);
    return r;
  }

  const fila = async (id: string) => {
    const [f] = await db.execute(dsql`
      select replaced_by_id, superseded_at, superseded_reason, paid_at
        from distribucion_statements where id = ${id}`);
    return f;
  };

  const vivasDelCorte = async (): Promise<number> => {
    const [f] = await db.execute(dsql`
      select count(*)::int as n from distribucion_statements
       where professional_id = ${profId} and corte_hasta = ${CORTE_HASTA}::date
         and superseded_at is null`);
    return f.n;
  };

  const ventasDe = async (statementId: string): Promise<number> => {
    const [f] = await db.execute(dsql`
      select count(*)::int as n from transactions where distribucion_statement_id = ${statementId}`);
    return f.n;
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    writer = await import("@/modules/payments/data/distribucion-writer");
    const [prof] = await db.execute(dsql`
      select pp.id, pp.profile_id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by pp.created_at limit 1`);
    profId = prof.id;
    actorId = prof.profile_id;
    orgId = prof.organization_id;
  }, 30_000);

  afterEach(async () => {
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of ventas) {
      await db.execute(dsql`delete from transaction_items where transaction_id = ${id}`);
      await db.execute(dsql`delete from transactions where id = ${id}`);
    }
    // En orden inverso: una cuenta reemplazada apunta a la que la reemplazo.
    for (const id of [...cuentas].reverse()) {
      await db.execute(dsql`update distribucion_statements set replaced_by_id = null where id = ${id}`);
    }
    for (const id of cuentas) {
      await db.execute(dsql`delete from clinical_audit_log where entity_id = ${id}`);
      await db.execute(dsql`delete from distribucion_statements where id = ${id}`);
    }
    ventas.length = 0;
    cuentas.length = 0;
    await db.execute(dsql`set session_replication_role = default`);
  });

  // EL DEFECTO DEL SMOKE, exactamente como ocurrio: emitir, vender otra vez, emitir.
  it("una venta registrada DESPUES de emitir se factura rehaciendo la cuenta, y no revienta", async () => {
    await venta();
    const primera = await emitir();
    expect(await ventasDe(primera.statementId)).toBe(1);

    await venta();
    const segunda = await emitir();

    expect(segunda.reemplazoA, "la nueva dice a cual reemplazo").toBe(primera.statementId);
    expect(
      segunda.ventas,
      "LA NUEVA LLEVA EL CORTE COMPLETO, no solo la venta que llego despues: dos cuentas parciales del " +
        "mismo periodo serian dos documentos fiscales por un solo corte",
    ).toBe(2);
    expect(await ventasDe(segunda.statementId)).toBe(2);
    expect(await ventasDe(primera.statementId), "la vieja se queda sin lineas: volvieron al pozo").toBe(0);
    expect(await vivasDelCorte(), "UNA sola cuenta viva por corte, que es lo que el indice protege").toBe(1);
  }, 30_000);

  it("y la cuenta vieja queda con su RASTRO, apuntando a la nueva, no borrada", async () => {
    await venta();
    const primera = await emitir();
    await venta();
    const segunda = await emitir();

    const v = await fila(primera.statementId);
    expect(v, "la vieja sigue existiendo: una factura entregada no se borra").toBeTruthy();
    expect(v.replaced_by_id).toBe(segunda.statementId);
    expect(v.superseded_reason).toBe("reemplazada");
    expect(v.superseded_at).not.toBeNull();

    const n = await fila(segunda.statementId);
    expect(n.superseded_at, "la nueva es la viva").toBeNull();
  }, 30_000);

  // EL PASO 6 DE LA PARTE 10 DEL SMOKE, que nunca se pudo correr.
  it("EL CAMINO DE LA OBJECION: objetar, darle la razon y rehacerla llega hasta el final", async () => {
    await venta();
    const primera = await emitir();

    await writer.objetarCuenta({
      statementId: primera.statementId,
      professionalId: profId,
      motivo: "me estan cobrando una unidad que no recibi",
      actorId,
      actorEmail: null,
    });
    await writer.resolverObjecion({
      statementId: primera.statementId,
      desenlace: "corregida",
      actorId,
      actorEmail: null,
    });

    // Resolverla devolvio las ventas al pozo "para que el corte se pueda volver a emitir". Antes de la
    // 0215, esta re-emision reventaba contra la misma llave y el modelo quedaba sin su mecanismo.
    const rehecha = await emitir();
    expect(rehecha.reemplazoA).toBe(primera.statementId);
    expect(rehecha.ventas).toBe(1);
    expect(await vivasDelCorte()).toBe(1);
    expect((await fila(primera.statementId)).replaced_by_id).toBe(rehecha.statementId);
  }, 30_000);

  it("una cuenta PAGADA no se reemplaza: lo dice con una frase y no revienta", async () => {
    await venta();
    const primera = await emitir();
    await writer.registrarPagoDeCuenta({
      statementId: primera.statementId,
      monto: 95_200,
      nota: null,
      actorId,
      actorEmail: null,
    });

    await venta();
    await expect(emitir()).rejects.toThrow(/ya se pagó/i);

    // Y la pagada sigue intacta: ni retirada ni con sus lineas devueltas.
    const v = await fila(primera.statementId);
    expect(v.superseded_at).toBeNull();
    expect(await ventasDe(primera.statementId)).toBe(1);
  }, 30_000);

  it("y la base se niega a revivir una cuenta retirada", async () => {
    await venta();
    const primera = await emitir();
    await venta();
    await emitir();

    // DRIZZLE ENVUELVE EL ERROR DE POSTGRES: el mensaje del trigger va en la CAUSA, no en el message, que
    // solo dice "Failed query". Asertar sobre el message haria pasar este candado con cualquier fallo.
    const e = await db
      .execute(
        dsql`update distribucion_statements set superseded_at = null, superseded_reason = null
               where id = ${primera.statementId}`,
      )
      .then(
        () => null,
        (err: unknown) => err,
      );
    expect(e, "la base tiene que negarse").not.toBeNull();
    expect(String((e as { cause?: unknown }).cause)).toMatch(/no vuelve a estar viva/i);
  }, 30_000);
});
