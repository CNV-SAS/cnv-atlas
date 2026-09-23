import { sql as dsql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ═══ LA DEVOLUCION FISICA CONTRA LA BASE REAL (Bloque 3b, sesion 2, 2026-09-22) ═══
//
// La decision D-3b-3: lo que devuelve el paciente NO vuelve al lote vendible, entra a CUARENTENA, y solo una
// persona decide si se reincorpora o se da de baja. Lo que se protege aqui vive en la base y no se puede
// comprobar leyendo el codigo: a que UBICACION cae el saldo, y que las reglas de la 0168 rechazan lo que
// ninguna pantalla deberia poder mandar.
//
// SE MIDE POR DIFERENCIA (saldo antes vs. saldo despues) y el fixture es ESTABLE, no uno nuevo cada vez:
// los movimientos son APPEND-ONLY por trigger (registro de custodia), asi que no hay limpieza posible y
// una cifra absoluta quedaria atada a cuantas veces se corrio la prueba.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const NOMBRE_FIXTURE = "ZZ FIXTURE devolucion-fisica";
const LLAVE_FIXTURE = "zz-fixture-devolucion-fisica";

let professionalId = "";
let profileId = "";
let suyaId = "";
let cuarentenaId = "";
let nutraceuticalId = "";
let lotId = "";
let transactionId = "";
let lineaId = "";

describe.skipIf(!HAS_DB)("la devolución física (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [prof] = await db.execute<{ id: string; profile_id: string; location_id: string }>(dsql`
      select pp.id, pp.profile_id, l.id as location_id
        from professional_profiles pp
        join inventory_locations l on l.professional_id = pp.id and l.is_active and l.sellable
       where pp.profile_id is not null
       limit 1`);
    if (!prof) return;
    professionalId = prof.id;
    profileId = prof.profile_id;
    suyaId = prof.location_id;

    const [cuarentena] = await db.execute<{ id: string }>(
      dsql`select id from inventory_locations where kind = 'cuarentena' limit 1`,
    );
    cuarentenaId = cuarentena?.id ?? "";

    // Producto y lote propios y REUSADOS entre corridas (no se pueden borrar sus movimientos).
    const [existente] = await db.execute<{ id: string }>(
      dsql`select id from nutraceuticals where name = ${NOMBRE_FIXTURE} limit 1`,
    );
    if (existente) {
      nutraceuticalId = existente.id;
      const [lote] = await db.execute<{ id: string }>(
        dsql`select id from lots where nutraceutical_id = ${nutraceuticalId} limit 1`,
      );
      lotId = lote.id;
    } else {
      const [nutra] = await db.execute<{ id: string }>(dsql`
        insert into nutraceuticals (organization_id, name, commercial_availability, is_test)
        select p.organization_id, ${NOMBRE_FIXTURE}, 'en_consultorio', true
          from professional_profiles pp join profiles p on p.id = pp.profile_id
         where pp.id = ${professionalId}
        returning id`);
      nutraceuticalId = nutra.id;
      const [lote] = await db.execute<{ id: string }>(dsql`
        insert into lots (nutraceutical_id, code, expires_on)
        values (${nutraceuticalId}, 'FIXTURE-DEVOLUCION', current_date + 365)
        returning id`);
      lotId = lote.id;
    }

    // Existencias frescas de la corrida, y una venta de 4 unidades con su salida de inventario.
    await db.execute(dsql`
      insert into nutraceutical_stock_movements
        (professional_id, nutraceutical_id, location_id, lot_id, type, delta, reason)
      values (${professionalId}, ${nutraceuticalId}, ${suyaId}, ${lotId}, 'recepcion', 6, 'fixture devolución física')`);

    // LA VENTA TAMBIEN ES FIJA, y no por comodidad: el movimiento de inventario tiene un FK a la linea de
    // venta, asi que una venta de usar y tirar NO SE PUEDE BORRAR despues (la base defiende el registro de
    // custodia, que es justo lo que debe hacer). Se reusa una sola, y lo que crece cada corrida es la SALIDA:
    // asi "no se devuelven mas de las que salieron" sigue teniendo margen sin depender de limpiar nada.
    const [existenteTx] = await db.execute<{ id: string }>(
      dsql`select id from transactions where idempotency_key = ${LLAVE_FIXTURE}`,
    );
    if (existenteTx) {
      transactionId = existenteTx.id;
      const [linea] = await db.execute<{ id: string }>(
        dsql`select id from transaction_items where transaction_id = ${transactionId} limit 1`,
      );
      lineaId = linea.id;
    } else {
      const [tx] = await db.execute<{ id: string }>(dsql`
        insert into transactions (organization_id, status, amount, currency, payment_method, wompi_env,
                                  idempotency_key)
        select p.organization_id, 'pending', '0', 'COP', 'efectivo', 'test', ${LLAVE_FIXTURE}
          from professional_profiles pp join profiles p on p.id = pp.profile_id
         where pp.id = ${professionalId}
        returning id`);
      transactionId = tx.id;
      const [linea] = await db.execute<{ id: string }>(dsql`
        insert into transaction_items (transaction_id, nutraceutical_id, quantity, unit_price)
        values (${transactionId}, ${nutraceuticalId}, 4, '90000') returning id`);
      lineaId = linea.id;
    }
    await db.execute(dsql`
      insert into nutraceutical_stock_movements
        (professional_id, nutraceutical_id, location_id, lot_id, type, delta, reason, transaction_item_id)
      values (${professionalId}, ${nutraceuticalId}, ${suyaId}, ${lotId}, 'venta', -4, 'fixture venta', ${lineaId})`);
  }, 30_000);

  const saldo = async (locationId: string): Promise<number> => {
    const { db } = await import("@/db");
    const [r] = await db.execute<{ q: number }>(dsql`
      select coalesce(sum(stock_quantity), 0)::int as q from nutraceutical_inventory
       where location_id = ${locationId} and nutraceutical_id = ${nutraceuticalId} and lot_id = ${lotId}`);
    return Number(r?.q ?? 0);
  };

  it("lo devuelto entra a CUARENTENA, no al lote vendible", async () => {
    const { registrarDevolucionFisica, listarDevueltasPendientes } = await import(
      "@/modules/payments/data/devolucion-fisica-writer"
    );
    expect(cuarentenaId, "no existe la ubicación de cuarentena (migración 0164)").toBeTruthy();
    const vendibleAntes = await saldo(suyaId);
    const enEsperaAntes = await saldo(cuarentenaId);

    await registrarDevolucionFisica({
      transactionItemId: lineaId,
      cantidad: 1,
      motivo: "El paciente la devolvió sin abrir",
      actorId: profileId,
      actorEmail: "fixture@cnv",
      ip: null,
    });

    expect(await saldo(suyaId), "la unidad devuelta volvió al lote vendible").toBe(vendibleAntes);
    expect(await saldo(cuarentenaId)).toBe(enEsperaAntes + 1);

    const pendientes = await listarDevueltasPendientes();
    const mia = pendientes.find((p) => p.nutraceuticalId === nutraceuticalId && p.lotId === lotId);
    expect(mia?.cantidad).toBe(enEsperaAntes + 1);
    expect(mia?.ultimoMotivo).toBe("El paciente la devolvió sin abrir");
  }, 30_000);

  it("no se devuelven más unidades de las que salieron", async () => {
    const { registrarDevolucionFisica, DevolucionNoRegistrableError } = await import(
      "@/modules/payments/data/devolucion-fisica-writer"
    );
    await expect(
      registrarDevolucionFisica({
        transactionItemId: lineaId,
        cantidad: 99,
        motivo: "Más de las vendidas",
        actorId: profileId,
        actorEmail: "fixture@cnv",
        ip: null,
      }),
    ).rejects.toBeInstanceOf(DevolucionNoRegistrableError);
  }, 30_000);

  it("REINCORPORAR: sale de cuarentena, vuelve al lote y queda con quién la verificó", async () => {
    const { verificarDevuelta } = await import("@/modules/payments/data/devolucion-fisica-writer");
    const { db } = await import("@/db");
    const vendibleAntes = await saldo(suyaId);
    const enEsperaAntes = await saldo(cuarentenaId);
    expect(enEsperaAntes, "el caso anterior dejó la unidad en espera").toBeGreaterThan(0);

    await verificarDevuelta({
      nutraceuticalId,
      lotId,
      cantidad: 1,
      decision: "reincorporar",
      destinoId: suyaId,
      motivo: "Sellada, íntegra y sin vencer",
      actorId: profileId,
      actorEmail: "fixture@cnv",
      ip: null,
    });

    expect(await saldo(cuarentenaId)).toBe(enEsperaAntes - 1);
    expect(await saldo(suyaId)).toBe(vendibleAntes + 1);
    const [quien] = await db.execute<{ created_by: string; reason: string }>(dsql`
      select created_by, reason from nutraceutical_stock_movements
       where nutraceutical_id = ${nutraceuticalId} and type = 'reincorporacion'
       order by created_at desc limit 1`);
    expect(quien.created_by, "la reincorporación no dice quién la hizo").toBe(profileId);
    expect(quien.reason).toBe("Sellada, íntegra y sin vencer");
  }, 30_000);

  it("no se reincorpora a una ubicación que tampoco es vendible", async () => {
    const { registrarDevolucionFisica, verificarDevuelta, DevolucionNoRegistrableError } = await import(
      "@/modules/payments/data/devolucion-fisica-writer"
    );
    await registrarDevolucionFisica({
      transactionItemId: lineaId,
      cantidad: 1,
      motivo: "Devuelta abierta",
      actorId: profileId,
      actorEmail: "fixture@cnv",
      ip: null,
    });
    await expect(
      verificarDevuelta({
        nutraceuticalId,
        lotId,
        cantidad: 1,
        decision: "reincorporar",
        destinoId: cuarentenaId, // la cuarentena misma: no es vendible
        motivo: "Sellada e íntegra",
        actorId: profileId,
        actorEmail: "fixture@cnv",
        ip: null,
      }),
    ).rejects.toBeInstanceOf(DevolucionNoRegistrableError);
  }, 30_000);

  it("EL PRODUCTO DE TERCERO no se reincorpora al inventario de CNV (D-3b-3)", async () => {
    const { verificarDevuelta, DevolucionNoRegistrableError } = await import(
      "@/modules/payments/data/devolucion-fisica-writer"
    );
    const { db } = await import("@/db");
    // Lo devuelto de un tercero vuelve a la consignacion del PROVEEDOR, no al stock vendible de CNV. El
    // circuito del proveedor no existe todavia, asi que lo que se protege es que no entre por error.
    //
    // SE PRUEBA CON EL TERCERO REAL (hoy LUVIA) y sin tocar un solo dato: el fixture de prueba no puede ser
    // de tercero (un CHECK de la base lo prohibe, `nutra_prueba_no_es_de_tercero`, y hace bien). Si algun dia
    // no hay ningun producto de tercero, el caso se salta solo en vez de mentir.
    const [tercero] = await db.execute<{ id: string }>(
      dsql`select id from nutraceuticals where ownership = 'tercero' limit 1`,
    );
    if (!tercero) return;
    const intento = verificarDevuelta({
      nutraceuticalId: tercero.id,
      lotId,
      cantidad: 1,
      decision: "reincorporar",
      destinoId: suyaId,
      motivo: "Sellada, íntegra y sin vencer",
      actorId: profileId,
      actorEmail: "fixture@cnv",
      ip: null,
    });
    await expect(intento).rejects.toBeInstanceOf(DevolucionNoRegistrableError);
    // Y por la razon VERDADERA: sin esto el caso pasaria igual por no haber existencias en cuarentena.
    await expect(intento).rejects.toThrow(/tercero/);
  }, 30_000);

  it("DAR DE BAJA: sale de cuarentena con su motivo y no vuelve a nadie", async () => {
    const { verificarDevuelta, DevolucionNoRegistrableError } = await import(
      "@/modules/payments/data/devolucion-fisica-writer"
    );
    const vendibleAntes = await saldo(suyaId);
    const enEsperaAntes = await saldo(cuarentenaId);
    expect(enEsperaAntes).toBeGreaterThan(0);

    // Sin motivo escrito no se puede dar de baja: no seria auditable.
    await expect(
      verificarDevuelta({
        nutraceuticalId,
        lotId,
        cantidad: 1,
        decision: "dar_de_baja",
        motivo: "no",
        actorId: profileId,
        actorEmail: "fixture@cnv",
        ip: null,
      }),
    ).rejects.toBeInstanceOf(DevolucionNoRegistrableError);

    await verificarDevuelta({
      nutraceuticalId,
      lotId,
      cantidad: 1,
      decision: "dar_de_baja",
      motivo: "Abierta, no se puede reincorporar",
      actorId: profileId,
      actorEmail: "fixture@cnv",
      ip: null,
    });

    expect(await saldo(cuarentenaId)).toBe(enEsperaAntes - 1);
    expect(await saldo(suyaId), "la unidad dada de baja volvió a alguien").toBe(vendibleAntes);
  }, 30_000);

  it("y los tres hechos quedan en el audit log", async () => {
    const { db } = await import("@/db");
    const [f] = await db.execute<{ n: number }>(dsql`
      select count(distinct event)::int as n from clinical_audit_log
       where event in ('inventario.devolucion_fisica_registrada', 'inventario.devuelta_reincorporada',
                       'inventario.devuelta_dada_de_baja')
         and created_at > now() - interval '10 minutes'`);
    expect(f.n).toBe(3);
  }, 30_000);
});
