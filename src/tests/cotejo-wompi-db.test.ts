import { randomUUID } from "node:crypto";

import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ EL COTEJO RECUPERA DE VERDAD, Y SOLO UNA VEZ (Bloque 3b, sesion 3, BD real) ═══
//
// Wompi reintenta su webhook 3 veces en 24 horas y despues no mas: el 2026-09-15, con la base saturada, un pago
// de prueba quedo cobrado y sin registrar, y nada lo recuperaba. Esto prueba el camino entero contra la base: una
// venta que quedo esperando, Wompi diciendo que si la pagaron, y Atlas sellandola por la MISMA ruta del webhook.
//
// Wompi se simula (no se llama a nadie de afuera); la base es la real, que es donde viven la idempotencia y el
// rastro de la corrida.

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

// La factura y el inventario tienen su propio candado; aqui estorban (llamarian a Alegra).
vi.mock("@/modules/payments/services/facturacion-service", () => ({
  emitirFacturaDeVenta: vi.fn(async () => undefined),
}));

let filasDeWompi: unknown[] = [];
vi.mock("@/lib/wompi/client", () => ({
  ambienteDeLaLlave: () => "test",
  listarTransacciones: async () => ({ ok: true, value: filasDeWompi }),
  buscarPorReferencia: async () => ({ ok: true, value: null }),
}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const MONTO = "11900";
let orgId = "";
const creadas: string[] = [];

async function ventaEsperando(status: "pending" | "failed"): Promise<string> {
  const { db } = await import("@/db");
  const id = randomUUID();
  await db.execute(dsql`
    insert into transactions (id, organization_id, status, amount, currency, payment_method, wompi_env,
                              idempotency_key, alegra_invoice_state)
    values (${id}, ${orgId}, ${status}, ${MONTO}, 'COP', 'wompi', 'test', ${`cotejo-${id}`}, 'pendiente')`);
  creadas.push(id);
  return id;
}

const filaAprobada = (ventaId: string, montoEnCentavos = 1_190_000) => ({
  id: `wompi-${ventaId.slice(0, 8)}`,
  reference: ventaId,
  status: "APPROVED",
  amount_in_cents: montoEnCentavos,
  payment_method_type: "CARD",
  payment_method: { extra: { card_type: "CREDIT" } },
});

describe.skipIf(!HAS_DB)("el cotejo con Wompi (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [org] = await db.execute<{ id: string }>(dsql`select id from organizations limit 1`);
    orgId = org.id;
  });

  afterAll(async () => {
    const { db } = await import("@/db");
    for (const id of creadas) {
      await db.execute(dsql`delete from payment_webhook_events where payload->>'transactionId' = ${id}`);
      await db.execute(dsql`delete from transactions where id = ${id}`);
    }
    await db.execute(dsql`delete from payment_reconciliation_runs where wompi_env = 'test' and origin = 'manual'`);
  });

  it("UNA VENTA COBRADA SIN REGISTRAR SE RECUPERA, y correrlo otra vez no la vuelve a aplicar", async () => {
    const { cotejarConWompi } = await import("@/modules/payments/services/conciliacion-service");
    const { db } = await import("@/db");
    const id = await ventaEsperando("pending");
    filasDeWompi = [filaAprobada(id)];

    const primera = await cotejarConWompi({ origen: "manual", dias: 1 });
    expect(primera.recuperadas, "el pago que Wompi aprobo y cuyo webhook se perdio").toContain(id);

    const [venta] = await db.execute<{ status: string; wompi_transaction_id: string | null }>(dsql`
      select status, wompi_transaction_id from transactions where id = ${id}`);
    expect(venta.status, "quedo sellada como pagada").toBe("paid");
    expect(venta.wompi_transaction_id).toBe(`wompi-${id.slice(0, 8)}`);

    const segunda = await cotejarConWompi({ origen: "manual", dias: 1 });
    expect(segunda.recuperadas, "sellar dos veces duplicaria ingreso y comision").not.toContain(id);
    // Y se comprueba en la base, no solo en lo que devuelve el servicio: un ingreso duplicado seria plata mal
    // contada, y el evento repetido dejaria la puerta abierta a que el webhook tardio lo aplicara otra vez.
    const [cuentas] = await db.execute<{ ingresos: number; eventos: number }>(dsql`
      select (select count(*)::int from cnv_revenue where transaction_id = ${id}) as ingresos,
             (select count(*)::int from payment_webhook_events
               where provider = 'wompi' and external_id = ${`wompi-${id.slice(0, 8)}:APPROVED`}) as eventos`);
    expect(Number(cuentas.ingresos), "el ingreso quedo duplicado").toBe(1);
    expect(Number(cuentas.eventos), "el evento tiene que ser el MISMO del webhook, uno solo").toBe(1);
  });

  it("CON EL MONTO DISTINTO NO LA SELLA: queda anotada y la venta sigue esperando", async () => {
    const { cotejarConWompi } = await import("@/modules/payments/services/conciliacion-service");
    const { db } = await import("@/db");
    const id = await ventaEsperando("pending");
    filasDeWompi = [filaAprobada(id, 990_000)];

    const r = await cotejarConWompi({ origen: "manual", dias: 1 });
    expect(r.recuperadas).not.toContain(id);
    expect(r.discrepancias.map((d) => d.ventaId)).toContain(id);
    const [venta] = await db.execute<{ status: string }>(dsql`select status from transactions where id = ${id}`);
    expect(venta.status, "sellar otra cifra descuadra el ingreso y la factura").toBe("pending");
  });

  it("UN PAGO SOBRE UN LINK ANULADO se recupera Y ENTRA EN REVISION, no se cobra como si nada", async () => {
    const { cotejarConWompi } = await import("@/modules/payments/services/conciliacion-service");
    const { db } = await import("@/db");
    const id = await ventaEsperando("failed");
    await db.execute(dsql`update transactions set cancelled_at = now() where id = ${id}`);
    filasDeWompi = [filaAprobada(id)];

    await cotejarConWompi({ origen: "manual", dias: 1 });
    const [venta] = await db.execute<{ status: string; review_reason: string | null }>(dsql`
      select status, review_reason from transactions where id = ${id}`);
    expect(venta.status).toBe("paid");
    expect(venta.review_reason, "un pago sobre un link anulado pide la version del Integrante").not.toBeNull();
  });

  it("CADA CORRIDA DEJA SU RASTRO: un control que no se sabe si corrio no es un control", async () => {
    const { cotejarConWompi } = await import("@/modules/payments/services/conciliacion-service");
    const { ultimaCorrida } = await import("@/modules/payments/data/conciliacion-repository");
    filasDeWompi = [];
    await cotejarConWompi({ origen: "manual", dias: 1 });
    const u = await ultimaCorrida();
    expect(u).not.toBeNull();
    expect(u!.origen).toBe("manual");
    expect(u!.falloPor).toBeNull();
  });

  it("UNA VENTA PAGADA QUE WOMPI DA POR ANULADA ABRE LA REVERSA, no solo se reporta (smoke del 2026-09-17)", async () => {
    const { cotejarConWompi } = await import("@/modules/payments/services/conciliacion-service");
    const { db } = await import("@/db");
    const id = await ventaEsperando("pending");
    const wompiId = `wompi-anulada-${id.slice(0, 8)}`;
    // La venta quedo PAGADA con esa transaccion, y Wompi la da por anulada: es lo que paso en el smoke.
    await db.execute(dsql`update transactions set status = 'paid', wompi_transaction_id = ${wompiId} where id = ${id}`);
    filasDeWompi = [{ ...filaAprobada(id), id: wompiId, status: "VOIDED" }];

    const r = await cotejarConWompi({ origen: "manual", dias: 1 });
    expect(r.discrepancias.map((d) => d.ventaId), "el cotejo tiene que verla").toContain(id);
    const [rev] = await db.execute<{ kind: string; state: string }>(dsql`
      select kind, state from sale_reversals where transaction_id = ${id}`);
    expect(rev, "se reporto la discrepancia pero nadie abrio el caso: la venta seguia como si nada").toMatchObject({
      kind: "anulacion_wompi",
      state: "abierta",
    });
    expect(r.reversasAbiertas, "el resultado tiene que DECIR que se abrio, no dejarlo solo en Sentry").toContain(id);
    expect(r.discrepancias.find((d) => d.ventaId === id)?.motivo).toContain("Se abrió el caso");
    // Y el motivo queda en el rastro de la corrida, que es lo que lee la pantalla: "1 no cuadra" sin decir cual
    // no le sirve a quien tiene que resolverlo (smoke del 2026-09-17).
    const { ultimaCorrida } = await import("@/modules/payments/data/conciliacion-repository");
    const u = await ultimaCorrida();
    expect(u!.detalle.map((d) => d.motivo).join(" ")).toContain("Wompi dice VOIDED");
    expect(u!.detalle[0].monto, "sin el monto y la hora, el aviso no dice CUAL venta es").toBe(MONTO);
  });

  it("SI WOMPI NO RESPONDE, la corrida queda escrita con su motivo: el hueco no se cierra en silencio", async () => {
    vi.resetModules();
    vi.doMock("@/lib/wompi/client", () => ({
      ambienteDeLaLlave: () => "test",
      listarTransacciones: async () => ({ ok: false, error: { message: "Wompi respondio 503" } }),
      buscarPorReferencia: async () => ({ ok: true, value: null }),
    }));
    const { cotejarConWompi } = await import("@/modules/payments/services/conciliacion-service");
    const { ultimaCorrida } = await import("@/modules/payments/data/conciliacion-repository");
    await ventaEsperando("pending");
    const r = await cotejarConWompi({ origen: "manual", dias: 1 });
    expect(r.falloPor).toContain("503");
    const u = await ultimaCorrida();
    expect(u!.falloPor).toContain("503");
    vi.doUnmock("@/lib/wompi/client");
    vi.resetModules();
  });
});
