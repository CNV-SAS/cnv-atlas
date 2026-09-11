import { sql as dsql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

// ═══ TODA OPCION DE ALERGIA E INTOLERANCIA, EN TODA VERSION, TIENE SU ALERGENO ═══
//
// EL DEFECTO QUE ESTE CANDADO IMPIDE QUE VUELVA (2026-09-11). La migracion 0123 mapeo las opciones de P43
// y P44 buscandolas POR SU TEXTO, y el texto de P44 cambio entre versiones: en v2, v3 y v5 dice "Gluten";
// en la v6 dice "Gluten (trigo, pan, pasta)", porque Direccion Cientifica añadio los ejemplos el 3 de
// septiembre. Quedaron mapeadas SOLO las de la v6.
//
// CONSECUENCIA: un paciente que respondio P44 en una version anterior declarando "Gluten" no habria sido
// reconocido, y el bloqueo por alergeno NO habria saltado para el. Afecta a los pacientes MAS ANTIGUOS,
// que es donde nadie iba a mirar.
//
// LA LECCION, que este proyecto ya conocia: la fila mapeada se ancla al ID de la opcion, que es lo
// correcto. Pero el INSERT que ENCUENTRA esas filas buscaba por texto, y el texto es justo lo que se mueve
// entre versiones. Anclar bien el resultado no sirve si la busqueda que lo produce usa la cosa inestable.
//
// SE MIDE CONTRA BD REAL porque es la unica forma: el hueco no estaba en el codigo, estaba en las filas.

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
         -- "Ninguna" y "Otra" NO se mapean, y son dos ausencias DISTINTAS: la primera no es un alergeno;
         -- la segunda es texto libre que ninguna tabla puede cotejar, y su tratamiento es EXIGIR la misma
         -- confirmacion, no dejar pasar.
         and so.option_text not in ('Ninguna', 'Otra')
         and soa.id is null`);

    const huecos = filas.map((f) => `${f.field_key} v${f.version_number}: "${f.option_text}"`);
    expect(
      huecos,
      `estas opciones no tienen alérgeno mapeado, así que el bloqueo no saltaría para quien las eligió:\n  ${huecos.join("\n  ")}`,
    ).toEqual([]);
  });

  it("y NO hay equivalencias: ninguna regla traduce un ingrediente a una alergia", async () => {
    // Lo negó dos veces, el 27 de agosto y el 11 de septiembre. La TABLA se queda (el día que exista una
    // regla tendrá dónde vivir, con firma); las FILAS no, porque las cinco eran contenido clínico que
    // escribimos nosotros y que su archivo no tiene.
    const { db } = await import("@/db");
    const [r] = await db.execute<{ n: number }>(dsql`select count(*)::int as n from allergen_relations`);
    expect(
      Number(r.n),
      "volvió a aparecer una equivalencia de alérgenos: sería la cuarta vez que esta pieza regresa",
    ).toBe(0);
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
