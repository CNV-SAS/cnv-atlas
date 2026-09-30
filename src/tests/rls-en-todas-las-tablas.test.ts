import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

// CANDADO DE BARRIDO: NINGUNA TABLA DE `public` SIN RLS Y SIN POLITICA.
//
// ═══ POR QUE EXISTE, Y ES LA SEGUNDA VEZ HOY QUE PASA LO MISMO ═══
//
// Supabase reporto sobre el proyecto REAL: "Anyone with your project URL can read, edit, and delete all data
// in this table", sobre TRES tablas de estas ultimas semanas: `commission_settlements` (lo que se le paga a
// cada Integrante), `professional_modalities` y `professional_attachments` (sus documentos, incluido el RUT).
//
// Drizzle CREA la tabla y NO enciende RLS: hay que escribirlo a mano en cada migracion. Y eso YA ESTABA
// APRENDIDO Y ESCRITO, en el candado de `patient_contraindications`: "Drizzle crea la tabla pero NO enciende
// RLS". Lo que fallaba es que ese candado es POR TABLA: comprueba dos, una por una, y no alcanza a la tercera
// ni a la decima.
//
// Es la misma forma que el `z.uuid()` del mismo dia: una regla escrita seis veces que no llego al septimo
// archivo. UN CANDADO POR CASO NO PROTEGE UNA REGLA; hace falta un barrido.
//
// ═══ Y EL BARRIDO COMPRUEBA DOS COSAS, no una ═══
//
//   1. RLS ENCENDIDA. Sin ella, cualquiera con la URL del proyecto lee y escribe la tabla entera.
//   2. AL MENOS UNA POLITICA. Con RLS y cero politicas la tabla queda MUDA para todos, que falla cerrado (no
//      es un agujero) pero rompe la pantalla que la lee, y es igual de invisible hasta que alguien la abre.
//
// Se auto-salta sin DATABASE_URL.

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}

const HAS_DB = Boolean(process.env.DATABASE_URL);
const sql = HAS_DB ? postgres(process.env.DATABASE_URL!, { max: 1, prepare: false }) : (null as never);

/**
 * Tablas que a proposito NO llevan RLS, cada una con su razon.
 *
 * VACIA HOY, y conviene que se mantenga asi: una excepcion sin razon escrita es un agujero con permiso. Si
 * algun dia hace falta una, va aqui con su motivo, y quien la lea en un año sabra si sigue valiendo.
 */
const SIN_RLS_A_PROPOSITO = new Map<string, string>([
  // Ejemplo de la forma, si alguna vez hace falta:
  // ["nombre_de_la_tabla", "razon concreta y verificable"],
]);

/** Tablas internas de la migracion de drizzle, que no son del esquema de la aplicacion. */
const NO_SON_DE_LA_APP = new Set(["__drizzle_migrations"]);

describe.skipIf(!HAS_DB)("RLS en todas las tablas de public", () => {
  afterAll(async () => {
    if (HAS_DB) await sql.end();
  });

  it("ninguna tabla queda sin RLS", async () => {
    const filas = await sql<{ tabla: string }[]>`
      select c.relname as tabla
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
       order by 1`;
    const culpables = filas
      .map((f) => f.tabla)
      .filter((t) => !NO_SON_DE_LA_APP.has(t) && !SIN_RLS_A_PROPOSITO.has(t));
    expect(
      culpables,
      "tablas sin RLS: cualquiera con la URL del proyecto las lee y las escribe. Enciendela en una migracion, o declara la excepcion con su razon.",
    ).toEqual([]);
  });

  it("y ninguna con RLS se queda sin politica, que la dejaria muda", async () => {
    const filas = await sql<{ tabla: string }[]>`
      select c.relname as tabla
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
         and not exists (
           select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
         )
       order by 1`;
    expect(
      filas.map((f) => f.tabla),
      "tablas con RLS y cero politicas: nadie las lee, y la pantalla que dependa de ellas sale vacia sin decir por que.",
    ).toEqual([]);
  });

  // LAS TRES DEL REPORTE, NOMBRADAS. El barrido de arriba las cubre, pero nombrarlas deja el caso concreto
  // atado a su historia: si mañana alguien las vuelve a crear sin RLS, el fallo dice cual y por que importaba.
  it("las tres del reporte de Supabase tienen su RLS y su politica", async () => {
    for (const tabla of ["commission_settlements", "professional_modalities", "professional_attachments"]) {
      const [c] = await sql<{ rls: boolean }[]>`
        select relrowsecurity as rls from pg_class where relname = ${tabla}`;
      expect(c?.rls, `${tabla} sin RLS`).toBe(true);
      const pols = await sql`select policyname from pg_policies where tablename = ${tabla}`;
      expect(pols.length, `${tabla} sin politicas`).toBeGreaterThan(0);
    }
  });
});
