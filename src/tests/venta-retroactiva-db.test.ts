import { sql as dsql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

// ═══ LA VENTA QUE YA OCURRIO, CONTRA LA BASE (Bloque R, 2026-09-23) ═══
//
// Lo que se protege aqui vive en la base y no se ve leyendo el codigo:
//
//   · que quede fechada CUANDO OCURRIO y no cuando se registro (es lo que tiene que coincidir con la
//     factura que ya se emitio, y es lo primero que mira una auditoria);
//   · que Atlas NO la persiga como pendiente de cobro, que es el caso que se descubrio al construirla: el
//     panel busca las emitidas sin pago registrado, y esta tiene su pago recibido por fuera;
//   · y que la base RECHACE una retroactiva a medias (sin numero de factura), porque el proposito entero
//     del bloque es poder cotejarla con Alegra.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const FECHA_REAL = "2026-06-11";
const FACTURA = `ZZ-FIXTURE-R-${Date.now()}`;

let organizationId = "";
let professionalId = "";
let patientId = "";
let nutraceuticalId = "";
let actorId = "";

describe.skipIf(!HAS_DB)("la venta retroactiva (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [prof] = await db.execute<{ id: string; profile_id: string; organization_id: string }>(dsql`
      select pp.id, pp.profile_id, p.organization_id
        from professional_profiles pp
        join profiles p on p.id = pp.profile_id
        join inventory_locations l on l.professional_id = pp.id and l.is_active
       limit 1`);
    professionalId = prof.id;
    actorId = prof.profile_id;
    organizationId = prof.organization_id;
    const [pac] = await db.execute<{ id: string }>(dsql`select id from patients limit 1`);
    patientId = pac.id;
    const [n] = await db.execute<{ id: string }>(dsql`
      select id from nutraceuticals where coalesce(is_test, false) = false order by name limit 1`);
    nutraceuticalId = n.id;
  }, 30_000);

  it("queda fechada cuando OCURRIÓ, con su factura, y sin id interno de Alegra", async () => {
    const { db } = await import("@/db");
    const { registrarVentaRetroactiva } = await import("@/modules/payments/data/venta-retroactiva-writer");

    const { id } = await registrarVentaRetroactiva({
      organizationId,
      patientId,
      professionalId,
      fecha: FECHA_REAL,
      numeroDeFactura: FACTURA,
      medioDePago: "efectivo",
      lineas: [{ nutraceuticalId, cantidad: 1, precioUnitario: 90000 }],
      actorId,
      actorEmail: "direccion@cnv",
      ip: null,
    });

    const [v] = await db.execute<{
      dia: string;
      numero: string;
      estado: string;
      alegra_id: string | null;
      retro: string | null;
      status: string;
      entrega: string | null;
    }>(dsql`
      select (created_at at time zone 'America/Bogota')::date::text as dia,
             alegra_invoice_number as numero, alegra_invoice_state as estado, alegra_invoice_id as alegra_id,
             registered_retroactively_at::text as retro, status, fulfillment_state as entrega
        from transactions where id = ${id}`);

    expect(v.dia, "la venta no quedó fechada el día en que ocurrió").toBe(FECHA_REAL);
    expect(v.numero).toBe(FACTURA);
    expect(v.estado).toBe("emitida");
    expect(v.alegra_id, "una retroactiva no tiene id interno de Alegra: Atlas nunca creó ese documento").toBeNull();
    expect(v.retro).toBeTruthy();
    expect(v.status).toBe("paid");
    // Su entrega ya ocurrió hace meses: dejarla pendiente la pondría en la lista de lo que hay que entregar.
    expect(v.entrega).toBe("entregado");
  }, 30_000);

  // ═══ LOS LECTORES DE LA PANTALLA, QUE ES LO QUE FALTABA (2026-09-24) ═══
  //
  // La pantalla no abria: la consulta leia el nombre del paciente de `patients`, donde no esta (vive en
  // `patient_profiles`). Los candados probaban el ESCRITOR entero y ninguno llamaba a los lectores, asi que
  // todo pasaba en verde sobre una pantalla que tiraba 500 al abrirse.
  //
  // LA LECCION, que es mas general que el bug: un candado que prueba lo que se ESCRIBE no dice nada de lo
  // que se LEE, y el profesional ve lo que se lee. Toda consulta que una pantalla vaya a correr se ejecuta
  // aqui aunque no se afirme mucho sobre el resultado: que corra contra la base real ya es la mitad.
  it("los lectores de la pantalla CORREN contra la base (la pantalla no abría)", async () => {
    const { listarVentasRetroactivas } = await import("@/modules/payments/data/venta-retroactiva-writer");
    const { leerContextoDeVentaRetroactiva } = await import(
      "@/modules/payments/data/venta-retroactiva-reader"
    );

    const listadas = await listarVentasRetroactivas();
    const mia = listadas.find((v) => v.factura === FACTURA);
    expect(mia, "la venta registrada no sale en el listado").toBeTruthy();
    expect(mia?.paciente, "el listado no trae el nombre del paciente").toBeTruthy();

    const contexto = await leerContextoDeVentaRetroactiva();
    expect(contexto).toBeTruthy();
    expect(contexto!.profesionales.length).toBeGreaterThan(0);
    expect(contexto!.pacientes.length).toBeGreaterThan(0);
    expect(contexto!.productos.length).toBeGreaterThan(0);
    // El rótulo del paciente lleva su documento: dos personas pueden llamarse igual, y equivocarse aquí le
    // cuelga a alguien una compra que no hizo.
    expect(contexto!.pacientes[0].nombre).toContain("·");
  }, 30_000);

  it("NO aparece como pendiente de facturar ni de cobrar", async () => {
    const { db } = await import("@/db");
    const { LE_FALTA_ALGO } = await import("@/modules/payments/data/facturacion-repository");
    const [f] = await db.execute<{ n: number }>(dsql`
      select count(*)::int as n from transactions
       where alegra_invoice_number = ${FACTURA} and ${LE_FALTA_ALGO}`);
    // Sin la condición de retroactividad daba 1: "emitida sin pago registrado" = el panel pidiendo cobrarle
    // otra vez a un paciente que ya pagó.
    expect(f.n).toBe(0);
  }, 30_000);

  it("y su contabilidad quedó sellada", async () => {
    const { db } = await import("@/db");
    const [f] = await db.execute<{ sellada: number; ingreso: number }>(dsql`
      select (select count(*)::int from transaction_items i
               join transactions t on t.id = i.transaction_id
              where t.alegra_invoice_number = ${FACTURA} and i.sealed_at is not null) as sellada,
             (select count(*)::int from cnv_revenue r
               join transactions t on t.id = r.transaction_id
              where t.alegra_invoice_number = ${FACTURA}) as ingreso`);
    expect(f.sellada).toBe(1);
    expect(f.ingreso).toBe(1);
  }, 30_000);

  it("la base rechaza una retroactiva sin el número de la factura", async () => {
    const { db } = await import("@/db");
    // El CHECK de la 0169: sin numero no sirve para nada, porque el proposito es poder cotejarla con Alegra.
    await expect(
      db.execute(dsql`
        insert into transactions (organization_id, status, amount, currency, wompi_env, idempotency_key,
                                  alegra_invoice_state, registered_retroactively_at, registered_retroactively_by)
        values (${organizationId}, 'paid', '1000', 'COP', 'test', ${`zz-sin-numero-${Date.now()}`},
                'emitida', now(), ${actorId})`),
    ).rejects.toThrow();
  }, 30_000);

  it("y rechaza registrar dos veces la misma factura", async () => {
    const { registrarVentaRetroactiva, VentaRetroactivaError } = await import(
      "@/modules/payments/data/venta-retroactiva-writer"
    );
    await expect(
      registrarVentaRetroactiva({
        organizationId,
        patientId,
        professionalId,
        fecha: FECHA_REAL,
        numeroDeFactura: FACTURA,
        medioDePago: "efectivo",
        lineas: [{ nutraceuticalId, cantidad: 1, precioUnitario: 90000 }],
        actorId,
        actorEmail: "direccion@cnv",
        ip: null,
      }),
    ).rejects.toBeInstanceOf(VentaRetroactivaError);
  }, 30_000);

  it("y no acepta una fecha futura", async () => {
    const { registrarVentaRetroactiva, VentaRetroactivaError } = await import(
      "@/modules/payments/data/venta-retroactiva-writer"
    );
    const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await expect(
      registrarVentaRetroactiva({
        organizationId,
        patientId,
        professionalId,
        fecha: manana,
        numeroDeFactura: `${FACTURA}-futura`,
        medioDePago: "efectivo",
        lineas: [{ nutraceuticalId, cantidad: 1, precioUnitario: 90000 }],
        actorId,
        actorEmail: "direccion@cnv",
        ip: null,
      }),
    ).rejects.toBeInstanceOf(VentaRetroactivaError);
  }, 30_000);
});
