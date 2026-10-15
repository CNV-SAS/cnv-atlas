import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ═══ LA BODEGA CENTRAL NO DESPACHA LO QUE NO TIENE (Santiago, 2026-10-15) ═══
//
// Su decision: *"no deberia dejar cargar nutraceuticos que no esten en central"*.
//
// ── POR QUE ESTE CANDADO CORRE CONTRA BASE REAL Y NO CON UN CLIENTE FALSO ───────────────────────
//
// La regla es ARITMETICA SOBRE DOS TABLAS (el saldo de la central y la suma de las remesas) y una de ellas se
// mantiene por trigger. Un cliente simulado afirmaria lo que yo creo que devuelve PostgREST, que es
// exactamente el error que se busca: un nombre de columna inventado compila igual.
//
// ── Y EL CASO QUE DE VERDAD IMPORTA ES EL TERCERO ───────────────────────────────────────────────
//
// Yo habia propuesto restar "lo ya declarado SIN CONFIRMAR", y Santiago pregunto: *"como hoy la confirmacion
// NO descuenta de central, confirma que la resta NO SE SUELTA cuando el Integrante confirma. Si se suelta, la
// misma unidad vuelve a estar disponible para una segunda remesa y la comprobacion solo tapa el caso de las
// remesas simultaneas."*
//
// Tenia razon. El tercer caso ES esa pregunta: declara, confirma, y exige que el disponible siga abajo.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(
  process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SELLO = `ZZ-CENTRAL-${Date.now()}`;
const LOTE_REAL = `${SELLO}-L1`;
const LOTE_DESCONOCIDO = `${SELLO}-NO-EXISTE`;

let supabase: SupabaseClient;
let central = "";
let vitrina = "";
let profId = "";
let actorId = "";
let productoReal = "";
let productoDePrueba = "";
let loteReal = "";
let loteDePrueba = "";

