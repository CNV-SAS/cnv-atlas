import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL TRATAMIENTO DE UNA CONSULTA SE BUSCA POR INDICE  ·  2026-11-04
//
// ═══ EL CASO (Sentry, 2026-11-03 20:54 UTC, 13 eventos, Unhandled, ESCALATING) ═══
//
//   treatment-reader: treatments: canceling statement due to statement timeout
//   GET /ani-bis-e/[id]?etapa=tratamiento
//
// `treatments.diagnosis_id` es una FK y NO TENIA INDICE (Postgres no las indexa por su cuenta). Asi que
// buscar el tratamiento de una consulta barria la tabla entera, y cada fila pagaba `treatments_select`,
// que hace diagnoses -> evaluations -> `is_patient_professional`. La 0236 crea el indice: medido con rol
// `authenticated`, 121,2 ms -> 3,2 ms.
//
// ═══ POR QUE ESTE CANDADO MIRA EL PLAN Y NO SOLO EL INDICE ═══
//
// Afirmar "el indice existe" es barato y se queda corto: un indice puede existir y la consulta no usarlo.
// Lo que de verdad protege al profesional es que el plan NO BARRA `treatments`, asi que eso es lo que se
// comprueba, con EXPLAIN ANALYZE y con el rol `authenticated` puesto, que es el unico que paga la RLS.
//
// Y SE CORRE CON UN PROFESIONAL, NO CON UN ADMIN. Para un admin la policy se resuelve en la primera rama
// del `or` y el coste por fila desaparece: el defecto era INVISIBLE desde una cuenta de administrador, y
// eso es justo lo que lo hizo dificil de ver.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

afterAll(async () => {
  await sql.end();
});

const INDICES: ReadonlyArray<readonly [string, string]> = [
  ["treatments", "treatments_diagnosis_idx"],
  ["treatment_nutraceuticals", "treatment_nutraceuticals_treatment_idx"],
  ["treatment_diet_guidelines", "treatment_diet_guidelines_treatment_idx"],
];

describe("la busqueda del tratamiento de una consulta no barre la tabla", () => {
  it.each(INDICES)("%s tiene su indice por la columna de busqueda", async (tabla, indice) => {
    const r = await sql`
      select indexname from pg_indexes
      where schemaname = 'public' and tablename = ${tabla} and indexname = ${indice}
    `;
    expect(r.length, `falta el indice ${indice}`).toBe(1);
  });

  it("el plan de la consulta de PostgREST usa el indice y no hace seq scan de treatments", async () => {
    // Un caso real de la base de pruebas: una evaluacion con tratamiento, y el profesional que la
    // atendio (el unico para quien la RLS cuesta algo).
    const caso = await sql`
      select d.evaluation_id, pp.profile_id
      from treatments t
      join diagnoses d on d.id = t.diagnosis_id
      join evaluations e on e.id = d.evaluation_id
      join professional_profiles pp on pp.id = e.professional_id
      limit 1
    `;
    if (caso.length === 0) return; // base sin tratamientos: nada que medir, y no se inventa uno

    const evaluationId = caso[0].evaluation_id as string;
    const claims = JSON.stringify({ sub: caso[0].profile_id, role: "authenticated" });

    // La forma que arma PostgREST para `treatments?select=...,diagnoses!inner(evaluation_id)
    // &diagnoses.evaluation_id=eq.<id>`: el filtro va DENTRO del lateral, asi que no acota el barrido
    // exterior. Es exactamente la consulta que se cayo.
    const lineas = await sql.begin(async (tx) => {
      await tx.unsafe("set local role authenticated");
      await tx.unsafe(`select set_config('request.jwt.claims', $1, true)`, [claims]);
      return tx.unsafe(
        `explain (analyze, costs off, timing off, summary off)
         select t.id, dd.evaluation_id
           from treatments t
           join lateral (
             select d.evaluation_id from diagnoses d
              where d.id = t.diagnosis_id and d.evaluation_id = $1
           ) dd on true
          order by t.created_at desc
          limit 1`,
        [evaluationId],
      );
    });

    const plan = (lineas as unknown as Array<Record<string, string>>)
      .map((l) => l["QUERY PLAN"])
      .join("\n");
    expect(plan, "la consulta volvio a barrer treatments entera").not.toMatch(
      /Seq Scan on treatments/,
    );
    expect(plan).toMatch(/Index Scan using treatments_diagnosis_idx/);
  });
});
