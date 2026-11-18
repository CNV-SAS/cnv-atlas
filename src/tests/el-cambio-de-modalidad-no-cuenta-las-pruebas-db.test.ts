import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ═══ UNA VENTA DE PRUEBA NO APLAZA UN CAMBIO DE MODALIDAD (Santiago, 2026-11-18) ═══
//
// ── EL CASO ───────────────────────────────────────────────────────────────────────────────────────
//
// Al preparar el smoke, cambiar la modalidad de una cuenta de prueba decia *"ya tiene 2 ventas en el
// periodo en curso"* y mandaba el cambio al corte siguiente. Esas dos ventas eran DE PRUEBA.
//
// ── POR QUE ES UN DEFECTO Y NO UNA PRECAUCION ────────────────────────────────────────────────────
//
// La regla de esperar al corte siguiente existe para NO LIQUIDAR UN PERIODO CON DOS REGIMENES: si en el
// corte ya hubo ventas bajo Comision, cambiar hoy haria que el mismo corte tuviera ventas de dos
// modalidades. Una venta de prueba NO SE LIQUIDA, y eso no es una opinion: lo excluye el propio liquidador
// (`liquidacion-writer`, `cuenta_como_de_prueba = false`) y lo excluyen las cifras de Direccion. Asi que no
// hay nada que partir, y el freno protegia un periodo que no existe.
//
// ── Y LA MITAD QUE UN ARREGLO APRESURADO SE LLEVA ────────────────────────────────────────────────
//
// Que una venta REAL siga aplazando el cambio. Por eso el candado tiene los dos casos sobre la MISMA venta:
// marcada no cuenta, sin marcar si. Filtrar de mas aqui seria peor que el defecto, porque partiria un corte
// de verdad y nadie lo veria hasta la liquidacion.
//
// VA CONTRA LA BASE REAL porque `cuenta_como_de_prueba` es una columna DERIVADA por trigger (0203 y 0217):
// escribirla a mano en un fixture probaria mi suposicion sobre la marca, no la marca.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se auto-salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const SELLO = `MODPR-${Date.now()}`;

describe.skipIf(!HAS_DB)("el cambio de modalidad no cuenta las ventas de prueba (BD real)", () => {
  let db: typeof import("@/db").db;
  let leerModalidad: typeof import("@/modules/payments/data/modalidad-writer").leerModalidad;
  let orgId: string;
  let profId: string;
  let ventaId: string;
  let pacienteId: string;

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    ({ leerModalidad } = await import("@/modules/payments/data/modalidad-writer"));

    // EL QUE MENOS VENTAS TIENE, por lo de siempre: tocar al Demo dispara el trigger sobre miles de filas y
    // el caso se pasa de los 30 s (`fixture-no-coge-al-demo`).
    const [prof] = await db.execute<{ id: string; organization_id: string }>(dsql`
      select pp.id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       where coalesce(pp.is_test, false) = false and p.organization_id is not null
       order by (select count(*) from transactions t where t.professional_id = pp.id), pp.created_at
       limit 1`);
    profId = prof.id;
    orgId = prof.organization_id;

    // UN PACIENTE REAL Y UNA VENTA SIN MARCA: la marca se pone y se quita despues sobre la VENTA (0217), que
    // es el caso que importa (paciente y profesional reales, acto de prueba). Si el paciente fuera de prueba,
    // la columna derivada seria verdadera por otra razon y el candado no probaria la via de la 0217.
    const [p] = await db.execute<{ id: string }>(dsql`
      insert into patients (organization_id, document_type, document_number, is_test)
      values (${orgId}, 'CC', ${`${SELLO}-${Math.random().toString(36).slice(2, 8)}`}, false)
      returning id`);
    pacienteId = p.id;

    // CON FECHA DE HOY: tiene que caer dentro del corte en curso, que es lo que el lector cuenta.
    const [t] = await db.execute<{ id: string }>(dsql`
      insert into transactions
        (organization_id, patient_id, professional_id, status, amount, currency, payment_method,
         wompi_env, idempotency_key, operated_at)
      values (${orgId}, ${pacienteId}, ${profId}, 'paid', '107100', 'COP', 'efectivo', 'test',
              ${`${SELLO}-${Math.random().toString(36).slice(2, 8)}`}, now())
      returning id`);
    ventaId = t.id;
  }, 30_000);

  afterAll(async () => {
    if (!HAS_DB) return;
    await db.execute(dsql`set session_replication_role = replica`);
    await db.execute(dsql`delete from professional_revenue where transaction_id = ${ventaId}`);
    await db.execute(dsql`delete from transactions where id = ${ventaId}`);
    await db.execute(dsql`delete from patients where id = ${pacienteId}`);
    await db.execute(dsql`set session_replication_role = default`);
  }, 30_000);

  it("sin marca, la venta SI aplaza el cambio: es la mitad que hay que conservar", async () => {
    await db.execute(dsql`
      update transactions
         set marcada_como_prueba_at = null, marcada_como_prueba_por = null, marcada_como_prueba_motivo = null
       where id = ${ventaId}`);

    // La marca la recalcula el trigger, no el test: se comprueba antes de leer la modalidad.
    const [v] = await db.execute<{ marca: boolean }>(dsql`
      select cuenta_como_de_prueba as marca from transactions where id = ${ventaId}`);
    expect(v.marca, "la venta sin marca no deberia contar como de prueba").toBe(false);

    const estado = await leerModalidad(profId);
    expect(estado.ventasEnElCorte).toBeGreaterThanOrEqual(1);
    expect(estado.puedeAplicarDeInmediato).toBe(false);
  }, 30_000);

  it("marcada como prueba, deja de aplazarlo: no hay ningún periodo que partir", async () => {
    const [actor] = await db.execute<{ id: string }>(dsql`select id from profiles limit 1`);
    await db.execute(dsql`
      update transactions
         set marcada_como_prueba_at = now(),
             marcada_como_prueba_por = ${actor.id}::uuid,
             marcada_como_prueba_motivo = 'Candado: el cambio de modalidad no cuenta las pruebas'
       where id = ${ventaId}`);

    const [v] = await db.execute<{ marca: boolean }>(dsql`
      select cuenta_como_de_prueba as marca from transactions where id = ${ventaId}`);
    expect(v.marca, "el trigger de la 0217 no derivó la marca manual").toBe(true);

    const estado = await leerModalidad(profId);
    expect(estado.ventasEnElCorte, "una venta marcada como prueba sigue contando en el corte").toBe(0);
    expect(estado.puedeAplicarDeInmediato).toBe(true);
  }, 30_000);
});
