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

  it("y el catálogo entra SIN FIRMAR: una relación sin firma es una propuesta", async () => {
    // El bloqueo solo considerara relaciones firmadas. Que ninguna lo este es lo que hace cierto el
    // "se construye y no se enciende", y lo hace fila a fila en vez de con una bandera global.
    const { db } = await import("@/db");
    const [r] = await db.execute<{ total: number; firmadas: number }>(dsql`
      select count(*)::int as total, count(signed_at)::int as firmadas from allergen_relations`);
    expect(Number(r.total)).toBeGreaterThan(0);
    expect(
      Number(r.firmadas),
      "alguien firmó equivalencias de alérgenos: verifica que sea Dirección Científica y no un seed",
    ).toBe(0);
  });

  it("la avena implica gluten POR CONTAMINACION CRUZADA, no directamente", async () => {
    // Fue la corrección de Santiago y es la razón por la que la firma no es un trámite: la avena por sí
    // sola no contiene gluten, pero arrastra contaminación cruzada salvo que esté certificada.
    const { db } = await import("@/db");
    const [r] = await db.execute<{ kind: string }>(dsql`
      select ar.kind from allergen_relations ar
        join allergens o on o.id = ar.source_id
        join allergens d on d.id = ar.target_id
       where o.code = 'avena' and d.code = 'gluten'`);
    expect(r?.kind).toBe("por_contaminacion_cruzada");
  });

  it("y LUVIA declara avena sin certificación de ausencia", async () => {
    // Mientras `absence_certified_for` sea nulo, la relación por contaminación cruzada implica gluten,
    // que es el tratamiento seguro. Si algún día la ficha trae la certificación, esto cambia y hay que
    // verlo, no descubrirlo.
    const { db } = await import("@/db");
    const [r] = await db.execute<{ declared_as: string; absence_certified_for: string | null }>(dsql`
      select na.declared_as, na.absence_certified_for
        from nutraceutical_allergens na
        join nutraceuticals n on n.id = na.nutraceutical_id
       where n.name = 'LUVIA'`);
    expect(r?.declared_as).toBe("avena");
    expect(r?.absence_certified_for).toBeNull();
  });
});
