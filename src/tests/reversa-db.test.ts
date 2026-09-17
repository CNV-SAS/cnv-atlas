import { randomUUID } from "node:crypto";

import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ LA REVERSA CONTRA LA BASE (Bloque 3b, sesion 1) ═══
//
// Lo que se protege vive en la base: que abrir NO mueva el ingreso, que perder lo revierta con filas negativas
// (y ganar no), que no haya dos casos vivos sobre la misma venta, que la nota credito solo exista sobre una
// perdida, y que un VOIDED sobre una venta PAGADA abra el caso en vez de ignorarse, que es lo que pasaba antes.

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

let orgId = "";
const creadas: string[] = [];

async function ventaPagada(monto = "90000"): Promise<string> {
  const { db } = await import("@/db");
  const id = randomUUID();
  await db.execute(dsql`
    insert into transactions (id, organization_id, status, amount, currency, payment_method, wompi_env,
                              idempotency_key, alegra_invoice_state)
    values (${id}, ${orgId}, 'paid', ${monto}, 'COP', 'wompi', 'test', ${`rev-${id}`}, 'emitida')`);
  await db.execute(dsql`insert into cnv_revenue (transaction_id, amount) values (${id}, ${monto})`);
  creadas.push(id);
  return id;
}

const ingresoNeto = async (id: string): Promise<number> => {
  const { db } = await import("@/db");
  const [f] = await db.execute<{ total: string | null }>(dsql`
    select coalesce(sum(amount), 0)::text as total from cnv_revenue where transaction_id = ${id}`);
  return Number(f?.total ?? 0);
};

