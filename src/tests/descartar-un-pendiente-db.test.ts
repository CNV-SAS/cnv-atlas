import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ CANDADO DEL DESCARTE DE UN PENDIENTE SIN SALIDA (0205) ═══
//
// QUE PROTEGE, y son dos cosas distintas:
//
//   1. QUE EL DESCARTE CALLE. Un descarte vigente saca el pendiente del correo y de la franja de aviso. Si esto
//      se rompiera, el mecanismo entero no serviria para nada: el ruido seguiria igual.
//   2. QUE EL DESCARTE CADUQUE. Es la mitad peligrosa. Si la caducidad no funciona, descartar una vez apaga el
//      aviso de esa venta PARA SIEMPRE, y entonces una venta que cambia (otra linea, otro intento de descuento)
//      deja de pedir accion sin que nadie lo haya decidido. El fallo seria SILENCIOSO, que es la forma que ya
//      nos costo seis defectos.
//
// VA CONTRA LA BASE porque ahi vive la regla: la huella la calcula una funcion de Postgres y la comparacion la
// hace el lector en SQL. Un test con la base mockeada probaria el mock.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("descartar un pendiente sin salida (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let repo: typeof import("@/modules/avisos/data/avisos-repository");
  let orgId: string;
  let profId: string;
  let actorId: string;
  let pacienteId: string;
  let productoId: string;
  let ventaId: string;

  const pendientes = async (opciones?: { incluirDescartados?: boolean }) =>
    (await repo.listarPendientesDeAccion(opciones)).filter(
      // SOLO EL sin_saldo DE ESTA VENTA. Filtrar por la venta a secas no sirve: la misma venta tambien genera
      // un pendiente sin_documento (esta pagada y sin factura), y contarlo hacia creer que el descarte no
      // callaba nada. Me paso al escribir este candado.
      (p) => p.transactionId === ventaId && p.tipo === "sin_saldo",
    );

  const huella = async (): Promise<string> => {
    const [f] = await db.execute(
      dsql`select public.huella_del_pendiente('sin_saldo', ${ventaId}::uuid) as h`,
    );
    return String(f.h);
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    repo = await import("@/modules/avisos/data/avisos-repository");
    const [prof] = await db.execute(dsql`
      select pp.id, p.organization_id, p.id as profile_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       where coalesce(pp.is_test, false) = false
       order by pp.created_at limit 1`);
    profId = prof.id;
    orgId = prof.organization_id;
    actorId = prof.profile_id;
    // UN PACIENTE PROPIO, no uno elegido con limit 1: un fixture que toma la primera fila que encuentra se
    // rompe el dia que esa fila cambia, y ya nos paso dos veces.
    const [pa] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number)
      values (${orgId}, 'CC', ${`DSC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`})
      returning id`);
    pacienteId = pa.id;
    const [n] = await db.execute(dsql`
      select id from nutraceuticals where coalesce(is_test, false) = false order by name limit 1`);
    productoId = n.id;
    const [t] = await db.execute(dsql`
      insert into transactions (organization_id, patient_id, professional_id, status, amount, currency,
                                payment_method, wompi_env, idempotency_key, stock_state)
      values (${orgId}, ${pacienteId}, ${profId}, 'paid', '90000', 'COP', 'efectivo', 'test',
              ${`descarte-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}, 'sin_saldo')
      returning id`);
    ventaId = t.id;
    await db.execute(dsql`
      insert into transaction_items (transaction_id, nutraceutical_id, quantity, unit_price)
      values (${ventaId}, ${productoId}, 1, '90000')`);
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db.execute(dsql`set session_replication_role = replica`);
    await db.execute(dsql`delete from clinical_audit_log where entity_id = ${ventaId}`);
    await db.execute(dsql`delete from pending_discards where transaction_id = ${ventaId}::uuid`);
    await db.execute(dsql`delete from transaction_items where transaction_id = ${ventaId}::uuid`);
    await db.execute(dsql`delete from transactions where id = ${ventaId}::uuid`);
    await db.execute(dsql`delete from patients where id = ${pacienteId}::uuid`);
    await db.execute(dsql`set session_replication_role = default`);
  });

  it("la venta sin saldo pide accion antes de descartarla", async () => {
    const vistos = await pendientes();
    expect(vistos.map((p) => p.tipo)).toContain("sin_saldo");
  });

  it("descartada con motivo, sale del correo; y la pantalla la sigue viendo con quien y por que", async () => {
    await repo.descartarPendiente({
      tipo: "sin_saldo",
      transactionId: ventaId,
      motivo: "Se conto la vitrina y cuadro: faltaba cargar una recepcion.",
      actorId,
      actorEmail: null,
    });

    // EL CORREO Y LA FRANJA: ya no la ven.
    expect((await pendientes()).length, "el descarte no saco el pendiente del correo").toBe(0);

    // LA PANTALLA: la ve, con el descarte, y NO como caducada.
    const [enPantalla] = await pendientes({ incluirDescartados: true });
    expect(enPantalla, "el panel dejo de ver la venta descartada: la escondio en vez de mostrarla").toBeTruthy();
    expect(enPantalla.descarte?.motivo).toContain("Se conto la vitrina");
    expect(enPantalla.descarte?.caducado).toBe(false);
  });

  it("y queda en el audit, porque apagar un control lleva firma", async () => {
    const [f] = await db.execute(dsql`
      select count(*)::int as n from clinical_audit_log
       where event = 'pendiente.descartado' and entity_id = ${ventaId}`);
    expect(Number(f.n)).toBe(1);
  });

  // ═══ LA MITAD QUE DE VERDAD IMPORTA ═══
  it("si el hecho cambia, el descarte CADUCA y el pendiente vuelve al correo", async () => {
    const antes = await huella();
    // EL HECHO CAMBIA: un reintento del descuento que vuelve a fallar, por otra razon.
    await db.execute(dsql`
      update transactions set stock_last_error = 'No alcanzo el saldo: faltan 2 unidades'
       where id = ${ventaId}::uuid`);
    expect(await huella(), "la huella no cambio cuando el hecho cambio: entonces nunca va a caducar").not.toBe(
      antes,
    );

    const vistos = await pendientes();
    expect(vistos.length, "el descarte siguio callando un hecho que ya habia cambiado").toBe(1);
    expect(vistos[0].descarte?.caducado, "volvio al correo pero sin decir que venia de un descarte caducado").toBe(
      true,
    );
  });

  it("una linea nueva tambien lo caduca: el juicio era sobre otras unidades", async () => {
    // Se descarta sobre el hecho de ahora (el descarte anterior se revoca solo, que es lo que permite rejuzgar).
    await repo.descartarPendiente({
      tipo: "sin_saldo",
      transactionId: ventaId,
      motivo: "Contado otra vez el 3 de octubre, con el faltante registrado.",
      actorId,
      actorEmail: null,
    });
    expect((await pendientes()).length).toBe(0);

    await db.execute(dsql`
      insert into transaction_items (transaction_id, nutraceutical_id, quantity, unit_price)
      values (${ventaId}, ${productoId}, 3, '30000')`);
    expect((await pendientes()).length, "agregar unidades no caduco el descarte").toBe(1);
  });

  it("reactivar no borra el descarte: lo revoca, y la venta vuelve a pedir accion", async () => {
    await repo.descartarPendiente({
      tipo: "sin_saldo",
      transactionId: ventaId,
      motivo: "Descartada de nuevo para probar la reactivacion.",
      actorId,
      actorEmail: null,
    });
    expect((await pendientes()).length).toBe(0);

    await repo.reactivarPendiente({ tipo: "sin_saldo", transactionId: ventaId, actorId, actorEmail: null });
    expect((await pendientes()).length, "reactivar no devolvio el pendiente").toBe(1);

    // EL HISTORIAL SE QUEDA: tres descartes y sus revocaciones, ninguno borrado.
    const [f] = await db.execute(dsql`
      select count(*)::int as n, count(revoked_at)::int as revocados
        from pending_discards where transaction_id = ${ventaId}::uuid`);
    expect(Number(f.n), "los descartes anteriores se borraron en vez de quedar como historial").toBe(3);
    expect(Number(f.revocados)).toBe(3);
  });

  it("un motivo sin cuerpo lo rechaza la BASE, no solo la pantalla", async () => {
    await expect(
      db.execute(dsql`
        insert into pending_discards (kind, transaction_id, reason, fact_fingerprint, created_by)
        values ('sin_saldo', ${ventaId}::uuid, 'ok', 'x', ${actorId}::uuid)`),
    ).rejects.toThrow();
  });

  it("y un tipo sin huella definida REVIENTA, en vez de callar siempre", async () => {
    // Una huella vacia para un tipo nuevo aplicaria siempre y no caducaria nunca: el peor de los dos fallos.
    await expect(
      db.execute(dsql`select public.huella_del_pendiente('revision', ${ventaId}::uuid)`),
    ).rejects.toThrow();
  });
});
