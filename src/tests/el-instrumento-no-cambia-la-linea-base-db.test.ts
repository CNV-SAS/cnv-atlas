import { beforeAll, describe, expect, it, vi } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LEER POR INSTRUMENTO NO PUEDE CAMBIAR NI UNA PREGUNTA DE LA LINEA BASE  ·  EL CANDADO DE LA 0240
//
// ═══ QUE SE ESTA CAMBIANDO, Y POR QUE ESTO ES EL SEGURO ═══
//
// Hasta la 0240 la encuesta del paciente era "las preguntas de la version mas reciente, por su
// `order_index`". Desde la 0240 es "las preguntas que este INSTRUMENTO aplica, en el orden que el
// instrumento dice". Para la linea base tiene que ser EXACTAMENTE lo mismo: mismas preguntas, mismo
// orden, mismo texto.
//
// Y es la clase de cambio que no falla en voz alta. Si el instrumento se quedara sin una pregunta, la
// encuesta saldria con 63 en vez de 64 y nadie lo notaria hasta que un diagnostico se quede sin su
// insumo. Asi que no se afirma que sean iguales: se COMPARAN las dos listas, por los dos caminos.
//
// ═══ Y TRES PROPIEDADES MAS QUE LA ESTRUCTURA TIENE QUE CUMPLIR ═══
//
//   · ningun item de la linea base es `retirar` ni `confirmar`: en la primera consulta no hay nada
//     anterior que confirmar, y un `retirar` ahi dejaria una pregunta fuera del cuestionario completo;
//   · ningun `field_key` se repite dentro de un instrumento, que es la invariancia del §7.4 vista desde
//     la base: dos filas con el mismo `field_key` serian dos textos para la misma pregunta;
//   · el orden del instrumento no tiene huecos que lo vuelvan ambiguo (el UNIQUE ya lo impide, pero el
//     caso lo dice: el orden de presentacion sale de aqui).
//
// Se AUTO-SALTA sin DATABASE_URL. Requiere `supabase start`, migraciones aplicadas y el seed.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el guard salta el bloque.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("el instrumento de la linea base aplica la encuesta entera (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let sql: any;

  beforeAll(async () => {
    if (!HAS_DB) return;
    ({ db } = await import("@/db"));
    ({ sql } = await import("drizzle-orm"));
  });

  const porLaVersion = async () =>
    (await db.execute(sql`
      select q.id, q.question_text, q.field_key, q.order_index
        from survey_questions q
       where q.survey_version_id = (
               select v.id from survey_versions v order by v.published_at desc, v.id desc limit 1
             )
       order by q.order_index asc
    `)) as unknown as { id: string; question_text: string; field_key: string | null }[];

  const porElInstrumento = async () =>
    (await db.execute(sql`
      select q.id, q.question_text, q.field_key, i.order_index, i.comportamiento
        from survey_instrument_items i
        join survey_questions q on q.id = i.question_id
        join survey_instruments s on s.id = i.instrument_id
       where s.codigo = 'CNV v2.0'
       order by i.order_index asc
    `)) as unknown as {
      id: string;
      question_text: string;
      field_key: string | null;
      comportamiento: string;
    }[];

  it("las dos listas son la MISMA, en el mismo orden", async () => {
    const version = await porLaVersion();
    const instrumento = await porElInstrumento();
    expect(version.length, "la base no tiene preguntas: este caso no probaria nada").toBeGreaterThan(50);
    expect(
      instrumento.map((q) => `${q.id}|${q.question_text}`),
      "leer por instrumento cambio la encuesta de la linea base",
    ).toEqual(version.map((q) => `${q.id}|${q.question_text}`));
  });

  it("y en la linea base TODAS son `repetir`", async () => {
    // En la primera consulta no hay nada anterior que confirmar, y un `retirar` dejaria una pregunta
    // fuera del cuestionario completo sin que el conteo de completitud lo dijera.
    const comportamientos = new Set((await porElInstrumento()).map((q) => q.comportamiento));
    expect([...comportamientos]).toEqual(["repetir"]);
  });

  it("ningun `field_key` se repite dentro de un instrumento", async () => {
    // Es la invariancia de su §7.4 vista desde la base: dos filas con el mismo `field_key` en el mismo
    // instrumento serian dos textos para la misma pregunta, que es justo lo que esta estructura existe
    // para impedir. El motor congelado lee por `field_key` y se quedaria con uno de los dos.
    const repetidos = (await db.execute(sql`
      select s.codigo, q.field_key, count(*)::int as n
        from survey_instrument_items i
        join survey_questions q on q.id = i.question_id
        join survey_instruments s on s.id = i.instrument_id
       where q.field_key is not null
       group by 1, 2
      having count(*) > 1
    `)) as unknown as { codigo: string; field_key: string; n: number }[];
    expect(
      repetidos.map((r) => `${r.codigo}:${r.field_key} x${r.n}`),
      "un field_key aparece dos veces en el mismo instrumento",
    ).toEqual([]);
  });

  it("y todo instrumento tiene items: uno vacio deja la encuesta del paciente en blanco", async () => {
    const vacios = (await db.execute(sql`
      select s.codigo
        from survey_instruments s
       where not exists (select 1 from survey_instrument_items i where i.instrument_id = s.id)
    `)) as unknown as { codigo: string }[];
    expect(vacios.map((v) => v.codigo)).toEqual([]);
  });
});
