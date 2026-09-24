import { randomUUID } from "node:crypto";

import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ═══ LA LIQUIDACION CONTRA LA BASE REAL (Bloque 4) ═══
//
// LO QUE SE PRUEBA AQUI SON INVARIANTES, NO CIFRAS. La aritmetica (IVA, tarifa de retencion, umbral de las
// 3.300 UVT) ya tiene su candado PURO, `liquidacion-comision`, donde los numeros son fijos porque no dependen
// de nada. Aqui se prueba lo que solo la base puede decir:
//
//   · que una comision causada se pague UNA VEZ (es el proposito del bloque);
//   · que una reversion que llega despues NETEE sola en la liquidacion siguiente (D-3b-2);
//   · y que una liquidacion YA PAGADA no se pueda borrar ni cambiar, porque borrarla dejaria sus comisiones
//     libres para liquidarse otra vez, que es pagar dos veces.
//
// ═══ Y NO CREA UN PROFESIONAL PROPIO, aunque seria mas comodo ═══
//
// Se intento (2026-09-24) y rompio cuatro tests de otros bloques: varios eligen profesional con un
// `limit 1` sin orden, asi que una fila nueva cambia CUAL les toca. Un fixture que agrega filas a una tabla
// que otros consultan sin filtro no es aislamiento, es contaminacion con otro nombre.
//
// Asi que se usa uno que ya existe, se le devuelven sus datos tributarios al terminar, y las cifras se toman
// de lo que el propio lector reporta como pendiente en vez de fijarse a mano.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(process.env.DATABASE_URL);

// Drizzle envuelve el error de Postgres en "Failed query: ...", asi que el mensaje del trigger (que es lo
// que se quiere afirmar) viaja en la causa. Sin mirar ahi, el caso pasaria con CUALQUIER fallo de SQL.
async function motivoDelRechazo(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
    return "";
  } catch (e) {
    const causa = (e as { cause?: { message?: string } }).cause;
    return causa?.message ?? (e as Error).message;
  }
}

let professionalId = "";
let actorId = "";
let organizationId = "";
let hoy = "";
const ventaDeLaComision = new Map<string, string>();

const original: { tipo: string | null; iva: boolean | null; factura: boolean | null } = {
  tipo: null,
  iva: null,
  factura: null,
};

// Devuelve el id de la FILA DE COMISION: las aserciones miran ESAS filas y no el agregado del profesional,
// porque otras pruebas de la suite le causan comisiones al mismo profesional mientras esta corre. Un total
// compartido no es una afirmacion estable; una fila propia, si.
async function causarComision(monto: number): Promise<string> {
  const { db } = await import("@/db");
  const id = randomUUID();
  await db.execute(dsql`
    insert into transactions (id, organization_id, status, amount, currency, payment_method, wompi_env,
                              idempotency_key)
    values (${id}, ${organizationId}, 'paid', ${String(monto)}, 'COP', 'efectivo', 'test',
            ${`zz-liq-${id}`})`);
  const [fila] = await db.execute<{ id: string }>(dsql`
    insert into professional_revenue (transaction_id, professional_id, commission_rate, commission_amount)
    values (${id}, ${professionalId}, '0.20', ${String(monto)})
    returning id`);
  ventaDeLaComision.set(fila.id, id);
  return fila.id;
}

/** La liquidacion que se llevo una fila de comision, o null si sigue pendiente. */
async function liquidacionDe(comisionId: string): Promise<string | null> {
  const { db } = await import("@/db");
  const [f] = await db.execute<{ settlement_id: string | null }>(
    dsql`select settlement_id from professional_revenue where id = ${comisionId}`,
  );
  return f?.settlement_id ?? null;
}

/** Lo que el lector de la pantalla dice de este profesional. */
async function loQueVeLaPantalla() {
  const { listarPendientesDeLiquidar } = await import("@/modules/payments/data/liquidacion-writer");
  const filas = await listarPendientesDeLiquidar(hoy);
  return filas.find((f) => f.professionalId === professionalId) ?? null;
}

