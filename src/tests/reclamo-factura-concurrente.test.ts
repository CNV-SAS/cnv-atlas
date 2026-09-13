import { randomUUID } from "node:crypto";

import { sql as dsql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

// ═══ DOS RECLAMOS SIMULTANEOS: GANA UNO, Y SOLO UNO ═══
//
// POR QUE ESTO ES UN TEST Y NO UN PASO DEL SMOKE (2026-09-13). El smoke pedia pulsar el boton de
// reintentar dos veces seguidas. Santiago lo pulso muchas veces, y NO SE EJERCITO: el boton se deshabilita
// mientras corre, asi que cada pulsacion esperaba a que terminara la anterior. Pulsaciones SECUENCIALES,
// que nunca compiten por la misma fila.
//
// El caso que el reclamo con arriendo protege es el SIMULTANEO: dos pestañas, o un webhook de Wompi que
// llega mientras alguien pulsa el boton. Ese no se produce a mano con fiabilidad, porque depende de que
// dos peticiones caigan en la misma ventana de milisegundos.
//
// Aqui se produce a proposito: dos llamadas LANZADAS A LA VEZ contra la base real, y se mide que solo una
// obtiene la fila. Es mas fuerte que el smoke, no un sustituto peor: el smoke dependeria de la suerte del
// tiempo, esto no.
//
// SE MIDE CONTRA BD REAL porque lo que se prueba ES Postgres serializando un UPDATE condicional. Un mock
// diria lo que el mock quiera.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const creadas: string[] = [];

async function ventaPagada(estado: string | null, paymentId: string | null, hace = "1 hour") {
  const { db } = await import("@/db");
  const id = randomUUID();
  await db.execute(dsql`
    insert into transactions (id, organization_id, amount, status, idempotency_key, wompi_env,
                              alegra_invoice_state, alegra_payment_id, alegra_last_attempt_at)
    select ${id}, o.id, 107100, 'paid', ${`test-reclamo-${id}`}, 'test',
           ${estado}::alegra_invoice_state, ${paymentId},
           now() - ${hace}::interval
      from organizations o limit 1`);
  creadas.push(id);
  return id;
}

describe.skipIf(!HAS_DB)("el reclamo con arriendo (BD real)", () => {
  afterAll(async () => {
    if (creadas.length === 0) return;
    const { db } = await import("@/db");
    for (const id of creadas) await db.execute(dsql`delete from transactions where id = ${id}`);
  });

  // ── EL CONTROL, SIN EL CUAL EL TEST DE ABAJO NO PROBARIA NADA ─────────────────────────────────
  //
  // La primera version de este archivo lanzaba diez reclamos y medía "gana uno", y pasaba. Pero al correr
  // un control con un leer-y-luego-escribir INGENUO (el `if` que el reclamo evita), TAMBIEN ganaba uno de
  // diez. O sea que las llamadas no estaban compitiendo: postgres.js abre las conexiones del pool de a una
  // y bajo demanda, asi que las primeras llamadas hacian fila en la misma conexion y se serializaban solas.
  //
  // El test pasaba por la razon equivocada, y habria seguido pasando con un reclamo roto.
  //
  // Con el pool CALIENTE (diez conexiones abiertas antes), el ingenuo deja ganar a las diez y el UPDATE
  // condicional a una. Por eso se calienta el pool y se corre el ingenuo aqui mismo: si el ingenuo dejara
  // de ganar varias, el entorno dejo de producir carreras y el test de abajo estaria midiendo nada.
  it("CONTROL: con el pool caliente, un leer-y-escribir ingenuo SÍ deja ganar a varias", async () => {
    const { db } = await import("@/db");
    await Promise.all(Array.from({ length: 10 }, () => db.execute(dsql`select pg_sleep(0.05)`)));
    const id = await ventaPagada("fallida", null, "1 day");

    const ingenuo = async () => {
      const [t] = await db.execute<{ alegra_last_attempt_at: string | null }>(
        dsql`select alegra_last_attempt_at from transactions where id = ${id}`,
      );
      if (t?.alegra_last_attempt_at && new Date(t.alegra_last_attempt_at) > new Date(Date.now() - 60_000)) {
        return false;
      }
      await new Promise((r) => setTimeout(r, 50)); // la ventana real entre leer y escribir
      await db.execute(dsql`update transactions set alegra_last_attempt_at = now() where id = ${id}`);
      return true;
    };
    const ganadoras = (await Promise.all(Array.from({ length: 10 }, ingenuo))).filter(Boolean);

    expect(
      ganadoras.length,
      "el control no reprodujo la carrera: las llamadas no están compitiendo y el test del reclamo no prueba nada",
    ).toBeGreaterThan(1);
  });

  it("DIEZ reclamos lanzados a la vez sobre la misma venta: exactamente UNO gana", async () => {
    // Diez y no dos: con dos, que salga bien puede ser que una llego un poco antes. Y con el pool CALIENTE,
    // que es lo que el control de arriba demuestra que hace falta para que compitan de verdad.
    const { db } = await import("@/db");
    await Promise.all(Array.from({ length: 10 }, () => db.execute(dsql`select pg_sleep(0.05)`)));
    const { reclamarParaFacturar } = await import("@/modules/payments/data/facturacion-repository");
    const id = await ventaPagada("fallida", null);

    const resultados = await Promise.all(Array.from({ length: 10 }, () => reclamarParaFacturar(id)));

    expect(
      resultados.filter(Boolean),
      "más de un reclamo ganó la misma venta: dos procesos emitirían dos facturas del mismo hecho",
    ).toHaveLength(1);
  });

  it("y el que pierde no puede volver a reclamarla hasta que venza el arriendo", async () => {
    const { reclamarParaFacturar } = await import("@/modules/payments/data/facturacion-repository");
    const id = await ventaPagada("fallida", null);

    expect(await reclamarParaFacturar(id)).toBe(true);
    // Inmediatamente despues, alguien pulsa otra vez. Tiene que irse sin tocar nada.
    expect(await reclamarParaFacturar(id)).toBe(false);
  });

  it("un arriendo VENCIDO se libera solo: un proceso muerto no deja la venta huérfana", async () => {
    // Es la razon de que sea arriendo y no candado permanente. Si un timeout mata el proceso a mitad, la
    // venta tiene que poder reintentarse; con un candado para siempre, se quedaria sin facturar y sin que
    // nadie pudiera tocarla.
    const { reclamarParaFacturar } = await import("@/modules/payments/data/facturacion-repository");
    const id = await ventaPagada("fallida", null, "3 minutes");
    expect(await reclamarParaFacturar(id)).toBe(true);
  });

  it("una venta COMPLETA (factura emitida y pago registrado) no se reclama nunca", async () => {
    const { reclamarParaFacturar } = await import("@/modules/payments/data/facturacion-repository");
    const id = await ventaPagada("emitida", "pago-123", "1 day");
    expect(await reclamarParaFacturar(id)).toBe(false);
  });

  it("pero una EMITIDA con el pago sin registrar sí, que era el hueco del panel", async () => {
    // Las seis ventas del smoke con el pago fallido estaban `emitida`, y el reclamo de entonces las
    // excluia. Este caso es el que asegura que el boton puede volver a cobrarlas.
    const { reclamarParaFacturar } = await import("@/modules/payments/data/facturacion-repository");
    const id = await ventaPagada("emitida", null, "1 day");
    expect(await reclamarParaFacturar(id)).toBe(true);
  });
});
