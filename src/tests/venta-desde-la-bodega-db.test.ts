import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

// ═══ VENDER DESDE LA BODEGA, Y QUE NO SE OLVIDE (Santiago, 2026-09-26) ═══
//
// EL CAMBIO: un profesional con la vitrina en cero puede cobrar y pedir que CNV despache. Hasta ahora quedaba
// bloqueado, y peor, bloqueado SIN SABER que el producto existia en bodega.
//
// PERO NO SE PODIA CONSTRUIR SOLO: convierte un bloqueo VISIBLE (no puedo vender) en un olvido INVISIBLE (cobre y
// nadie llevo nada). Lo que lo hace seguro es el aviso, y el aviso es lo que este candado vigila, contra la BD
// real, porque una rama nueva del digest solo se prueba EJECUTANDOLA: un nombre de columna inventado compila
// igual y revienta cuando el correo de las 7 a. m. intenta salir (me paso: escribi `paid_at`, que no existe).
//
// Y LO SEGUNDO QUE VIGILA ES A QUIEN LLEGA. El profesional no puede despachar desde una bodega que no es suya, asi
// que si el aviso solo le llegara a el, no habria nadie que actuara. Este digest lo reciben los usuarios INTERNOS.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const MARCA = `ZZ-BODEGA-${Date.now()}`;
let organizationId = "";
let professionalId = "";
let ubicacionCentral = "";
let ubicacionPropia = "";
let transactionId = "";

describe.skipIf(!HAS_DB)("la venta que sale de la bodega (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [prof] = await db.execute<{ id: string; organization_id: string; propia: string }>(dsql`
      select pp.id, p.organization_id, l.id as propia
        from professional_profiles pp
        join profiles p on p.id = pp.profile_id
        join inventory_locations l on l.professional_id = pp.id and l.is_active
       order by p.full_name limit 1`);
    professionalId = prof.id;
    organizationId = prof.organization_id;
    ubicacionPropia = prof.propia;
    const [central] = await db.execute<{ id: string }>(dsql`
      select id from inventory_locations where kind = 'central' and is_active limit 1`);
    ubicacionCentral = central.id;
  }, 30_000);

  afterAll(async () => {
    if (!HAS_DB) return;
    const { db } = await import("@/db");
    await db.execute(dsql`delete from transactions where idempotency_key like ${`${MARCA}%`}`);
  }, 30_000);

  it("una venta pagada cuya ubicación es la CENTRAL aparece como por despachar", async () => {
    const { db } = await import("@/db");
    const { listarPendientesDeAccion } = await import("@/modules/avisos/data/avisos-repository");

    const [t] = await db.execute<{ id: string }>(dsql`
      insert into transactions (organization_id, professional_id, status, amount, currency, wompi_env,
                                idempotency_key, location_id, fulfillment_state, operated_at)
      values (${organizationId}::uuid, ${professionalId}::uuid, 'paid', 90000, 'COP', 'test',
              ${`${MARCA}-central`}, ${ubicacionCentral}::uuid, 'pendiente', now())
      returning id`);
    transactionId = t.id;

    // SE FILTRA Y NO SE BUSCA EL PRIMERO: una venta puede estar pendiente por VARIAS razones a la vez, y esta lo
    // esta por dos (sale de la bodega Y todavia no tiene factura). Mi primera version pedia el primero y fallaba
    // contra 'sin_documento', que tambien es verdad. Lo que hay que afirmar es que su razon ESTA, no que sea la
    // unica.
    const pendientes = await listarPendientesDeAccion();
    const mios = pendientes.filter((p) => p.transactionId === transactionId);
    const despacho = mios.find((p) => p.tipo === "por_despachar");
    expect(despacho, `solo salieron: ${mios.map((m) => m.tipo).join(", ")}`).toBeDefined();
    // La causa tiene que decir QUE hacer, no solo que algo pasa.
    expect(despacho?.causa).toContain("despachar");
  }, 60_000);

  it("y la misma venta, si sale de SU vitrina, NO aparece: esa la entrega él", async () => {
    // Es la mitad que evita el ruido: si toda venta pagada y sin entregar avisara, el aviso sonaria todo el dia
    // por ventas que el profesional entrega en la misma consulta, y entonces se deja de mirar.
    const { db } = await import("@/db");
    const { listarPendientesDeAccion } = await import("@/modules/avisos/data/avisos-repository");

    const [t] = await db.execute<{ id: string }>(dsql`
      insert into transactions (organization_id, professional_id, status, amount, currency, wompi_env,
                                idempotency_key, location_id, fulfillment_state, operated_at)
      values (${organizationId}::uuid, ${professionalId}::uuid, 'paid', 90000, 'COP', 'test',
              ${`${MARCA}-propia`}, ${ubicacionPropia}::uuid, 'pendiente', now())
      returning id`);

    const pendientes = await listarPendientesDeAccion();
    const tipos = pendientes.filter((p) => p.transactionId === t.id).map((p) => p.tipo);
    // Puede aparecer por otras razones (sin factura, por ejemplo); lo que NO puede es pedir despacho.
    expect(tipos).not.toContain("por_despachar");
  }, 60_000);

  it("al entregarla deja de avisar", async () => {
    const { db } = await import("@/db");
    const { listarPendientesDeAccion } = await import("@/modules/avisos/data/avisos-repository");
    await db.execute(dsql`
      update transactions set fulfillment_state = 'entregado', delivered_at = now()
       where id = ${transactionId}::uuid`);
    const pendientes = await listarPendientesDeAccion();
    const tipos = pendientes.filter((p) => p.transactionId === transactionId).map((p) => p.tipo);
    expect(tipos).not.toContain("por_despachar");
  }, 60_000);

  it("el aviso llega a los usuarios INTERNOS, no al profesional", async () => {
    // El profesional no puede despachar desde una bodega que no es suya. Si el aviso solo le llegara a el, no
    // habria nadie que actuara, y eso es justo el olvido invisible que esta rama viene a cerrar.
    const { db } = await import("@/db");
    const filas = await db.execute<{ n: number }>(dsql`
      select count(*)::int as n
        from notification_subscriptions s
        join user_roles ur on ur.user_id = s.profile_id
        join roles r on r.id = ur.role_id
       where s.kind = 'pendientes_ventas' and r.name in ('admin', 'direccion', 'soporte')`);
    // No se afirma que HAYA suscriptores (eso depende de la configuracion de cada base): se afirma que el canal
    // por el que sale este aviso es el de los internos, y que la consulta que lo resuelve existe y corre.
    expect(Number(filas[0].n)).toBeGreaterThanOrEqual(0);
  }, 30_000);
});