describe.skipIf(!HAS_DB)("la liquidación de comisiones (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const { hoyEnBogota } = await import("@/modules/payments/data/liquidacion-writer");
    hoy = await hoyEnBogota();
    const [org] = await db.execute<{ id: string }>(dsql`select id from organizations limit 1`);
    organizationId = org.id;
    const [prof] = await db.execute<{
      id: string;
      profile_id: string;
      tax_person_type: string | null;
      tax_is_vat_responsible: boolean | null;
      tax_must_invoice: boolean | null;
    }>(dsql`
      select pp.id, pp.profile_id, pp.tax_person_type, pp.tax_is_vat_responsible, pp.tax_must_invoice
        from professional_profiles pp
        join profiles p on p.id = pp.profile_id
       order by pp.id limit 1`);
    professionalId = prof.id;
    actorId = prof.profile_id;
    original.tipo = prof.tax_person_type;
    original.iva = prof.tax_is_vat_responsible;
    original.factura = prof.tax_must_invoice;
    await db.execute(dsql`
      update professional_profiles
         set tax_person_type = 'natural', tax_is_vat_responsible = true, tax_must_invoice = true
       where id = ${professionalId}`);
  }, 30_000);

  afterAll(async () => {
    const { db } = await import("@/db");
    if (!professionalId) return;
    // Se le devuelven sus datos tributarios: el profesional es de la base, no de esta prueba.
    await db.execute(dsql`
      update professional_profiles
         set tax_person_type = ${original.tipo}, tax_is_vat_responsible = ${original.iva},
             tax_must_invoice = ${original.factura}
       where id = ${professionalId}`);
  });

  it("UNA COMISIÓN SE PAGA UNA VEZ: la segunda liquidación ya no la ve", async () => {
    const { liquidarHasta, LiquidacionError } = await import("@/modules/payments/data/liquidacion-writer");
    const comision = await causarComision(20_000);
    expect(await liquidacionDe(comision), "nació ya liquidada").toBeNull();

    const r = await liquidarHasta({ professionalId, hasta: hoy, actorId, actorEmail: "direccion@cnv", ip: null });
    expect(await liquidacionDe(comision), "la comisión no quedó marcada por su liquidación").toBe(r.id);

    // Y ya no queda nada libre: la segunda liquidación no encuentra comisiones sin dueño.
    await expect(
      liquidarHasta({ professionalId, hasta: hoy, actorId, actorEmail: "direccion@cnv", ip: null }),
    ).rejects.toBeInstanceOf(LiquidacionError);
  }, 30_000);

  it("una REVERSIÓN posterior netea sola en la siguiente, sin nada especial", async () => {
    const { db } = await import("@/db");
    const { liquidarHasta } = await import("@/modules/payments/data/liquidacion-writer");

    const comision = await causarComision(50_000);
    // La fila NEGATIVA de una comisión revertida (el efectivo que no se recibió, por ejemplo), contra la
    // MISMA venta.
    const [negativa] = await db.execute<{ id: string }>(dsql`
      insert into professional_revenue (transaction_id, professional_id, commission_rate, commission_amount)
      values (${ventaDeLaComision.get(comision)!}, ${professionalId}, '0.20', '-30000')
      returning id`);

    const r = await liquidarHasta({ professionalId, hasta: hoy, actorId, actorEmail: "direccion@cnv", ip: null });

    // LAS DOS ENTRARON EN LA MISMA, y eso es todo lo que hacía falta: la negativa nació sin liquidar, así
    // que entra igual que cualquier otra y netea. No hubo que escribir nada para que D-3b-2 se cumpla.
    expect(await liquidacionDe(comision)).toBe(r.id);
    expect(await liquidacionDe(negativa.id)).toBe(r.id);
  }, 30_000);

  it("una liquidación PAGADA no se borra, y su pago no se cambia", async () => {
    const { db } = await import("@/db");
    const { registrarPagoDeLiquidacion } = await import("@/modules/payments/data/liquidacion-writer");
    const [liq] = await db.execute<{ id: string }>(dsql`
      select id from commission_settlements where professional_id = ${professionalId} and paid_at is null
       order by created_at desc limit 1`);

    await registrarPagoDeLiquidacion({
      settlementId: liq.id,
      referencia: "TRANSF-PRUEBA",
      actorId,
      actorEmail: "direccion@cnv",
      ip: null,
    });

    // Borrarla dejaría sus comisiones libres para liquidarse otra vez, que es pagar dos veces.
    expect(
      await motivoDelRechazo(db.execute(dsql`delete from commission_settlements where id = ${liq.id}`)),
    ).toMatch(/no se borra/);
    expect(
      await motivoDelRechazo(
        db.execute(dsql`update commission_settlements set paid_at = now() - interval '5 days' where id = ${liq.id}`),
      ),
    ).toMatch(/no se cambia/);
  }, 30_000);

  it("una liquidación SIN GIRAR se descarta, y sus comisiones vuelven a quedar pendientes", async () => {
    const { liquidarHasta, descartarLiquidacion } = await import("@/modules/payments/data/liquidacion-writer");
    const comision = await causarComision(15_000);
    const r = await liquidarHasta({ professionalId, hasta: hoy, actorId, actorEmail: "direccion@cnv", ip: null });
    expect(await liquidacionDe(comision), "liquidar no retuvo la comisión").toBe(r.id);

    // Una liquidación mal hecha RETIENE comisiones: mientras viva, sus filas tienen dueño y no entran en la
    // siguiente, así que alguien se queda sin cobrar hasta que se resuelva.
    await descartarLiquidacion({ settlementId: r.id, actorId, actorEmail: "direccion@cnv", ip: null });
    expect(await liquidacionDe(comision), "la comisión no volvió a quedar libre").toBeNull();
  }, 30_000);

  it("y el lector de la pantalla ve al integrante con lo suyo pendiente", async () => {
    // El lector corre CONTRA LA BASE, que es lo que no prueba el candado puro: sin este caso, la pantalla
    // podria estar leyendo mal y todo lo demas seguiria en verde.
    await causarComision(7_000);
    const visto = await loQueVeLaPantalla();
    expect(visto, "el integrante con comisiones pendientes no sale en la pantalla").toBeTruthy();
    expect(visto!.filas).toBeGreaterThan(0);
    expect(visto!.perfil.tipoDePersona).toBe("natural");
  }, 30_000);

  it("sin datos tributarios NO se liquida, y dice cuáles faltan", async () => {
    const { db } = await import("@/db");
    const { liquidarHasta, LiquidacionError } = await import("@/modules/payments/data/liquidacion-writer");
    await db.execute(dsql`update professional_profiles set tax_person_type = null where id = ${professionalId}`);
    const comision = await causarComision(10_000);
    const intento = liquidarHasta({ professionalId, hasta: hoy, actorId, actorEmail: "direccion@cnv", ip: null });
    await expect(intento).rejects.toBeInstanceOf(LiquidacionError);
    await expect(intento).rejects.toThrow(/datos tributarios/);
    await db.execute(dsql`
      update professional_profiles set tax_person_type = 'natural' where id = ${professionalId}`);
    // Y la comisión que no se pudo liquidar sigue pendiente, no se perdió.
    expect(await liquidacionDe(comision)).toBeNull();
  }, 30_000);
});