describe.skipIf(!HAS_DB)("las reversas de venta (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [org] = await db.execute<{ id: string }>(dsql`select id from organizations limit 1`);
    orgId = org.id;
  });

  afterAll(async () => {
    const { db } = await import("@/db");
    for (const id of creadas) await db.execute(dsql`delete from transactions where id = ${id}`);
  });

  it("ABRIR NO MUEVE EL INGRESO: la disputa se puede ganar y la factura sigue siendo valida", async () => {
    const { abrirReversa } = await import("@/modules/payments/data/reversas-writer");
    const id = await ventaPagada();
    const reversaId = await abrirReversa({
      transactionId: id,
      tipo: "contracargo",
      referenciaDeLaDisputa: "DISPUTA-1",
      montoDebitado: "105000",
      debitadoEn: "2026-09-16",
      nota: null,
      actorId: null,
    });
    expect(reversaId).toEqual(expect.any(String));
    expect(await ingresoNeto(id), "el ingreso se movio al abrir").toBe(90000);
  });

  it("UNA SOLA ABIERTA POR VENTA: dos casos vivos revertirian el ingreso dos veces", async () => {
    const { abrirReversa } = await import("@/modules/payments/data/reversas-writer");
    const id = await ventaPagada();
    const abrir = () =>
      abrirReversa({
        transactionId: id,
        tipo: "contracargo",
        referenciaDeLaDisputa: null,
        montoDebitado: null,
        debitadoEn: null,
        nota: null,
        actorId: null,
      });
    expect(await abrir()).toEqual(expect.any(String));
    expect(await abrir(), "la segunda no se abre").toBeNull();
  });

  it("solo se abre sobre una venta PAGADA: sin cobro no hay nada que devolver", async () => {
    const { abrirReversa, ReversaError } = await import("@/modules/payments/data/reversas-writer");
    const { db } = await import("@/db");
    const id = randomUUID();
    await db.execute(dsql`
      insert into transactions (id, organization_id, status, amount, currency, payment_method, wompi_env,
                                idempotency_key, alegra_invoice_state)
      values (${id}, ${orgId}, 'pending', '90000', 'COP', 'wompi', 'test', ${`rev-p-${id}`}, 'pendiente')`);
    creadas.push(id);
    await expect(
      abrirReversa({ transactionId: id, tipo: "contracargo", referenciaDeLaDisputa: null, montoDebitado: null, debitadoEn: null, nota: null, actorId: null }),
    ).rejects.toBeInstanceOf(ReversaError);
  });

  it("GANAR cierra sin tocar el ingreso; PERDER lo revierte con filas negativas", async () => {
    const { abrirReversa, resolverReversa } = await import("@/modules/payments/data/reversas-writer");
    const { db } = await import("@/db");
    const [actor] = await db.execute<{ id: string }>(dsql`select id from profiles limit 1`);

    const ganada = await ventaPagada();
    const rGanada = await abrirReversa({ transactionId: ganada, tipo: "contracargo", referenciaDeLaDisputa: null, montoDebitado: null, debitadoEn: null, nota: null, actorId: null });
    await resolverReversa({ reversaId: rGanada!, resultado: "ganada", referenciaDeLaRespuesta: "BANCO-OK", actorId: actor.id });
    expect(await ingresoNeto(ganada), "ganar no mueve plata").toBe(90000);

    const perdida = await ventaPagada();
    const rPerdida = await abrirReversa({ transactionId: perdida, tipo: "contracargo", referenciaDeLaDisputa: null, montoDebitado: null, debitadoEn: null, nota: null, actorId: null });
    const res = await resolverReversa({ reversaId: rPerdida!, resultado: "perdida", referenciaDeLaRespuesta: "BANCO-NO", actorId: actor.id });
    expect(res.revirtio).toBe(true);
    expect(await ingresoNeto(perdida), "perder saca la venta de las cifras, sin borrar la fila original").toBe(0);
    const [filas] = await db.execute<{ n: number }>(dsql`
      select count(*)::int as n from cnv_revenue where transaction_id = ${perdida}`);
    expect(Number(filas.n), "el rastro de que existio y se revirtio es parte del control").toBe(2);

    await expect(
      resolverReversa({ reversaId: rPerdida!, resultado: "perdida", referenciaDeLaRespuesta: "OTRA", actorId: actor.id }),
      "resolver dos veces revertiria el ingreso dos veces",
    ).rejects.toThrow();
  });

  it("LA NOTA CREDITO SOLO SOBRE UNA PERDIDA: sobre una disputa viva anularia una factura valida", async () => {
    const { abrirReversa, registrarNotaCreditoDeReversa, resolverReversa } = await import("@/modules/payments/data/reversas-writer");
    const { db } = await import("@/db");
    const [actor] = await db.execute<{ id: string }>(dsql`select id from profiles limit 1`);
    const id = await ventaPagada();
    const reversaId = await abrirReversa({ transactionId: id, tipo: "contracargo", referenciaDeLaDisputa: null, montoDebitado: null, debitadoEn: null, nota: null, actorId: null });
    expect(await registrarNotaCreditoDeReversa(reversaId!, "NC-X"), "sobre una disputa abierta").toBe(false);
    await resolverReversa({ reversaId: reversaId!, resultado: "perdida", referenciaDeLaRespuesta: "BANCO-NO", actorId: actor.id });
    expect(await registrarNotaCreditoDeReversa(reversaId!, "NC-4")).toBe(true);
    expect(await registrarNotaCreditoDeReversa(reversaId!, "NC-5"), "ya tenia la suya").toBe(false);
  });

  it("UN VOIDED SOBRE UNA VENTA PAGADA ABRE EL CASO; sobre una que no lo esta, no es una reversa", async () => {
    const { abrirPorAnulacionDeWompi } = await import("@/modules/payments/services/reversas-service");
    const { db } = await import("@/db");
    const pagada = await ventaPagada();
    expect(await abrirPorAnulacionDeWompi(pagada, "VOIDED", "wompi-1"), "hasta hoy esto se ignoraba en silencio").toBe(true);
    const [r] = await db.execute<{ kind: string; state: string }>(dsql`
      select kind, state from sale_reversals where transaction_id = ${pagada}`);
    expect(r).toMatchObject({ kind: "anulacion_wompi", state: "abierta" });

    const id = randomUUID();
    await db.execute(dsql`
      insert into transactions (id, organization_id, status, amount, currency, payment_method, wompi_env,
                                idempotency_key, alegra_invoice_state)
      values (${id}, ${orgId}, 'pending', '90000', 'COP', 'wompi', 'test', ${`rev-v-${id}`}, 'pendiente')`);
    creadas.push(id);
    expect(await abrirPorAnulacionDeWompi(id, "DECLINED", "wompi-2"), "un rechazo normal no es una reversa").toBe(false);
  });

  it("LA REVERSA ENTRA EN LA COLA DE PENDIENTES del Bloque A, con su plazo", async () => {
    const { abrirReversa } = await import("@/modules/payments/data/reversas-writer");
    const { listarPendientesDeAccion } = await import("@/modules/avisos/data/avisos-repository");
    const id = await ventaPagada();
    await abrirReversa({ transactionId: id, tipo: "contracargo", referenciaDeLaDisputa: null, montoDebitado: null, debitadoEn: null, nota: null, actorId: null });
    const p = (await listarPendientesDeAccion()).find((x) => x.transactionId === id && x.tipo === "reversa");
    expect(p, "una reversa que no avisa es un control que nadie mira").toBeDefined();
    expect(p!.causa).toContain("responderle al banco");
    expect(p!.diasHabilesDePlazo, "3 dias habiles: sin respuesta a tiempo la disputa se pierde").toBe(3);
  });
});
