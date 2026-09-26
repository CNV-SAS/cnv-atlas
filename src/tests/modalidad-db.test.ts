import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

// ═══ QUE EL CAMBIO DE MODALIDAD MANDE, CONTRA LA BASE (2026-09-25) ═══
//
// Es lo que Santiago pidio verificar: "que admin pueda cambiar a un profesional de modalidad y verificar que
// el cambio manda, aunque no se habilite a nadie todavia".
//
// TRES COSAS, Y LA TERCERA ES LA QUE DE VERDAD IMPORTA:
//
//   1 · que el cambio abra una vigencia y cierre la anterior sin dejar un dia con dos ni un dia con ninguna
//       (lo vigila el indice unico, asi que un cambio mal escrito FALLA en vez de quedar ambiguo);
//   2 · que no se pueda pasar a Distribucion sin declarar los requisitos;
//   3 · y QUE EL CAMBIO NO REESCRIBA EL PASADO: una venta anterior a la fecha de vigencia se sigue leyendo
//       bajo el regimen viejo. Es la razon entera de que la modalidad tenga vigencia en vez de ser una
//       columna, y lo que el modelo llama "no partir una liquidacion en dos regimenes" (§2).

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(process.env.DATABASE_URL);

let professionalId = "";
let actorId = "";

describe.skipIf(!HAS_DB)("el cambio de modalidad (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [prof] = await db.execute<{ id: string; profile_id: string }>(dsql`
      select pp.id, pp.profile_id from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by p.full_name limit 1`);
    professionalId = prof.id;
    actorId = prof.profile_id;
    // Se parte de sin filas, que es el estado de todos hoy (y significa comision).
    await db.execute(dsql`delete from professional_modalities where professional_id = ${professionalId}::uuid`);
  }, 30_000);

  afterAll(async () => {
    if (!HAS_DB) return;
    const { db } = await import("@/db");
    await db.execute(dsql`delete from professional_modalities where professional_id = ${professionalId}::uuid`);
  }, 30_000);

  it("sin ninguna fila es comisión, y no hace falta backfill", async () => {
    const { leerModalidad } = await import("@/modules/payments/data/modalidad-writer");
    const estado = await leerModalidad(professionalId);
    expect(estado.modalidad).toBe("comision");
    expect(estado.rigeDesde).toBeNull();
  }, 30_000);

  it("no deja pasar a Distribución sin declarar los requisitos", async () => {
    const { cambiarModalidad, ModalidadError } = await import("@/modules/payments/data/modalidad-writer");
    await expect(
      cambiarModalidad({
        professionalId,
        hacia: "distribucion",
        actorId,
        actorEmail: "direccion@cnv",
        requisitosVerificados: false,
        nota: null,
        ip: null,
      }),
    ).rejects.toThrow(ModalidadError);
  }, 30_000);

  it("el cambio NO rige hoy: rige desde el inicio del siguiente corte", async () => {
    const { cambiarModalidad, leerModalidad } = await import("@/modules/payments/data/modalidad-writer");
    const { rigeDesde } = await cambiarModalidad({
      professionalId,
      hacia: "distribucion",
      actorId,
      actorEmail: "direccion@cnv",
      requisitosVerificados: true,
      nota: "Candado del smoke",
      ip: null,
    });

    const estado = await leerModalidad(professionalId);
    // HOY SIGUE SIENDO COMISION. Es la parte contraintuitiva y la que un lector descuidado rompe leyendo "la
    // ultima fila" en vez de aplicar la regla de la fecha.
    expect(estado.modalidad).toBe("comision");
    expect(estado.pendiente).not.toBeNull();
    expect(estado.pendiente?.modalidad).toBe("distribucion");
    expect(estado.pendiente?.rigeDesde).toBe(rigeDesde);
    expect(rigeDesde > new Date().toISOString().slice(0, 10)).toBe(true);
  }, 30_000);

  it("y queda el acto en el audit, con desde/hacia y la fecha en que empieza", async () => {
    const { db } = await import("@/db");
    const [evento] = await db.execute<{ payload: Record<string, unknown> }>(dsql`
      select payload from clinical_audit_log
       where event = 'modalidad.cambiada' and entity_id = ${professionalId}
       order by created_at desc limit 1`);
    expect(evento).toBeDefined();
    expect(evento.payload.desde).toBe("comision");
    expect(evento.payload.hacia).toBe("distribucion");
    expect(evento.payload.rigeDesde).toBeTruthy();
  }, 30_000);

  it("pedirlo dos veces REEMPLAZA la decisión futura, no acumula dos", async () => {
    // Sin esto habria dos filas futuras y la del dia de corte podria ser cualquiera de las dos.
    const { cambiarModalidad } = await import("@/modules/payments/data/modalidad-writer");
    const { db } = await import("@/db");
    await cambiarModalidad({
      professionalId,
      hacia: "distribucion",
      actorId,
      actorEmail: "direccion@cnv",
      requisitosVerificados: true,
      nota: "Segunda vez",
      ip: null,
    });
    const [conteo] = await db.execute<{ n: number }>(dsql`
      select count(*)::int as n from professional_modalities
       where professional_id = ${professionalId}::uuid
         and valid_from > (now() at time zone 'America/Bogota')::date`);
    expect(Number(conteo.n)).toBe(1);
  }, 30_000);

  it("UNA SOLA VIGENTE, y lo garantiza la base", async () => {
    const { db } = await import("@/db");
    // Insertar una segunda sin valid_to tiene que reventar contra el indice unico. Si esto dejara de fallar,
    // "su modalidad" tendria dos respuestas y el sellado de una venta elegiria una cualquiera.
    await expect(
      db.execute(dsql`
        insert into professional_modalities (professional_id, modality, valid_from)
        values (${professionalId}::uuid, 'comision', '2030-01-01'::date)`),
    ).rejects.toThrow();
  }, 30_000);

  it("la modalidad de una venta se lee por SU fecha, así que el cambio no reescribe el pasado", async () => {
    const { modalidadEnLaFecha } = await import("@/modules/payments/modalidad");
    const { db } = await import("@/db");
    const filas = await db.execute<{ modality: string; valid_from: string; valid_to: string | null }>(dsql`
      select modality, valid_from::text as valid_from, valid_to::text as valid_to
        from professional_modalities where professional_id = ${professionalId}::uuid`);
    const vigencias = filas.map((f) => ({
      modality: f.modality as "comision" | "distribucion",
      validFrom: f.valid_from,
      validTo: f.valid_to,
    }));
    // Una venta de hace un año es del régimen de entonces, no del que empieza el mes que viene.
    expect(modalidadEnLaFecha(vigencias, "2025-09-25")).toBe("comision");
    // Y una del futuro, ya bajo el nuevo.
    expect(modalidadEnLaFecha(vigencias, "2030-12-31")).toBe("distribucion");
  }, 30_000);
});

// ═══ Y EL OTRO EXTREMO: QUE EL SELLADO DE UNA VENTA LA OBEDEZCA ═══
//
// Es la verificacion que Santiago pidio de verdad ("que el cambio MANDA"). Hasta hoy el sellado escribia
// `modality: "comision"` a mano, asi que la modalidad podia cambiar y no pasaba nada.
//
// SE INSERTA LA VIGENCIA DIRECTO EN SQL y no con `cambiarModalidad`, a proposito: el acto de admin se NIEGA a
// retroceder la fecha (rige desde el siguiente corte), y aqui hace falta una venta YA dentro del regimen. Lo
// que se prueba es el sellado, no el acto.
describe.skipIf(!HAS_DB)("el sellado de una venta obedece la modalidad (BD real)", () => {
  let organizationId = "";
  let patientId = "";
  let nutraceuticalId = "";

  beforeAll(async () => {
    const { db } = await import("@/db");
    const [prof] = await db.execute<{ id: string; profile_id: string; organization_id: string }>(dsql`
      select pp.id, pp.profile_id, p.organization_id
        from professional_profiles pp
        join profiles p on p.id = pp.profile_id
        join inventory_locations l on l.professional_id = pp.id and l.is_active
       order by p.full_name limit 1`);
    professionalId = prof.id;
    actorId = prof.profile_id;
    organizationId = prof.organization_id;
    const [pac] = await db.execute<{ id: string }>(dsql`select id from patients limit 1`);
    patientId = pac.id;
    const [n] = await db.execute<{ id: string }>(dsql`
      select id from nutraceuticals where coalesce(is_test, false) = false order by name limit 1`);
    nutraceuticalId = n.id;
  }, 30_000);

  async function ventaBajo(modalidad: "comision" | "distribucion") {
    const { db } = await import("@/db");
    const { registrarVentaRetroactiva } = await import("@/modules/payments/data/venta-retroactiva-writer");
    await db.execute(dsql`delete from professional_modalities where professional_id = ${professionalId}::uuid`);
    await db.execute(dsql`
      insert into professional_modalities (professional_id, modality, valid_from, decided_by)
      values (${professionalId}::uuid, ${modalidad}, '2026-01-01'::date, ${actorId}::uuid)`);

    const { id } = await registrarVentaRetroactiva({
      organizationId,
      patientId,
      professionalId,
      fecha: "2026-06-11",
      numeroDeFactura: `ZZ-MODALIDAD-${modalidad}-${Date.now()}`,
      medioDePago: "efectivo",
      lineas: [{ nutraceuticalId, cantidad: 1, precioUnitario: 90000 }],
      actorId,
      actorEmail: "direccion@cnv",
      ip: null,
    });
    const [linea] = await db.execute<{ modality: string; commission_amount: string; cnv_amount: string }>(dsql`
      select modality, commission_amount::text, cnv_amount::text
        from transaction_items where transaction_id = ${id}::uuid`);
    const [rev] = await db.execute<{ n: number }>(dsql`
      select count(*)::int as n from professional_revenue where transaction_id = ${id}::uuid`);
    return { linea, filasDeComision: Number(rev.n) };
  }

  it("en Comisión sella 'comision' y CREA la fila de comisión, que es la cuenta por pagar", async () => {
    const { linea, filasDeComision } = await ventaBajo("comision");
    expect(linea.modality).toBe("comision");
    expect(filasDeComision).toBe(1);
  }, 60_000);

  it("en Distribución sella 'distribucion' y NO crea comisión, porque nadie le debe un giro", async () => {
    // Su margen es un DESCUENTO COMERCIAL que ya se quedo (el paciente le pago a el). Crear la fila seria
    // prometerle un giro y, peor, meterlo en la liquidacion mensual, que en Distribucion no le aplica.
    const { linea, filasDeComision } = await ventaBajo("distribucion");
    expect(linea.modality).toBe("distribucion");
    expect(filasDeComision).toBe(0);
    // Y LO QUE CNV LE VA A FACTURAR SIGUE AHI, en la linea: es la base menos su descuento. Sin esto la venta
    // quedaria sin ninguna cifra y no habria de donde armar la factura quincenal.
    expect(Number(linea.cnv_amount)).toBeGreaterThan(0);
  }, 60_000);

  afterAll(async () => {
    if (!HAS_DB) return;
    const { db } = await import("@/db");
    await db.execute(dsql`delete from professional_modalities where professional_id = ${professionalId}::uuid`);
  }, 30_000);
});

// ═══ EL BLOQUEANTE DE DISTRIBUCION, Y QUE SU MOTIVO LLEGUE (2026-09-25) ═══
//
// Los dos caminos de venta de hoy asumen que cobra CNV. Bajo Distribucion el paciente le paga AL INTEGRANTE,
// asi que el enlace de pago mandaria plata a la cuenta equivocada y el "efectivo" diria que custodia dinero de
// CNV cuando es suyo. Se bloquea con el motivo dicho, en vez de registrar una venta cuyo significado es falso.
//
// Y SE PRUEBA QUE EL GUARD ES ALCANZABLE Y QUE SU MOTIVO SOBREVIVE: un guard correcto cuyo mensaje se pierde en
// un catch generico se siente como un defecto del sistema, no como una regla.
describe.skipIf(!HAS_DB)("el bloqueo de venta bajo Distribucion (BD real)", () => {
  afterAll(async () => {
    if (!HAS_DB) return;
    const { db } = await import("@/db");
    await db.execute(dsql`delete from professional_modalities where professional_id = ${professionalId}::uuid`);
  }, 30_000);

  it("en Comisión no bloquea nada", async () => {
    const { db } = await import("@/db");
    const { exigirRecaudoDeCnv } = await import("@/modules/payments/data/modalidad-writer");
    await db.execute(dsql`delete from professional_modalities where professional_id = ${professionalId}::uuid`);
    await expect(exigirRecaudoDeCnv(professionalId)).resolves.toBeUndefined();
  }, 30_000);

  it("en Distribución bloquea, y el motivo NOMBRA por qué y qué falta", async () => {
    const { db } = await import("@/db");
    const { exigirRecaudoDeCnv, ModalidadError } = await import("@/modules/payments/data/modalidad-writer");
    await db.execute(dsql`delete from professional_modalities where professional_id = ${professionalId}::uuid`);
    await db.execute(dsql`
      insert into professional_modalities (professional_id, modality, valid_from, decided_by)
      values (${professionalId}::uuid, 'distribucion', '2026-01-01'::date, ${actorId}::uuid)`);

    await expect(exigirRecaudoDeCnv(professionalId)).rejects.toThrow(ModalidadError);
    try {
      await exigirRecaudoDeCnv(professionalId);
    } catch (e) {
      const mensaje = (e as Error).message;
      // No basta con negarse: tiene que decir POR QUE (el paciente le paga a él) y QUE FALTA (el registro de
      // ventas bajo Distribución). Un "no se pudo" manda a buscar un fallo técnico donde hay una regla.
      expect(mensaje).toContain("Distribución");
      expect(mensaje).toContain("le paga a él");
      expect(mensaje).toContain("todavía no está en Atlas");
    }
  }, 30_000);

  it("una venta sin profesional no se bloquea: no hay modalidad de nadie", async () => {
    const { exigirRecaudoDeCnv } = await import("@/modules/payments/data/modalidad-writer");
    await expect(exigirRecaudoDeCnv(null)).resolves.toBeUndefined();
  }, 30_000);
});
