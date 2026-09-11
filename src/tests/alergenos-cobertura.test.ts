import { sql as dsql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

// ═══ TODA OPCION DE ALERGIA E INTOLERANCIA, EN TODA VERSION, TIENE SU ALERGENO ═══
//
// EL DEFECTO QUE ESTE CANDADO IMPIDE QUE VUELVA (2026-09-11). La migracion 0123 mapeo las opciones de P43
// y P44 buscandolas POR SU TEXTO, y el texto de P44 cambio entre versiones: en v2, v3 y v5 dice "Gluten";
// en la v6 dice "Gluten (trigo, pan, pasta)", porque Direccion Cientifica añadio los ejemplos el 3 de
// septiembre. Quedaron mapeadas SOLO las de la v6.
//
// LA LECCION, que este proyecto ya conocia: la fila mapeada se ancla al ID de la opcion, que es lo
// correcto. Pero el INSERT que ENCUENTRA esas filas buscaba por texto, y el texto es justo lo que se mueve
// entre versiones. Anclar bien el resultado no sirve si la busqueda que lo produce usa la cosa inestable.
//
// SE MIDE CONTRA BD REAL porque es la unica forma: el hueco no estaba en el codigo, estaba en las filas.
//
// ── Y AHORA ESTE MAPEO NO TIENE LECTOR, que cambia lo que el candado significa (2026-09-11) ──────
//
// Cuando se escribio, la consecuencia del hueco era que "el bloqueo por alergeno no habria saltado".
// NO HAY BLOQUEO: Direccion Cientifica y el asesor legal lo descartaron, cada uno por su razon, y lo que
// se construyo es la YUXTAPOSICION, que lee la respuesta CRUDA del paciente y no esta normalizacion.
//
// El candado se queda igualmente, y por dos razones honestas: la tabla se conserva (es una identidad, no
// una equivalencia), y una tabla a medio poblar es peor que una vacia el dia que alguien la lea. Lo que
// YA NO se puede decir es que un hueco aqui deje pasar a un paciente: hoy no gobierna nada.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("cobertura del mapeo de alérgenos (BD real)", () => {
  it("ninguna opción de P43 o P44 se queda sin alérgeno, en ninguna versión", async () => {
    const { db } = await import("@/db");
    const filas = await db.execute<{
      field_key: string;
      version_number: number;
      option_text: string;
    }>(dsql`
      select sq.field_key, sv.version_number, so.option_text
        from survey_questions sq
        join survey_versions sv on sv.id = sq.survey_version_id
        join survey_options so on so.question_id = sq.id
        left join survey_option_allergens soa on soa.survey_option_id = so.id
       where sq.field_key in ('d6_43', 'd6_44')
         -- "Ninguna" y "Otra" NO se mapean, y son dos ausencias DISTINTAS: la primera no es un
         -- alergeno; la segunda es texto libre que ninguna tabla puede cotejar, y por eso es justo el
         -- caso que la yuxtaposicion muestra tal como el paciente lo escribio.
         and so.option_text not in ('Ninguna', 'Otra')
         and soa.id is null`);

    const huecos = filas.map((f) => `${f.field_key} v${f.version_number}: "${f.option_text}"`);
    expect(
      huecos,
      `estas opciones quedaron sin alérgeno mapeado, así que la tabla está a medio poblar:\n  ${huecos.join("\n  ")}`,
    ).toEqual([]);
  });

  it("y la tabla de equivalencias ya no existe", async () => {
    // La 0126 le borro las filas y la 0127 la retiro entera. No se dejo vacia a proposito: una tabla con
    // un enum de tipos de equivalencia no es neutral, es un formulario, y el dia que alguien quiera
    // "solo dejar anotado" que la avena arrastra gluten, la estructura le dice como.
    const { db } = await import("@/db");
    const [r] = await db.execute<{ existe: boolean }>(dsql`
      select to_regclass('public.allergen_relations') is not null as existe`);
    expect(
      r?.existe,
      "volvio a aparecer la tabla de equivalencias de alergenos",
    ).toBe(false);
  });

  it("y LUVIA declara avena tal como lo dice su ficha, sin deducir nada", async () => {
    // Lo que el producto DICE es avena. Lo que eso implique no lo decidimos nosotros, y hoy no lo decide
    // nadie. `absence_certified_for` queda nulo porque ya no cuelga nada de él.
    const { db } = await import("@/db");
    const [r] = await db.execute<{ declared_as: string; absence_certified_for: string | null }>(dsql`
      select na.declared_as, na.absence_certified_for
        from nutraceutical_allergens na
        join nutraceuticals n on n.id = na.nutraceutical_id
       where n.name = 'LUVIA'`);
    expect(r?.declared_as).toBe("avena");
    expect(r?.absence_certified_for).toBeNull();
  });

  it("y LUVIA se puede vender: la retención colgaba de una firma que nadie había pedido", async () => {
    const { db } = await import("@/db");
    const [r] = await db.execute<{ commercial_availability: string }>(dsql`
      select commercial_availability from nutraceuticals where name = 'LUVIA'`);
    expect(r?.commercial_availability).toBe("en_consultorio");
  });
});
