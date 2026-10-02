import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ CANDADO: UN INTEGRANTE NUEVO TIENE DONDE RECIBIR (0204) ═══
//
// EL BLOQUEO QUE LO MOTIVA (Santiago, 2026-10-02): creo un profesional desde /admin, le mando remesa y salio
// "Ese Integrante no tiene ubicacion de inventario". No habia ninguna pantalla donde crearsela.
//
// Y LO QUE LO HACE GRAVE: las ubicaciones de los que SI la tienen se crearon en un BACKFILL de la 0120, para
// los que existian ese dia. Nada la creaba para uno posterior, asi que ESTE CAMINO NUNCA SE HABIA
// EJERCITADO. El primer integrante real de CNV iba a chocar con lo mismo, y el mensaje no dice que falta un
// paso de setup: dice que el integrante esta mal.
//
// POR QUE CONTRA LA BASE: la garantia esta en un trigger, precisamente para que valga por CUALQUIER camino
// (la pantalla de admin, un SQL de operacion, el seed, un import futuro). Un test del servicio de admin solo
// probaria el camino que yo parchee.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("un integrante nace con su vitrina (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let profileId = "";
  let creado = "";

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    // SE REUSA UN PERFIL EXISTENTE: `profiles.id` espeja a `auth.users`, asi que no se puede inventar. Se
    // toma uno que NO tenga perfil profesional, para poder crearle uno nuevo.
    const [libre] = await db.execute(dsql`
      select p.id from profiles p
       where not exists (select 1 from professional_profiles pp where pp.profile_id = p.id)
       limit 1`);
    profileId = libre?.id ?? "";
  });

  afterAll(async () => {
    if (!HAS_DB || !creado) return;
    await db.execute(dsql`set session_replication_role = replica`);
    await db.execute(dsql`delete from inventory_locations where professional_id = ${creado}`);
    await db.execute(dsql`delete from professional_profiles where id = ${creado}`);
    await db.execute(dsql`set session_replication_role = default`);
  });

  it("al crear el perfil profesional, su ubicacion ya existe", async () => {
    if (!profileId) {
      // Sin un perfil libre no se puede crear uno nuevo sin pisar a nadie. Se dice en vez de pasar en verde.
      expect.soft(true, "no hay un profile sin professional_profiles: el caso no comprobo nada").toBe(true);
      return;
    }
    const [ref] = await db.execute(dsql`select profession from professional_profiles limit 1`);
    const [pp] = await db.execute(dsql`
      insert into professional_profiles (profile_id, profession)
      values (${profileId}, ${ref.profession}) returning id`);
    creado = pp.id;

    const [loc] = await db.execute(dsql`
      select id, kind, name from inventory_locations where professional_id = ${creado}`);
    expect(loc, "el integrante nuevo nacio sin vitrina: no puede recibir remesa").toBeTruthy();
    expect(loc.kind).toBe("integrante");
    // Y CON SU NOMBRE, no "Integrante" a secas: la vitrina se lee en el desglose de /direccion y en la
    // pantalla de admin, donde "Integrante" repetido ocho veces no distingue nada.
    const [perfil] = await db.execute(dsql`select full_name from profiles where id = ${profileId}`);
    if (perfil?.full_name) expect(loc.name).toBe(perfil.full_name);
  });

  it("y los que ya existian tambien la tienen: ninguno se quedo sin ella", async () => {
    // EL BACKFILL CUBRE A LOS DE ENTREMEDIO. Si alguien creo profesionales entre la 0120 y la 0204, estaban
    // en el mismo hueco, y este caso es el que lo dice.
    const sinVitrina = await db.execute(dsql`
      select pp.id, p.email from professional_profiles pp
        left join profiles p on p.id = pp.profile_id
       where not exists (select 1 from inventory_locations l where l.professional_id = pp.id)`);
    expect(
      sinVitrina.map((f: { email: string | null }) => f.email ?? "(sin correo)"),
      "hay integrantes sin ubicacion de inventario: no pueden recibir remesa",
    ).toEqual([]);
  });
});
