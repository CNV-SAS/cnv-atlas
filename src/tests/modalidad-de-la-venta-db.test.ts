import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ CANDADO DE LA MODALIDAD DE LA VENTA (0210) ═══
//
// LO QUE VIGILA, y no es la columna: que la columna DERIVE del valor SELLADO en la linea, y que un cambio de
// modalidad del Integrante NO REESCRIBA LAS VENTAS ANTERIORES.
//
// ── POR QUE ESA SEGUNDA MITAD ES LA QUE IMPORTA (condicion de Santiago, 2026-10-06) ────────────────
//
// Santiago lo pidio verificado: "un profesional puede ir y volver entre modalidades varias veces". Lo soporta,
// pero por una razon fragil: el trigger cuelga de `transaction_items.modality`. Si alguien lo colgara de
// `professional_modalities` (que PARECE el sitio natural, porque es donde vive la modalidad), entonces cada
// cambio reescribiria la historia: las ventas viejas pasarian al regimen nuevo y una cuenta quincenal ya
// emitida cambiaria de contenido, sin que nadie lo notara hasta cuadrar cifras.
//
// Es exactamente el fallo que la 0178 evito al sellar por FECHA, y el que esta columna podria reintroducir.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("la modalidad de una venta (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let orgId: string;
  let profId: string;
  let actorId: string;
  let patientId: string;
  let nutraId: string;
  const ventas: string[] = [];
  const vigencias: string[] = [];

  const modalidadDe = async (txId: string): Promise<string> => {
    const [f] = await db.execute(dsql`
      select modalidad_de_la_venta as m from transactions where id = ${txId}::uuid`);
    return f.m;
  };

  /** Una venta con UNA linea, sellada con la modalidad que se pida. */
  const venta = async (modality: string | null): Promise<string> => {
    const [t] = await db.execute(dsql`
      insert into transactions (organization_id, patient_id, professional_id, status, amount, currency,
                                payment_method, wompi_env, idempotency_key)
      values (${orgId}, ${patientId}, ${profId}, 'paid', '119000', 'COP', 'efectivo', 'test',
              ${`mod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`})
      returning id`);
    ventas.push(t.id);
    await db.execute(dsql`
      insert into transaction_items (transaction_id, nutraceutical_id, quantity, unit_price, modality)
      values (${t.id}, ${nutraId}, 1, '119000', ${modality})`);
    return t.id;
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    const [prof] = await db.execute(dsql`
      select pp.id, pp.profile_id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by (select count(*) from transactions t where t.professional_id = pp.id), pp.created_at
       limit 1`);
    profId = prof.id;
    actorId = prof.profile_id;
    orgId = prof.organization_id;

    const [pa] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number)
      values (${orgId}, 'CC', ${`MOD-${Date.now()}`})
      returning id`);
    patientId = pa.id;

    const [n] = await db.execute(dsql`select id from nutraceuticals order by name limit 1`);
    nutraId = n.id;
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of ventas) {
      await db.execute(dsql`delete from cnv_revenue where transaction_id = ${id}::uuid`);
      await db.execute(dsql`delete from professional_revenue where transaction_id = ${id}::uuid`);
      await db.execute(dsql`delete from transaction_items where transaction_id = ${id}::uuid`);
      await db.execute(dsql`delete from transactions where id = ${id}::uuid`);
    }
    for (const id of vigencias) {
      await db.execute(dsql`delete from professional_modalities where id = ${id}::uuid`);
    }
    await db.execute(dsql`delete from patients where id = ${patientId}::uuid`);
    await db.execute(dsql`set session_replication_role = default`);
  });

  it("deriva de la modalidad SELLADA en la linea", async () => {
    expect(await modalidadDe(await venta("distribucion"))).toBe("distribucion");
    expect(await modalidadDe(await venta("comision"))).toBe("comision");
  });

  // SIN MODALIDAD EN LA LINEA cae a 'comision', que es lo que eran todas las ventas antes de que Distribucion
  // existiera. Un NULL obligaria a cada lector a decidir que hacer con el, que es la decision repartida que
  // esta columna viene a quitar.
  it("una linea sin modalidad sellada cuenta como comision", async () => {
    expect(await modalidadDe(await venta(null))).toBe("comision");
  });

  // ═══ LA CONDICION DE SANTIAGO: IR Y VOLVER ENTRE MODALIDADES ═══
  it("cambiar la modalidad del Integrante NO mueve sus ventas anteriores", async () => {
    const enComision = await venta("comision");
    const enDistribucion = await venta("distribucion");

    // Se le abre una vigencia nueva, que es como cambia de modalidad de verdad (0178).
    const [v] = await db.execute(dsql`
      insert into professional_modalities (professional_id, modality, valid_from, decided_by)
      values (${profId}, 'distribucion', (now() at time zone 'America/Bogota')::date, ${actorId})
      returning id`);
    vigencias.push(v.id);

    // LAS DOS SIGUEN COMO ESTABAN. Si el trigger colgara de `professional_modalities`, la primera habria
    // pasado a 'distribucion' y la cuenta quincenal de un corte ya emitido cambiaria de contenido.
    expect(await modalidadDe(enComision), "una venta de Comision se volvio de Distribucion").toBe("comision");
    expect(await modalidadDe(enDistribucion)).toBe("distribucion");
  });

  // Y SE RECOMPUTA CUANDO LA LINEA CAMBIA, que es su unica fuente: el sellado de la venta escribe `modality`
  // despues de crear la linea, asi que si el trigger no mirara el UPDATE la columna quedaria en el default.
  it("se recomputa cuando la linea se sella despues", async () => {
    const id = await venta(null);
    expect(await modalidadDe(id)).toBe("comision");
    await db.execute(dsql`
      update transaction_items set modality = 'distribucion' where transaction_id = ${id}::uuid`);
    expect(await modalidadDe(id), "sellar la linea no actualizo la venta").toBe("distribucion");
  });

  // LA BASE RECHAZA UNA MODALIDAD QUE NO EXISTE. Es el CHECK, y vale probarlo: la columna es texto y sin el
  // podria guardar cualquier cosa, que es como un filtro deja de encontrar lo que busca.
  it("la base no acepta una modalidad inventada", async () => {
    const id = await venta("comision");
    await expect(
      db.execute(dsql`
        update transactions set modalidad_de_la_venta = 'mixta' where id = ${id}::uuid`),
    ).rejects.toThrow();
  });
});
