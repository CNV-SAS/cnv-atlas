import { readFileSync } from "node:fs";

import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ═══ EL AVISO DEL AMBIENTE: QUE EXISTA, QUE CUENTE BIEN Y QUE LEA LA MISMA FUENTE ═══
//
// ── EL FILO QUE ESTO VIGILA (2026-10-15) ────────────────────────────────────────────────────────
//
// `wompi_env` se sella AL CREAR la venta, y vale para TODOS los medios de pago (efectivo y transferencia
// tambien). Con las llaves en sandbox, una venta REAL nace como pago de prueba y Atlas NO LA VA A FACTURAR
// NUNCA en produccion, ni cuando se monten las llaves.
//
// Santiago, 2026-10-15: *"la ventana entre que yo cierre el smoke y monte las llaves es justo cuando Katherine
// podria vender, y nadie estaria mirando"*.
//
// ── Y POR QUE CONTRA BASE REAL ──────────────────────────────────────────────────────────────────
//
// La cifra se arma con los TRES predicados exportados de la cola de facturacion, interpolados en SQL. Un
// nombre de columna equivocado ahi compila verde y revienta (o peor, cuenta otro universo) cuando la pantalla
// la pide. Es la misma clase de cosa que ya rompio el conteo de la franja.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const SELLO = `ZZ-AMBIENTE-${Date.now()}`;
let organizationId = "";
let actorId = "";

describe.skipIf(!HAS_DB)("el aviso del sello del ambiente (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [p] = await db.execute<{ id: string; org: string }>(dsql`
      select id, organization_id as org from profiles order by created_at limit 1`);
    organizationId = p.org;
    actorId = p.id;
  }, 30_000);

  afterAll(async () => {
    if (!HAS_DB) return;
    const { db } = await import("@/db");
    await db.execute(dsql`delete from transactions where idempotency_key like ${`${SELLO}%`}`);
  }, 30_000);

  async function cuantas(): Promise<number> {
    const { contarVentasRealesConSelloDePrueba } = await import(
      "@/modules/payments/data/facturacion-repository"
    );
    return contarVentasRealesConSelloDePrueba();
  }

  it("una venta REAL con el sello de prueba se cuenta; con el sello de producción, no", async () => {
    const { db } = await import("@/db");
    const antes = await cuantas();

    await db.execute(dsql`
      insert into transactions (organization_id, status, amount, currency, wompi_env, idempotency_key)
      values (${organizationId}::uuid, 'paid', 90000, 'COP', 'test', ${`${SELLO}-test`})`);
    expect(await cuantas(), "la venta sellada como prueba tenía que entrar al conteo").toBe(antes + 1);

    await db.execute(dsql`
      insert into transactions (organization_id, status, amount, currency, wompi_env, idempotency_key)
      values (${organizationId}::uuid, 'paid', 90000, 'COP', 'produccion', ${`${SELLO}-prod`})`);
    expect(await cuantas(), "la venta de producción no tiene el problema y no se cuenta").toBe(antes + 1);
  }, 60_000);

  it("una venta MARCADA como prueba no se cuenta: no es un problema, es una prueba", async () => {
    const { db } = await import("@/db");
    const antes = await cuantas();
    await db.execute(dsql`
      insert into transactions (organization_id, status, amount, currency, wompi_env, idempotency_key,
                                marcada_como_prueba_at, marcada_como_prueba_motivo, marcada_como_prueba_por)
      values (${organizationId}::uuid, 'paid', 90000, 'COP', 'test', ${`${SELLO}-marcada`},
              now(), 'Smoke del candado', ${actorId}::uuid)`);
    expect(await cuantas()).toBe(antes);
  }, 60_000);

  it("una venta YA FACTURADA Y PAGADA no se cuenta: el conteo es de lo que la cola querría emitir", async () => {
    const { db } = await import("@/db");
    const antes = await cuantas();
    await db.execute(dsql`
      insert into transactions (organization_id, status, amount, currency, wompi_env, idempotency_key,
                                alegra_invoice_state, alegra_payment_id)
      values (${organizationId}::uuid, 'paid', 90000, 'COP', 'test', ${`${SELLO}-cerrada`},
              'emitida', 'pago-1')`);
    expect(await cuantas()).toBe(antes);
  }, 60_000);

  it("el conteo usa los TRES predicados de la cola, no una condición propia", () => {
    const fuente = readFileSync("src/modules/payments/data/facturacion-repository.ts", "utf8");
    const cuerpo = fuente.slice(fuente.indexOf("export async function contarVentasRealesConSelloDePrueba"));
    const consulta = cuerpo.slice(0, cuerpo.indexOf("\n}"));
    // SI ALGUIEN LOS REEMPLAZA POR UNA CONDICION A MANO, la pantalla contaria un universo distinto del que
    // lista el guard de las llaves, y las dos cifras se contradirian sin que nada avise.
    for (const predicado of ["LE_FALTA_ALGO", "FACTURABLE", "LA_FACTURA_ES_DE_CNV"]) {
      expect(consulta, `falta ${predicado}`).toContain(`\${${predicado}}`);
    }
    expect(consulta).toContain("not cuenta_como_de_prueba");
    expect(consulta).toContain("wompi_env = 'test'");
  });

  it("la pantalla deriva el ambiente de la MISMA función que lo sella, no de una comparación propia", () => {
    const pagina = readFileSync("src/app/(app)/pagos/page.tsx", "utf8");
    // La funcion es la unica fuente: `wompiEnvDeLaLlave` es la que estampa `wompi_env` al crear la venta. Si
    // la pantalla comparara el prefijo por su cuenta, podria decir "producción" mientras las ventas nacen en
    // prueba, que es justo la contradiccion que este aviso existe para no tener.
    const sinEspacios = pagina.replace(/\s+/g, "");
    // Sin el parentesis de cierre: prettier parte la llamada y le mete coma final.
    expect(sinEspacios).toContain("wompiEnvDeLaLlave(process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY");
    expect(sinEspacios).toContain('ambienteDelPago==="test"');
    // Y NO SE PUEDE ESCRIBIR A MANO EL PREFIJO en la pantalla.
    expect(pagina).not.toContain("pub_prod_");
  });
});
