import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ═══ LA COMISION DE UNA VENTA DE PRUEBA NO SE GIRA (Santiago, 2026-10-09) ═══
//
// ── EL CASO, Y POR QUE ES DE DINERO ───────────────────────────────────────────────────────────────
//
// Textual suyo: *"hoy alguien que entre a /comercial ve que hay pendiente por girarle X a un profesional que NO
// esta marcado de prueba, y se los gira pensando que son ventas reales, cuando esas ventas se las hizo a un
// paciente con el que estaba haciendo pruebas. Eso NO puede pasar."*
//
// Y el mecanismo: el sello contable crea la fila de comision en TODA venta de modalidad comision, sin filtro de
// prueba, mientras la 0203 mantiene esa venta FUERA del ingreso de CNV. Asi que CNV no contaba la venta como
// ingreso y SI debia su comision.
//
// ── LAS DOS MITADES, Y POR QUE SON DOS ───────────────────────────────────────────────────────────
//
//   · La base que SE GIRA excluye lo de prueba.
//   · Y lo de prueba NO DESAPARECE: viaja aparte, porque hacerlo desaparecer esconderia comisiones ya selladas.
//     Es la misma razon que Santiago dio el 2026-10-01 para la marca del profesional.
//
// Probar solo la primera dejaria pasar un "arreglo" que filtre y borre el rastro, que es justo lo que el no
// quiere.
//
// VA CONTRA LA BASE REAL porque la marca es una columna DERIVADA por trigger (0203): un test con la marca
// escrita a mano probaria mi suposicion, no el trigger.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se auto-salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const SELLO = `COMPR-${Date.now()}`;

describe.skipIf(!HAS_DB)("la comision de una venta de prueba no se gira (BD real)", () => {
  let db: typeof import("@/db").db;
  let listar: typeof import("@/modules/payments/data/liquidacion-writer").listarPendientesDeLiquidar;
  let orgId: string;
  let profId: string;
  const creadas: string[] = [];
  const pacientes: string[] = [];

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    ({ listarPendientesDeLiquidar: listar } = await import("@/modules/payments/data/liquidacion-writer"));
    // EL QUE MENOS VENTAS TIENE, por lo de siempre: marcar o tocar al Demo dispara el trigger sobre 16.000
    // filas y el caso se pasa de los 30 s (`fixture-no-coge-al-demo`).
    const [prof] = await db.execute<{ id: string; organization_id: string }>(dsql`
      select pp.id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       where coalesce(pp.is_test, false) = false and p.organization_id is not null
       order by (select count(*) from transactions t where t.professional_id = pp.id), pp.created_at
       limit 1`);
    profId = prof.id;
    orgId = prof.organization_id;
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of creadas) {
      await db.execute(dsql`delete from professional_revenue where transaction_id = ${id}`);
      await db.execute(dsql`delete from transactions where id = ${id}`);
    }
    for (const id of pacientes) {
      await db.execute(dsql`delete from patients where id = ${id}`);
    }
    await db.execute(dsql`set session_replication_role = default`);
  });

  async function paciente(dePrueba: boolean): Promise<string> {
    const [p] = await db.execute<{ id: string }>(dsql`
      insert into patients (organization_id, document_type, document_number, is_test)
      values (${orgId}, 'CC', ${`${SELLO}-${Math.random().toString(36).slice(2, 8)}`}, ${dePrueba})
      returning id`);
    pacientes.push(p.id);
    return p.id;
  }

  /** Una venta PAGADA con su comision, al paciente que se le pase. */
  async function ventaConComision(patientId: string, monto: number): Promise<string> {
    const [t] = await db.execute<{ id: string }>(dsql`
      insert into transactions
        (organization_id, patient_id, professional_id, status, amount, currency, payment_method,
         wompi_env, idempotency_key)
      values (${orgId}, ${patientId}, ${profId}, 'paid', ${String(monto)}, 'COP', 'efectivo', 'test',
              ${`${SELLO}-${Math.random().toString(36).slice(2, 8)}`})
      returning id`);
    creadas.push(t.id);
    await db.execute(dsql`
      insert into professional_revenue (transaction_id, professional_id, commission_rate, commission_amount)
      values (${t.id}, ${profId}, '0.20', ${String(Math.round(monto * 0.2))})`);
    return t.id;
  }

  it("la base que se gira excluye la comision del paciente de prueba, y la cuenta tambien", async () => {
    const real = await paciente(false);
    const dePrueba = await paciente(true);
    await ventaConComision(real, 100000);
    await ventaConComision(dePrueba, 100000);

    const hoy = new Date().toISOString().slice(0, 10);
    const fila = (await listar(hoy)).find((p) => p.professionalId === profId);
    expect(fila, "el profesional del fixture no aparece entre los pendientes").toBeDefined();
    if (!fila) return;

    // LA CUENTA VA CON LA CIFRA, que es la leccion del "7 pagos / 428.400": si la base excluyera lo de prueba y
    // el conteo no, la linea diria "2 comisiones" al lado de un importe que vale 1.
    expect(fila.baseDePrueba, "la comision del paciente de prueba no quedo aparte").toBeGreaterThanOrEqual(20000);
    expect(fila.filasDePrueba).toBeGreaterThanOrEqual(1);
  });

  it("y lo de prueba NO desaparece: viaja aparte para que se vea que existe", async () => {
    // ES LA MITAD QUE UN ARREGLO APRESURADO SE LLEVA. Filtrar y no reportar "resolveria" el reporte de Santiago
    // y esconderia comisiones ya selladas, que es exactamente lo que el no quiere (su razon del 2026-10-01).
    const dePrueba = await paciente(true);
    await ventaConComision(dePrueba, 50000);

    const hoy = new Date().toISOString().slice(0, 10);
    const fila = (await listar(hoy)).find((p) => p.professionalId === profId);
    expect(fila?.baseDePrueba ?? 0, "lo de prueba se filtro sin dejar rastro").toBeGreaterThan(0);
  });

  it("y la marca la pone el TRIGGER, no el test: es una columna derivada", async () => {
    // Sin esto, el candado probaria mi suposicion sobre la marca y no la marca de verdad. La 0203 la recalcula
    // desde las tres marcas (paciente, profesional, producto), y el test solo marca al PACIENTE.
    const dePrueba = await paciente(true);
    const id = await ventaConComision(dePrueba, 10000);
    const [v] = await db.execute<{ marca: boolean }>(dsql`
      select cuenta_como_de_prueba as marca from transactions where id = ${id}`);
    expect(v.marca, "el trigger de la 0203 no marco la venta de un paciente de prueba").toBe(true);
  });
});
