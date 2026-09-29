import { eq, sql as dsql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// CANDADO DE LA ALERTA DE VENCIMIENTO CONTRA LA BD REAL (0186).
//
// LO QUE PROTEGE, y las cuatro cosas son de la misma pieza: la fila de la alerta es lo que determina QUIEN
// ASUME un lote vencido, asi que tiene que ser (1) unica por lote y ubicacion, (2) inmutable en todo lo que
// es prueba, (3) con la fecha de vista puesta UNA sola vez, y (4) borrable solo mientras nadie la vio.
//
// POR QUE CONTRA LA BD Y NO EN UN TEST DE UNIDAD: las cuatro viven en un indice unico y un trigger. tsc no ve
// ninguna, y ya paso una vez que un CHECK escrito a mano no comprobaba nada (0181: con la columna nula
// evaluaba a NULL, y en Postgres un CHECK que evalua a NULL PASA).
//
// Se auto-salta sin DATABASE_URL.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("la alerta de vencimiento (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let lotId: string;
  let locationId: string;
  let nutraId: string;
  let profileId: string;
  const alertas: string[] = [];

  async function nuevaAlerta(extra: Record<string, unknown> = {}): Promise<string> {
    const [a] = await db
      .insert(schema.lotExpiryAlerts)
      .values({
        lotId,
        locationId,
        nutraceuticalId: nutraId,
        professionalId: null,
        expiresOn: "2026-12-31",
        unitsAtAlert: 3,
        daysAhead: 60,
        ...extra,
      })
      .returning({ id: schema.lotExpiryAlerts.id });
    alertas.push(a.id);
    return a.id;
  }

  // DRIZZLE ENVUELVE EL ERROR DE POSTGRES: el mensaje de arriba es "Failed query: ..." y el del trigger queda
  // en la causa. Sin mirar la causa, un candado que dice "rechaza" pasaria con CUALQUIER fallo de la consulta,
  // incluido un nombre de columna mal escrito, que es justo lo que no se quiere dar por bueno.
  async function rechazaCon(fn: () => Promise<unknown>, re: RegExp) {
    let mensaje = "";
    try {
      await fn();
    } catch (e) {
      const err = e as { message?: string; cause?: { message?: string } };
      mensaje = `${err.cause?.message ?? ""} ${err.message ?? ""}`;
    }
    expect(mensaje).toMatch(re);
  }

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    nutraId = "77777777-7777-7777-7777-777777777702"; // MULTICELL, producto dedicado a pruebas
    const [prof] = await db
      .select({ pid: schema.professionalProfiles.profileId })
      .from(schema.professionalProfiles)
      .orderBy(schema.professionalProfiles.createdAt)
      .limit(1);
    profileId = prof.pid;
    // SE USA LA CUARENTENA, que ya existe y es UNICA (indice loc_una_cuarentena, por eso no se crea otra).
    // Y conviene: las lecturas de vencimientos filtran por , asi que nada de lo que esta prueba
    // inserte puede aparecer en una pantalla ni en el correo de otro test.
    const [loc] = await db
      .select({ id: schema.inventoryLocations.id })
      .from(schema.inventoryLocations)
      .where(eq(schema.inventoryLocations.kind, "cuarentena"))
      .limit(1);
    locationId = loc.id;
    const [lot] = await db
      .insert(schema.lots)
      .values({ nutraceuticalId: nutraId, code: `TEST-VENC-${Date.now()}`, expiresOn: "2026-12-31" })
      .returning({ id: schema.lots.id });
    lotId = lot.id;
  });

  // SE BORRA POR LOTE, no por los ids recogidos: varios de estos casos esperan que un insert FALLE, y de un
  // insert que falla no hay id que recoger. Con el indice unico (lote, ubicacion), una fila que sobreviva
  // hace fallar al siguiente caso por un motivo que no es el suyo.
  afterEach(async () => {
    await db.execute(dsql`delete from lot_expiry_alerts where lot_id = ${lotId}`);
    alertas.length = 0;
  });

  // LA IDEMPOTENCIA NO ES COMODIDAD: sin ella la tarea diaria regeneraria la alerta cada mañana y su fecha
  // diria siempre "te avise ayer", con lo que el registro que decide quien paga no valdria nada.
  it("solo admite UNA alerta por lote y ubicacion", async () => {
    await nuevaAlerta();
    await expect(nuevaAlerta()).rejects.toThrow();
  });

  it("no se puede mover lo que es prueba: los dias de anticipacion", async () => {
    const id = await nuevaAlerta();
    await rechazaCon(
      () => db.update(schema.lotExpiryAlerts).set({ daysAhead: 5 }).where(eq(schema.lotExpiryAlerts.id, id)),
      /no se edita/i,
    );
  });

  it("ni la fecha de vencimiento sellada, ni las unidades", async () => {
    const id = await nuevaAlerta();
    await rechazaCon(
      () => db.update(schema.lotExpiryAlerts).set({ expiresOn: "2027-12-31" }).where(eq(schema.lotExpiryAlerts.id, id)),
      /no se edita/i,
    );
    await rechazaCon(
      () => db.update(schema.lotExpiryAlerts).set({ unitsAtAlert: 99 }).where(eq(schema.lotExpiryAlerts.id, id)),
      /no se edita/i,
    );
  });

  it("la marca de vista se pone una vez y no se mueve", async () => {
    const id = await nuevaAlerta();
    await db
      .update(schema.lotExpiryAlerts)
      .set({ seenAt: new Date("2026-09-20T15:00:00Z"), seenBy: profileId })
      .where(eq(schema.lotExpiryAlerts.id, id));
    // Un segundo intento con OTRA fecha se rechaza: moverla hacia adelante es lo que le conviene a quien
    // quiera discutir el cargo.
    await rechazaCon(
      () =>
        db
          .update(schema.lotExpiryAlerts)
          .set({ seenAt: new Date("2026-09-27T15:00:00Z"), seenBy: profileId })
          .where(eq(schema.lotExpiryAlerts.id, id)),
      /ya estaba marcada vista/i,
    );
  });

  it("las dos mitades de la vista viajan juntas", async () => {
    // Sin `seen_by`, el CHECK rechaza. Este es el caso que la 0181 dejo pasar por la logica de tres valores:
    // aqui se comprueba que este CHECK si evalua.
    await expect(nuevaAlerta({ seenAt: new Date() })).rejects.toThrow();
  });

  it("una alerta VISTA ya no se puede borrar como no entregada", async () => {
    const repo = await import("@/modules/nutraceuticals/data/vencimientos-repository");
    const id = await nuevaAlerta();
    await db
      .update(schema.lotExpiryAlerts)
      .set({ seenAt: new Date(), seenBy: profileId })
      .where(eq(schema.lotExpiryAlerts.id, id));
    await repo.borrarAlertaNoEntregada(id);
    const quedan = await db
      .select({ id: schema.lotExpiryAlerts.id })
      .from(schema.lotExpiryAlerts)
      .where(eq(schema.lotExpiryAlerts.id, id));
    // Sigue ahi: describe algo que SI paso (alguien la vio), asi que no se borra pase lo que pase con el correo.
    expect(quedan).toHaveLength(1);
  });

  it("una alerta sin ver SI se borra: el correo no salio, asi que no se aviso", async () => {
    const repo = await import("@/modules/nutraceuticals/data/vencimientos-repository");
    const id = await nuevaAlerta();
    await repo.borrarAlertaNoEntregada(id);
    const quedan = await db
      .select({ id: schema.lotExpiryAlerts.id })
      .from(schema.lotExpiryAlerts)
      .where(eq(schema.lotExpiryAlerts.id, id));
    expect(quedan).toHaveLength(0);
  });

  // LA VENTANA VIVE EN CONFIGURACION, no en el codigo (principio 2 del modelo comercial). Y no puede
  // apagarse poniendola en cero, porque apagar la alerta es cambiar quien asume los vencidos.
  it("la ventana de alerta esta en configuracion y no admite cero", async () => {
    const dias = await db.execute(
      dsql`select dias_alerta_vencimiento as d from commercial_config limit 1`,
    );
    if (dias.length > 0) expect(Number(dias[0].d)).toBeGreaterThan(0);
    await expect(
      db.execute(dsql`update commercial_config set dias_alerta_vencimiento = 0`),
    ).rejects.toThrow();
  });
});
