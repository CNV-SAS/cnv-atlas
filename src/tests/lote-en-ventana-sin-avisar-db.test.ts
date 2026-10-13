import { sql as dsql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ UN LOTE QUE ENTRA EN LA VENTANA SE VE EL MISMO DIA (segundo smoke, 2026-10-12) ═══
//
// EL DEFECTO: Santiago marco un lote que vence en 15 dias y no salio en NINGUNA pantalla.
//
// ── LO QUE NO ERA ──
//
// No era la ventana: son 60 dias (`DIAS_DE_ALERTA_POR_DEFECTO`, con su propio candado), asi que 15 esta
// dentro de sobra. Y no era la fecha inventada del lote provisional, que tiene su propio bloque.
//
// ── LO QUE ERA ──
//
// Las dos pantallas leen FILAS de `lot_expiry_alerts`, y esas filas las crea la tarea diaria a las 8:30 a. m.
// de Colombia. Un lote que entra en la ventana hoy no tiene fila hasta la mañana siguiente, asi que el
// sistema lo habia visto y no lo decia en ninguna parte.
//
// ── Y POR QUE LA FILA NO SE DERIVA AL VUELO, QUE SERIA LO MAS CORTO ──
//
// Porque es lo que DECIDE QUIEN ASUME el vencido (cuando se genero, con cuanta anticipacion, si la vio), y
// el servicio la BORRA cuando el correo no sale, para no afirmar que se aviso a quien no se entero. Una
// alerta calculada al abrir una pantalla afirmaria un aviso que nadie entrego.
//
// ── LO QUE ESTE CANDADO SOSTIENE ──
//
//   1. que un lote en ventana SIN alerta registrada aparezca;
//   2. que DESAPAREZCA de esa lista cuando la tarea registra su alerta (si no, saldria dos veces);
//   3. que la regla sea la MISMA que usa la tarea, o sea que lo que la lista muestra hoy es exactamente lo
//      que va a quedar registrado mañana;
//   4. y que un lote fuera de la ventana no aparezca, que es lo que hace util a la lista.
//
// Contra la BD real porque lo que se prueba es el cruce entre inventario, lotes, ubicaciones y las filas de
// alerta: tres joins y una ausencia, nada que un mock distinga.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("un lote en ventana sin alerta registrada (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let lectura: any;
  let locationId = "";
  let profId: string | null = null;
  const nutraId = "77777777-7777-7777-7777-777777777702"; // MULTICELL, producto dedicado a pruebas
  const lotes: string[] = [];

  /**
   * Un lote con saldo en una ubicacion vendible, que vence en tantos dias.
   *
   * EL SALDO SE CREA CON SU MOVIMIENTO, no escribiendo `nutraceutical_inventory`: la base exige que el saldo
   * sea la suma de los movimientos (`nutra_inventory_coherence`), y tiene razon. Un fixture que escribe el
   * saldo a mano probaria sobre un estado que no puede existir.
   */
  async function loteConSaldo(diasHastaVencer: number): Promise<string> {
    const [l] = await db.execute(dsql`
      insert into lots (nutraceutical_id, code, expires_on)
      values (${nutraId}, ${`TEST-SINAVISO-${Date.now()}-${Math.floor(Math.random() * 1000)}`},
              ((now() at time zone 'America/Bogota')::date + ${diasHastaVencer}::int)::date)
      returning id`);
    lotes.push(l.id);
    await db.execute(dsql`
      insert into nutraceutical_stock_movements
        (professional_id, nutraceutical_id, location_id, lot_id, type, delta, reason)
      values (${profId}, ${nutraId}, ${locationId}, ${l.id}, 'recepcion', 4,
              'fixture: lote en ventana sin avisar')`);
    return l.id;
  }

  const enLaLista = async (lotId: string): Promise<boolean> => {
    const lista = await lectura.lotesEnVentanaSinAvisar();
    return lista.some((l: { lotId: string }) => l.lotId === lotId);
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    lectura = await import("@/modules/nutraceuticals/services/vencimientos-lectura");
    // Una ubicacion VENDIBLE y activa: la cuarentena no se avisa a proposito (0164), asi que un lote ahi
    // no probaria nada de esto.
    const [loc] = await db.execute(dsql`
      select id, professional_id from inventory_locations
       where is_active and sellable order by created_at limit 1`);
    locationId = loc.id;
    profId = loc.professional_id;
  }, 30_000);

  // UN MOVIMIENTO DE INVENTARIO ES INMUTABLE a proposito (describe algo que paso), asi que el fixture se
  // limpia con los triggers desactivados. Es la unica forma de no dejar basura sin romper esa garantia.
  afterEach(async () => {
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of lotes) {
      await db.execute(dsql`delete from lot_expiry_alerts where lot_id = ${id}`);
      await db.execute(dsql`delete from nutraceutical_stock_movements where lot_id = ${id}`);
      await db.execute(dsql`delete from nutraceutical_inventory where lot_id = ${id}`);
      await db.execute(dsql`delete from lots where id = ${id}`);
    }
    await db.execute(dsql`set session_replication_role = default`);
    lotes.length = 0;
  });

  // EL CASO DEL SMOKE, con su misma cifra.
  it("un lote que vence en 15 dias aparece el mismo dia, antes de que la tarea corra", async () => {
    const lotId = await loteConSaldo(15);
    expect(
      await enLaLista(lotId),
      "antes de esto el lote no salia en ninguna pantalla: parecia que el sistema no lo habia visto",
    ).toBe(true);
  }, 30_000);

  it("y trae su plazo y sus unidades, no solo el hecho de existir", async () => {
    const lotId = await loteConSaldo(15);
    const lista = await lectura.lotesEnVentanaSinAvisar();
    const l = lista.find((x: { lotId: string }) => x.lotId === lotId);
    expect(l.plazo).toBe("quedan 15 días");
    expect(l.unidades).toBe(4);
    expect(l.vencido).toBe(false);
  }, 30_000);

  it("DESAPARECE cuando la tarea registra su alerta: si no, saldria dos veces", async () => {
    const lotId = await loteConSaldo(15);
    expect(await enLaLista(lotId)).toBe(true);

    const [l] = await db.execute(dsql`select expires_on::text as v from lots where id = ${lotId}`);
    await db.execute(dsql`
      insert into lot_expiry_alerts (lot_id, location_id, nutraceutical_id, professional_id,
                                     expires_on, units_at_alert, days_ahead)
      values (${lotId}, ${locationId}, ${nutraId}, null, ${l.v}::date, 4, 60)`);

    expect(
      await enLaLista(lotId),
      "con la alerta registrada el lote pasa a las listas de siempre, que leen esa fila",
    ).toBe(false);
  }, 30_000);

  it("un lote fuera de la ventana no aparece, que es lo que hace util a la lista", async () => {
    const lotId = await loteConSaldo(200);
    expect(await enLaLista(lotId)).toBe(false);
  }, 30_000);

  // LA MISMA REGLA QUE LA TAREA: lo que la lista muestra hoy es lo que va a quedar registrado mañana. Si las
  // dos reglas se separaran, la pantalla prometeria un aviso que la tarea no manda, o al contrario.
  it("un lote ya VENCIDO y sin alerta tambien aparece, marcado como vencido", async () => {
    const lotId = await loteConSaldo(-3);
    const lista = await lectura.lotesEnVentanaSinAvisar();
    const l = lista.find((x: { lotId: string }) => x.lotId === lotId);
    expect(l, "un vencido sin alerta es el caso que mas importa ver: el vencido lo asume CNV").toBeTruthy();
    expect(l.vencido).toBe(true);
  }, 30_000);
});
