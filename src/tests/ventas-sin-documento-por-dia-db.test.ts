import { randomUUID } from "node:crypto";

import { sql as dsql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

// ═══ EL REPORTE DE VENTAS SIN DOCUMENTO, CONSULTABLE POR DIA (paso 6 del 3.4) ═══
//
// El dia es el CIVIL DE COLOMBIA: una venta de las 9 p. m. de Bogota ya es el dia siguiente en UTC, y
// contabilidad cierra el dia de Bogota.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const creadas: string[] = [];

describe.skipIf(!HAS_DB)("ventas sin documento por dia (BD real)", () => {
  afterAll(async () => {
    const { db } = await import("@/db");
    for (const id of creadas) await db.execute(dsql`delete from transactions where id = ${id}`);
  });

  it("filtra por el dia de Bogota, y cuenta por dia", async () => {
    const { db } = await import("@/db");
    const { listarVentasSinDocumento, contarVentasSinDocumentoPorDia } = await import(
      "@/modules/payments/data/facturacion-repository"
    );
    const [org] = await db.execute<{ id: string }>(dsql`select id from organizations limit 1`);
    // Hace 3 dias a las 9 p. m. de Bogota (2 a. m. UTC del dia siguiente), y hace 3 dias al mediodia.
    const [f] = await db.execute<{ noche: string; mediodia: string; dia: string }>(dsql`
      select ((((now() at time zone 'America/Bogota')::date - 3) + time '21:00') at time zone 'America/Bogota')::text as noche,
             ((((now() at time zone 'America/Bogota')::date - 3) + time '12:00') at time zone 'America/Bogota')::text as mediodia,
             ((now() at time zone 'America/Bogota')::date - 3)::text as dia`);
    for (const creada of [f.noche, f.mediodia]) {
      const id = randomUUID();
      creadas.push(id);
      await db.execute(dsql`
        insert into transactions (id, organization_id, status, amount, currency, wompi_env, idempotency_key,
                                  alegra_invoice_state, created_at)
        values (${id}, ${org.id}, 'paid', 11900, 'COP', 'test', ${`por-dia-${id}`}, 'pendiente', ${creada}::timestamptz)`);
    }

    // ── EL TOPE VA MUY ALTO, Y NO ES PEREZA (2026-09-26) ──
    //
    // Este test fallo sin que nada del codigo cambiara: pedia 500 y el dia que le tocaba ("hace 3 dias") tenia
    // 569 ventas sin documento en la base local, asi que una de sus dos filas quedaba fuera del tope. Y fallo
    // solo al RODAR LA FECHA, porque el dia que mira se mueve cada dia: es la peor clase de test flaky, el que
    // se rompe sin que nadie toque nada y manda a buscar un defecto que no existe.
    //
    // LO QUE ESTE TEST COMPRUEBA ES EL FILTRO POR DIA CIVIL DE BOGOTA, no el tope del reporte. El tope es una
    // propiedad de la PANTALLA (cuantas filas muestra), asi que atarlo aqui mezcla dos cosas. Se pide muy por
    // encima de cualquier volumen diario real y el filtro se sigue comprobando entero.
    const TOPE_HOLGADO = 20_000;
    const delDia = await listarVentasSinDocumento(TOPE_HOLGADO, f.dia);
    expect(delDia.filter((v) => creadas.includes(v.id))).toHaveLength(2);
    // CONTROL: el dia siguiente (el de la noche en UTC) no las trae.
    const siguiente = await db.execute<{ d: string }>(dsql`select (${f.dia}::date + 1)::text as d`);
    const delSiguiente = await listarVentasSinDocumento(TOPE_HOLGADO, siguiente[0].d);
    expect(delSiguiente.filter((v) => creadas.includes(v.id))).toHaveLength(0);

    const conteo = await contarVentasSinDocumentoPorDia(30);
    expect(conteo.find((c) => c.dia === f.dia)?.total).toBeGreaterThanOrEqual(2);
  });
});
