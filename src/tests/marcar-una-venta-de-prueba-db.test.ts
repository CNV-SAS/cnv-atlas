import { sql as dsql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ UNA VENTA SE PUEDE MARCAR COMO PRUEBA (0217) ═══
//
// EL HUECO QUE CIERRA, y es el unico que le faltaba a la arquitectura de lo de prueba: la 0203 deriva la
// marca de QUIEN y de QUE, nunca del ACTO. Un profesional REAL vendiendole un producto REAL a un paciente
// REAL, como prueba, no tenia de donde derivarse. Textual de Santiago: *"una venta de luvia que se habia
// hecho a Maria Camila nunca lo habiamos podido borrar ni ocultar"*.
//
// ── LO QUE ESTE CANDADO SOSTIENE, y el primero es el que de verdad importa ────────────────────────
//
//   1. QUE LA MARCA LLEGUE A LA COLUMNA DERIVADA. Es una cuarta ENTRADA de la derivacion, no un filtro
//      nuevo, y por eso alcanza de una sola vez a los catorce lectores que leen `cuenta_como_de_prueba`.
//      Si el trigger no escuchara la columna nueva, la marca se escribiria, el CHECK pasaria, nadie
//      fallaria, y la venta seguiria contando: es la forma exacta de "una pieza terminada sin el ultimo
//      cable", y solo se ve mirando la columna derivada.
//   2. QUE SE PUEDA DESHACER, porque una marca que no se puede quitar es una marca que nadie se atreve a
//      poner.
//   3. QUE AL DESHACERLA NO VUELVA A CONTAR SI SIGUE SIENDO DE PRUEBA POR OTRA RAZON. Quitar la marca y
//      que la cifra no se mueva es una contradiccion, y la funcion la DICE en vez de dejarla callada.
//   4. Y QUE EL MOTIVO SEA OBLIGATORIO, en la aplicacion y en la base. Sin motivo, la respuesta a "¿por
//      que esta venta no cuenta?" seria "porque alguien la marco".

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("marcar una venta como prueba (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let writer: any;
  let orgId = "";
  let profId = "";
  let actorId = "";
  const nutraId = "77777777-7777-7777-7777-777777777702";
  const ventas: string[] = [];
  const pacientes: string[] = [];

  const MOTIVO = "venta de prueba del smoke anterior a produccion";

  async function venta(patientId: string | null = null): Promise<string> {
    const [t] = await db.execute(dsql`
      insert into transactions (organization_id, professional_id, patient_id, status, amount, currency,
                                payment_method, wompi_env, operated_at, idempotency_key)
      values (${orgId}, ${profId}, ${patientId}, 'paid', '119000', 'COP', 'efectivo', 'test', now(),
              ${`test-marca-${Date.now()}-${Math.random().toString(36).slice(2)}`})
      returning id`);
    ventas.push(t.id);
    await db.execute(dsql`
      insert into transaction_items (transaction_id, nutraceutical_id, quantity, unit_price, modality,
                                     vat_rate, commission_rate, supplier_share,
                                     base_amount, commission_amount, supplier_amount, cnv_amount, sealed_at)
      values (${t.id}, ${nutraId}, 1, '119000', 'comision', '0.19', '0.20', '0',
              '100000', '20000', '0', '80000', now())`);
    return t.id;
  }

  const esDePrueba = async (txId: string): Promise<boolean> => {
    const [f] = await db.execute(dsql`
      select cuenta_como_de_prueba as p from transactions where id = ${txId}`);
    return f.p;
  };

  const marca = async (txId: string) => {
    const [f] = await db.execute(dsql`
      select marcada_como_prueba_at as at, marcada_como_prueba_por as por,
             marcada_como_prueba_motivo as motivo
        from transactions where id = ${txId}`);
    return f;
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    writer = await import("@/modules/payments/data/marca-de-prueba-de-la-venta");
    const [prof] = await db.execute(dsql`
      select pp.id, pp.profile_id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       where coalesce(pp.is_test, false) = false
       order by pp.created_at limit 1`);
    profId = prof.id;
    actorId = prof.profile_id;
    orgId = prof.organization_id;
  }, 30_000);

  afterEach(async () => {
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of ventas) {
      await db.execute(dsql`delete from clinical_audit_log where entity_id = ${id}`);
      await db.execute(dsql`delete from transaction_items where transaction_id = ${id}`);
      await db.execute(dsql`delete from transactions where id = ${id}`);
    }
    for (const id of pacientes) {
      await db.execute(dsql`delete from clinical_audit_log where entity_id = ${id}`);
      await db.execute(dsql`delete from patient_profiles where patient_id = ${id}`);
      await db.execute(dsql`delete from patients where id = ${id}`);
    }
    await db.execute(dsql`set session_replication_role = default`);
    ventas.length = 0;
    pacientes.length = 0;
  });

  // EL CABLE: sin el, la marca no hace nada y nada falla.
  it("marcar la venta LLEGA a la columna derivada, que es la que leen los catorce lectores", async () => {
    const id = await venta();
    expect(await esDePrueba(id), "arranca contando: profesional, producto y acto reales").toBe(false);

    await writer.marcarVentaComoPrueba({
      transactionId: id,
      motivo: MOTIVO,
      actorId,
      actorEmail: null,
      ip: null,
    });

    expect(
      await esDePrueba(id),
      "si el trigger no escucha la columna nueva, la marca se escribe y la venta sigue contando: una " +
        "pieza terminada sin el ultimo cable",
    ).toBe(true);
    const m = await marca(id);
    expect(m.at).not.toBeNull();
    expect(m.por).toBe(actorId);
    expect(m.motivo).toBe(MOTIVO);
  }, 30_000);

  it("queda su fila de auditoria, con el motivo", async () => {
    const id = await venta();
    await writer.marcarVentaComoPrueba({
      transactionId: id,
      motivo: MOTIVO,
      actorId,
      actorEmail: null,
      ip: null,
    });
    const filas = await db.execute(dsql`
      select payload from clinical_audit_log
       where entity_id = ${id} and event = 'venta.marcada_de_prueba'`);
    expect(filas.length).toBe(1);
    expect(filas[0].payload.motivo).toBe(MOTIVO);
  }, 30_000);

  it("marcarla dos veces no cambia nada ni duplica el rastro", async () => {
    const id = await venta();
    await writer.marcarVentaComoPrueba({ transactionId: id, motivo: MOTIVO, actorId, actorEmail: null, ip: null });
    const r = await writer.marcarVentaComoPrueba({
      transactionId: id,
      motivo: "otro motivo distinto del primero",
      actorId,
      actorEmail: null,
      ip: null,
    });
    expect(r.yaEstaba).toBe(true);
    expect((await marca(id)).motivo, "el motivo original no se pisa").toBe(MOTIVO);
    const filas = await db.execute(dsql`
      select 1 from clinical_audit_log where entity_id = ${id} and event = 'venta.marcada_de_prueba'`);
    expect(filas.length).toBe(1);
  }, 30_000);

  it("se puede deshacer, y entonces vuelve a contar", async () => {
    const id = await venta();
    await writer.marcarVentaComoPrueba({ transactionId: id, motivo: MOTIVO, actorId, actorEmail: null, ip: null });
    const r = await writer.desmarcarVentaComoPrueba({
      transactionId: id,
      motivo: "era una venta real, me equivoque al marcarla",
      actorId,
      actorEmail: null,
      ip: null,
    });
    expect(r.sigueSiendoDePrueba).toBe(false);
    expect(await esDePrueba(id)).toBe(false);
    expect((await marca(id)).at).toBeNull();
  }, 30_000);

  // LA CONTRADICCION QUE SE DICE: quitar la marca y que la cifra no se mueva.
  it("y si sigue siendo de prueba por su PACIENTE, la desmarca lo DICE", async () => {
    const [p] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number, is_test,
                            test_marked_at, test_marked_by,
                            test_proposed_at, test_proposed_by, test_proposed_reason)
      values (${orgId}, 'CC', ${`ZZ-MARCA-${Date.now()}`}, true,
              now(), ${actorId},
              now(), ${actorId}, 'paciente de prueba del candado')
      returning id`);
    pacientes.push(p.id);
    const id = await venta(p.id);
    expect(await esDePrueba(id), "ya no cuenta, por su paciente").toBe(true);

    await writer.marcarVentaComoPrueba({ transactionId: id, motivo: MOTIVO, actorId, actorEmail: null, ip: null });
    const r = await writer.desmarcarVentaComoPrueba({
      transactionId: id,
      motivo: "quito la marca del acto, a ver que pasa",
      actorId,
      actorEmail: null,
      ip: null,
    });
    expect(
      r.sigueSiendoDePrueba,
      "quitar la marca y que la cifra no se mueva es una contradiccion: hay que decirla",
    ).toBe(true);
    expect(await esDePrueba(id)).toBe(true);
  }, 30_000);

  it("el motivo es obligatorio, y lo exige tambien la BASE", async () => {
    const id = await venta();
    await expect(
      writer.marcarVentaComoPrueba({ transactionId: id, motivo: "corto", actorId, actorEmail: null, ip: null }),
    ).rejects.toThrow(/por qué/i);

    // Y por si alguien escribe sin pasar por el escritor.
    const e = await db
      .execute(
        dsql`update transactions set marcada_como_prueba_at = now(), marcada_como_prueba_por = ${actorId}
              where id = ${id}`,
      )
      .then(
        () => null,
        (err: unknown) => err,
      );
    expect(e, "sin motivo, la base tiene que negarse").not.toBeNull();
    expect(String((e as { cause?: unknown }).cause)).toMatch(/marca_de_prueba_con_motivo/i);
  }, 30_000);
});
