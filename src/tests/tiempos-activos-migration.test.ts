import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";

// CANDADO DE LA DATA-MIGRATION 0078 (partir los tiempos activos a su columna).
//
// POR QUE EXISTE: la base local NO tenia ni una fila con distribucion guardada, asi que la migracion corrio
// sobre CERO filas y no probo nada. En la nube SI hay filas, y ahi no podemos mirar. Un `UPDATE` de
// data-migration que se equivoca no falla: mueve mal el dato y sigue.
//
// QUE SE PRUEBA: se ejecuta el SQL REAL leido del archivo de migracion (no una reimplementacion, que probaria
// otra cosa) contra filas sembradas con las cuatro formas que la nube puede tener. Ver la leccion
// "verificar por el camino real".

vi.mock("server-only", () => ({}));

let RUN = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local
}
RUN = Boolean(process.env.DATABASE_URL);

// El UPDATE tal cual esta en la migracion: si alguien lo edita, este test corre el editado.
function updateDeLaMigracion(): string {
  const sql = readFileSync("drizzle/0078_tricky_marten_broadcloak.sql", "utf8");
  const i = sql.indexOf('UPDATE "treatments"');
  if (i < 0) throw new Error("La migracion 0078 ya no trae el UPDATE de la data-migration.");
  return sql.slice(i);
}

describe.skipIf(!RUN)("data-migration 0078: mover los tiempos activos a su columna", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let sql: any;

  const ACTIVOS = { desayuno: true, almuerzo: true, cena: false };
  const BASE = { porciones: { Cereales: 4 }, activos: { desayuno: true, almuerzo: true, cena: true } };

  beforeAll(async () => {
    schema = await import("@/db/schema");
    db = (await import("@/db")).db;
    sql = (await import("drizzle-orm")).sql;
  });

  it("mueve los activos, los BORRA del jsonb, y deja intactos celdas y base", async () => {
    const { eq } = await import("drizzle-orm");
    // Se siembra sobre un tratamiento existente cualquiera; si no hay ninguno, no hay nada que probar.
    const [t] = await db.select({ id: schema.treatments.id }).from(schema.treatments).limit(1);
    if (!t) return;
    const previo = await db
      .select({ ta: schema.treatments.tiemposActivos, ti: schema.treatments.tiempos })
      .from(schema.treatments)
      .where(eq(schema.treatments.id, t.id));

    try {
      // FORMA VIEJA: activos dentro del jsonb, que es lo que hay en la nube.
      await db
        .update(schema.treatments)
        .set({ tiemposActivos: null, tiempos: { activos: ACTIVOS, celdas: { Cereales: { desayuno: 4 } }, base: BASE } })
        .where(eq(schema.treatments.id, t.id));

      await db.execute(sql.raw(updateDeLaMigracion()));

      const [despues] = await db
        .select({ ta: schema.treatments.tiemposActivos, ti: schema.treatments.tiempos })
        .from(schema.treatments)
        .where(eq(schema.treatments.id, t.id));

      expect(despues.ta).toEqual(ACTIVOS); // llego a la columna
      expect(despues.ti.activos).toBeUndefined(); // y NO quedo copia en el jsonb (una sola fuente)
      expect(despues.ti.celdas).toEqual({ Cereales: { desayuno: 4 } }); // lo demas, intacto
      expect(despues.ti.base).toEqual(BASE); // el contexto sellado NO se toca: no es la decision vigente

      // IDEMPOTENTE: una segunda corrida ya no encuentra la clave y no rompe nada.
      await db.execute(sql.raw(updateDeLaMigracion()));
      const [otra] = await db
        .select({ ta: schema.treatments.tiemposActivos })
        .from(schema.treatments)
        .where(eq(schema.treatments.id, t.id));
      expect(otra.ta).toEqual(ACTIVOS);
    } finally {
      await db
        .update(schema.treatments)
        .set({ tiemposActivos: previo[0].ta, tiempos: previo[0].ti })
        .where(eq(schema.treatments.id, t.id));
    }
  });

  it("NO toca las filas que no tienen la clave, ni las malformadas (defensa para la nube)", async () => {
    const { eq } = await import("drizzle-orm");
    const [t] = await db.select({ id: schema.treatments.id }).from(schema.treatments).limit(1);
    if (!t) return;
    const previo = await db
      .select({ ta: schema.treatments.tiemposActivos, ti: schema.treatments.tiempos })
      .from(schema.treatments)
      .where(eq(schema.treatments.id, t.id));

    // Las tres formas que NO debe tocar: sin tiempos, con un jsonb que no es objeto, y con `activos` basura.
    const casos: unknown[] = [null, "no soy un objeto", { activos: "no soy un mapa", celdas: {}, base: BASE }];
    try {
      for (const caso of casos) {
        await db
          .update(schema.treatments)
          .set({ tiemposActivos: null, tiempos: caso })
          .where(eq(schema.treatments.id, t.id));
        await db.execute(sql.raw(updateDeLaMigracion()));
        const [d] = await db
          .select({ ta: schema.treatments.tiemposActivos, ti: schema.treatments.tiempos })
          .from(schema.treatments)
          .where(eq(schema.treatments.id, t.id));
        // Queda NULL: el panel cae a los tiempos por defecto, que es el comportamiento de hoy. Y el jsonb
        // raro se conserva TAL CUAL, para que se pueda ver y no se pierda en una migracion silenciosa.
        expect(d.ta, `caso ${JSON.stringify(caso)}`).toBeNull();
        expect(d.ti).toEqual(caso);
      }
    } finally {
      await db
        .update(schema.treatments)
        .set({ tiemposActivos: previo[0].ta, tiempos: previo[0].ti })
        .where(eq(schema.treatments.id, t.id));
    }
  });
});
