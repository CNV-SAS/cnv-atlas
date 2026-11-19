import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ═══ LA EDAD SE MIDE A LA FECHA DE LA VENTA, Y EL REPRESENTANTE SE ENCUENTRA ═══
//
// El candado neutro (`la-factura-de-un-menor.test.ts`) prueba la REGLA. Este prueba el LECTOR, que es la
// mitad que de verdad se equivoca: la aritmetica de la edad en SQL y el camino hasta el representante.
//
// ── POR QUE CONTRA LA BASE REAL ──────────────────────────────────────────────────────────────────
//
// Porque lo que se mide aqui es `extract(year from age(...))` de Postgres contra una columna `date`, y un
// fixture en memoria probaria mi suposicion sobre esa aritmetica, no la aritmetica. Es la misma leccion
// que ya esta escrita en `edad.ts`: una fecha PURA no se convierte a la zona de Colombia, porque
// convertirla la retrocede un dia, y eso mueve un cumpleaños.
//
// ── EL CASO DEL BORDE ES EL QUE IMPORTA ─────────────────────────────────────────────────────────
//
// Quien cumple 18 ENTRE la venta y hoy era menor cuando compro. Si el lector midiera la edad de HOY, esa
// venta se facturaria a nombre de alguien que el dia del hecho era menor, que es justo lo que
// contabilidad prohibe. Por eso el fixture pone la venta en el pasado y el cumpleaños en medio.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se auto-salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const SELLO = `MENOR-${Date.now()}`;

describe.skipIf(!HAS_DB)("la edad y el representante de una venta (BD real)", () => {
  let db: typeof import("@/db").db;
  let leer: typeof import("@/modules/payments/data/facturacion-repository").getMenorYRepresentanteDeLaVenta;
  let orgId: string;
  let profId: string;
  const pacientes: string[] = [];
  const ventas: string[] = [];

  /** Un paciente con la fecha de nacimiento que se le pase, y su venta en el dia que se le pase. */
  async function pacienteConVenta(nacimiento: string | null, diaDeLaVenta: string): Promise<string> {
    const [p] = await db.execute<{ id: string }>(dsql`
      insert into patients (organization_id, document_type, document_number, is_test)
      values (${orgId}, 'TI', ${`${SELLO}-${Math.random().toString(36).slice(2, 8)}`}, true)
      returning id`);
    pacientes.push(p.id);
    await db.execute(dsql`
      insert into patient_profiles (patient_id, first_name, last_name, birth_date)
      values (${p.id}, 'Paciente', 'De prueba', ${nacimiento}::date)`);
    const [t] = await db.execute<{ id: string }>(dsql`
      insert into transactions
        (organization_id, patient_id, professional_id, status, amount, currency, payment_method,
         wompi_env, idempotency_key, operated_at)
      values (${orgId}, ${p.id}, ${profId}, 'paid', '107100', 'COP', 'efectivo', 'test',
              ${`${SELLO}-${Math.random().toString(36).slice(2, 8)}`}, ${diaDeLaVenta}::timestamptz)
      returning id`);
    ventas.push(t.id);
    return t.id;
  }

  async function ponerleRepresentante(ventaId: string): Promise<void> {
    const [t] = await db.execute<{ patient_id: string }>(dsql`
      select patient_id from transactions where id = ${ventaId}`);
    await db.execute(dsql`
      insert into patient_consents
        (patient_id, consent_type, consent_version, document_hash,
         legal_representative_name, legal_representative_document, legal_representative_email)
      values (${t.patient_id}, 'representante_legal', 'v1.1', ${SELLO},
              'Representante De Prueba', '1020304050', 'representante@ejemplo.test')`);
  }

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    ({ getMenorYRepresentanteDeLaVenta: leer } = await import(
      "@/modules/payments/data/facturacion-repository"
    ));
    const [prof] = await db.execute<{ id: string; organization_id: string }>(dsql`
      select pp.id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       where p.organization_id is not null
       order by (select count(*) from transactions t where t.professional_id = pp.id), pp.created_at
       limit 1`);
    profId = prof.id;
    orgId = prof.organization_id;
  }, 30_000);

  afterAll(async () => {
    if (!HAS_DB) return;
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of ventas) await db.execute(dsql`delete from transactions where id = ${id}`);
    for (const id of pacientes) {
      await db.execute(dsql`delete from patient_consents where patient_id = ${id}`);
      await db.execute(dsql`delete from patient_profiles where patient_id = ${id}`);
      await db.execute(dsql`delete from patients where id = ${id}`);
    }
    await db.execute(dsql`set session_replication_role = default`);
  }, 30_000);

  it("un menor sin representante: la edad sale y el representante viene vacío", async () => {
    const hoy = new Date();
    const nacimiento = `${hoy.getUTCFullYear() - 10}-06-15`;
    const venta = await pacienteConVenta(nacimiento, new Date().toISOString());

    const r = await leer(venta);
    expect(r.edadEnLaVenta).toBe(10);
    expect(r.representante).toBeNull();
  }, 30_000);

  it("y con representante lo encuentra, con su documento y su correo", async () => {
    const hoy = new Date();
    const nacimiento = `${hoy.getUTCFullYear() - 10}-06-15`;
    const venta = await pacienteConVenta(nacimiento, new Date().toISOString());
    await ponerleRepresentante(venta);

    const r = await leer(venta);
    expect(r.edadEnLaVenta).toBe(10);
    expect(r.representante?.documento).toBe("1020304050");
    expect(r.representante?.correo).toBe("representante@ejemplo.test");
  }, 30_000);

  it("EL BORDE: quien cumplió 18 DESPUÉS de la venta era menor el día que compró", async () => {
    // Nacio hace 18 años y un mes; la venta fue hace dos meses, o sea cuando tenia 17.
    const hoy = new Date();
    const nacimiento = new Date(
      Date.UTC(hoy.getUTCFullYear() - 18, hoy.getUTCMonth() - 1, 15),
    );
    const laVenta = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 10, 17, 0, 0));
    const venta = await pacienteConVenta(
      nacimiento.toISOString().slice(0, 10),
      laVenta.toISOString(),
    );

    const r = await leer(venta);
    expect(
      r.edadEnLaVenta,
      "el lector está midiendo la edad de HOY y no la del día de la venta",
    ).toBe(17);
  }, 30_000);

  it("sin fecha de nacimiento devuelve null, y eso NO frena a nadie", async () => {
    const venta = await pacienteConVenta(null, new Date().toISOString());
    const r = await leer(venta);
    expect(r.edadEnLaVenta).toBeNull();
  }, 30_000);
});