describe.skipIf(!HAS_DB)("la central no despacha lo que no tiene (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const [c] = await db.execute<{ id: string }>(dsql`
      select id from inventory_locations where kind = 'central' and is_active limit 1`);
    central = c.id;
    const [p] = await db.execute<{ id: string; org: string; loc: string; profile: string }>(dsql`
      select pp.id, p.organization_id as org, l.id as loc, p.id as profile
        from professional_profiles pp
        join profiles p on p.id = pp.profile_id
        join inventory_locations l on l.professional_id = pp.id and l.is_active
       order by p.full_name limit 1`);
    profId = p.id;
    vitrina = p.loc;
    actorId = p.profile;

    const [real] = await db.execute<{ id: string }>(dsql`
      insert into nutraceuticals (organization_id, name, unit_price, is_test, ownership, commercial_availability)
      values (${p.org}, ${`${SELLO} REAL`}, 11900, false, 'propio', 'en_consultorio')
      returning id`);
    productoReal = real.id;
    const [prueba] = await db.execute<{ id: string }>(dsql`
      insert into nutraceuticals (organization_id, name, unit_price, is_test, ownership, commercial_availability)
      values (${p.org}, ${`${SELLO} PRUEBA`}, 11900, true, 'propio', 'en_consultorio')
      returning id`);
    productoDePrueba = prueba.id;

    const [l1] = await db.execute<{ id: string }>(dsql`
      insert into lots (nutraceutical_id, code, expires_on)
      values (${productoReal}, ${LOTE_REAL}, '2028-07-18') returning id`);
    loteReal = l1.id;
    const [l2] = await db.execute<{ id: string }>(dsql`
      insert into lots (nutraceutical_id, code, expires_on)
      values (${productoDePrueba}, ${LOTE_REAL}, '2028-07-18') returning id`);
    loteDePrueba = l2.id;

    // LA CENTRAL ARRANCA CON DIEZ del producto real. El trigger proyecta el saldo desde el movimiento.
    await db.execute(dsql`
      insert into nutraceutical_stock_movements
        (location_id, professional_id, nutraceutical_id, lot_id, delta, type, reason, lote, created_by)
      values (${central}::uuid, null, ${productoReal}, ${loteReal}, 10, 'recepcion',
              ${`${SELLO}: carga de la central`}, ${LOTE_REAL}, ${actorId}::uuid)`);
  }, 60_000);

  afterAll(async () => {
    if (!HAS_DB) return;
    const { db } = await import("@/db");
    // LOS MOVIMIENTOS SON APPEND-ONLY, asi que el borrado va con los triggers en pausa. Y VA DENTRO DE UNA
    // TRANSACCION: `set session_replication_role` vale por CONEXION, y el pool reparte cada execute por su
    // cuenta, asi que suelto puede quedarse en otra conexion y el borrado falla.
    await db.transaction(async (tx) => {
      await tx.execute(dsql`set local session_replication_role = replica`);
      await tx.execute(dsql`delete from nutraceutical_stock_movements where lot_id in (${loteReal}, ${loteDePrueba})`);
      await tx.execute(dsql`delete from nutraceutical_inventory where lot_id in (${loteReal}, ${loteDePrueba})`);
      await tx.execute(dsql`delete from lots where id in (${loteReal}, ${loteDePrueba})`);
      await tx.execute(dsql`delete from nutraceuticals where id in (${productoReal}, ${productoDePrueba})`);
    });
  }, 60_000);

  async function motivo(nutraceuticalId: string, lote: string, quantity: number) {
    const { motivoSiLaCentralNoTieneEsasUnidades } = await import(
      "@/modules/nutraceuticals/data/lo-que-la-central-puede-despachar"
    );
    return motivoSiLaCentralNoTieneEsasUnidades({ nutraceuticalId, lote, quantity });
  }

  it("con diez en la central, diez pasan y once no", async () => {
    expect(await motivo(productoReal, LOTE_REAL, 10)).toBeNull();
    const freno = await motivo(productoReal, LOTE_REAL, 11);
    expect(freno).toBeTruthy();
    // EL MENSAJE TIENE QUE DECIR CUANTAS HAY, no solo que no se puede: un freno que no dice el numero deja a
    // quien despacha adivinando.
    expect(freno).toContain("10");
    expect(freno).toContain(LOTE_REAL);
  }, 60_000);

  it("un lote que la central no conoce no se despacha, y el lote NO queda creado", async () => {
    const freno = await motivo(productoReal, LOTE_DESCONOCIDO, 1);
    expect(freno).toContain(LOTE_DESCONOCIDO);
    // ESTO ES LA MITAD QUE SE OLVIDA: la comprobacion corre ANTES de resolver el lote justo para no dejar un
    // lote provisional huerfano por cada intento rechazado.
    const { count } = await supabase
      .from("lots")
      .select("id", { count: "exact", head: true })
      .eq("code", LOTE_DESCONOCIDO);
    expect(count ?? 0).toBe(0);
  }, 60_000);

  it("LA RESTA NO SE SUELTA CUANDO EL INTEGRANTE CONFIRMA (la pregunta de Santiago)", async () => {
    const { db } = await import("@/db");
    // Admin declara seis de las diez. La remesa se escribe sobre la VITRINA y el trigger la excluye del
    // saldo, asi que la central sigue diciendo diez.
    const [remesa] = await db.execute<{ id: string }>(dsql`
      insert into nutraceutical_stock_movements
        (location_id, professional_id, nutraceutical_id, lot_id, delta, type, reason, lote, created_by)
      values (${vitrina}::uuid, ${profId}::uuid, ${productoReal}, ${loteReal}, 6, 'remesa',
              ${`${SELLO}: remesa declarada`}, ${LOTE_REAL}, ${actorId}::uuid)
      returning id`);

    const { data: saldo } = await supabase
      .from("nutraceutical_inventory")
      .select("stock_quantity")
      .eq("location_id", central)
      .eq("lot_id", loteReal)
      .maybeSingle();
    expect(saldo?.stock_quantity).toBe(10);

    // Quedan cuatro: cuatro pasan, cinco no.
    expect(await motivo(productoReal, LOTE_REAL, 4)).toBeNull();
    expect(await motivo(productoReal, LOTE_REAL, 5)).toBeTruthy();

    // EL INTEGRANTE CONFIRMA. Con la version que yo habia propuesto ("lo declarado SIN CONFIRMAR"), aqui la
    // remesa salia del conjunto restado y la central volvia a ofrecer las diez.
    await db.execute(dsql`
      insert into nutraceutical_stock_movements
        (location_id, professional_id, nutraceutical_id, lot_id, delta, reported_quantity, type, reason, lote,
         remesa_id, created_by)
      values (${vitrina}::uuid, ${profId}::uuid, ${productoReal}, ${loteReal}, 6, 6, 'recepcion',
              ${`${SELLO}: recepcion`}, ${LOTE_REAL}, ${remesa.id}::uuid, ${actorId}::uuid)`);

    expect(await motivo(productoReal, LOTE_REAL, 4)).toBeNull();
    const despuesDeConfirmar = await motivo(productoReal, LOTE_REAL, 5);
    expect(
      despuesDeConfirmar,
      "la confirmacion solto la resta: las seis unidades que ya salieron volvieron a estar disponibles",
    ).toBeTruthy();
    // Y el saldo de la central SIGUE en diez, que es el hueco que esto compensa (la remesa no lo descuenta).
    const { data: despues } = await supabase
      .from("nutraceutical_inventory")
      .select("stock_quantity")
      .eq("location_id", central)
      .eq("lot_id", loteReal)
      .maybeSingle();
    expect(despues?.stock_quantity).toBe(10);
  }, 60_000);

  it("el producto de PRUEBA no tiene tope, aunque la central no tenga ninguno", async () => {
    // La central nunca carga producto de prueba, asi que el tope cerraria el unico camino para recargar una
    // vitrina de prueba dentro de produccion, que existe a proposito (Santiago, 2026-10-01).
    expect(await motivo(productoDePrueba, LOTE_REAL, 500)).toBeNull();
    expect(await motivo(productoDePrueba, LOTE_DESCONOCIDO, 500)).toBeNull();
  }, 60_000);

  it("la pantalla puede decir las tres cifras del mismo hecho", async () => {
    const { loQueLaCentralPuedeDespachar } = await import(
      "@/modules/nutraceuticals/data/lo-que-la-central-puede-despachar"
    );
    const filas = await loQueLaCentralPuedeDespachar();
    const mia = filas.find((f) => f.lotId === loteReal);
    expect(mia).toBeDefined();
    expect(mia?.saldo).toBe(10);
    expect(mia?.yaDeclarado).toBe(6);
    expect(mia?.disponible).toBe(4);
    expect(mia?.esDePrueba).toBe(false);
  }, 60_000);
});
