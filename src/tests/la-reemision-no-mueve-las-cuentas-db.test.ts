import { beforeAll, describe, expect, it, vi } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// REEMITIR UN DIAGNOSTICO NO PUEDE MOVER NINGUNA CUENTA DE EVALUACIONES  ·  EL CANDADO DE LA 0234
//
// ═══ EL DEFECTO QUE CIERRA ═══
//
// Santiago, 2026-11-03: las cifras de /obbia casi se duplicaron entre dos miradas, y en medio solo pasaron
// las tandas de reemision. Medido en produccion: **927 filas sobre 569 evaluaciones**, porque
// `evaluaciones_vigentes` hacia `LEFT JOIN diagnoses` como si solo pudiera haber uno, y reemitir INSERTA.
//
// ═══ POR QUE ESTE CANDADO Y NO UNA CIFRA ═══
//
// La suite tenia ya siete invariantes sobre esta cohorte (`la-cohorte-de-investigacion-se-explica-db`) y
// TODOS seguian en verde con las cifras dobladas, porque todos comparan cifras de la vista entre si: si la
// vista duplica, duplica el total y duplica los cubos, y las sumas siguen cuadrando. Lo que faltaba era
// una propiedad que la vista afirma sobre SI MISMA y que un dato nuevo pueda romper.
//
// Por eso aqui no se fija ningun numero (una cifra absoluta en un test contra la BD envejece y falla por
// otra razon): se fija el ACTO. Se mide, se inserta un segundo diagnostico para una evaluacion que ya
// tiene uno, se vuelve a medir y las cuentas tienen que ser las mismas. Y lo mismo con una segunda toma de
// BIS, que es el otro lado por donde la multiplicacion estaba abierta (`bis_measurements` tampoco tiene
// unico por evaluacion).
//
// TODO SE ESCRIBE DENTRO DE UNA TRANSACCION QUE SE DESHACE, porque esto corre contra la base local con
// datos: un candado que deje basura sembrada cambia lo que mide el candado siguiente.
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

/** Las cinco cuentas del panel, de la vista, en una sola ida. */
const CUENTAS = `
  select
    (select count(*)::int from public.evaluaciones_vigentes) as filas,
    (select count(distinct id)::int from public.evaluaciones_vigentes) as evaluaciones,
    (select count(*)::int from public.evaluaciones_vigentes where diagnosis_id is not null) as con_diagnostico,
    (select count(*)::int from public.evaluaciones_vigentes where importada) as importadas,
    (select count(*)::int from public.evaluaciones_para_investigacion) as cohorte
`;

describe.skipIf(!HAS_DB)("la reemision no mueve las cuentas (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let sql: any;

  beforeAll(async () => {
    if (!HAS_DB) return;
    ({ db } = await import("@/db"));
    ({ sql } = await import("drizzle-orm"));
  });

  const cuentas = async (ejecutor: any) => {
    const filas = await ejecutor.execute(sql.raw(CUENTAS));
    return (filas as unknown as Record<string, number>[])[0];
  };

  it("la vista da UNA fila por evaluacion, hoy, sin tocar nada", async () => {
    const c = await cuentas(db);
    expect(
      c.filas,
      "si las filas superan las evaluaciones, la vista volvio a multiplicar: un join plano a diagnoses o a bis_measurements",
    ).toBe(c.evaluaciones);
  });

  it("un SEGUNDO diagnostico en la misma evaluacion no cambia ninguna cuenta", async () => {
    let antes: Record<string, number> | undefined;
    let despues: Record<string, number> | undefined;
    let diagnosticoVigente: string | null = null;
    let nuevoId: string | null = null;

    await expect(
      db.transaction(async (tx: any) => {
        // Una evaluacion que la vista ya cuenta Y que tiene diagnostico: es la unica que se puede reemitir.
        const [objetivo] = (await tx.execute(
          sql`select id, diagnosis_id from public.evaluaciones_vigentes
               where diagnosis_id is not null limit 1`,
        )) as unknown as { id: string; diagnosis_id: string }[];
        if (!objetivo) {
          throw new Error(
            "el seed no tiene ninguna evaluacion vigente con diagnostico: este caso no probo nada",
          );
        }

        antes = await cuentas(tx);

        // LA REEMISION, EN SU FORMA MINIMA: copiar la fila sellada con id nuevo y `created_at` posterior.
        // Es exactamente lo que hace `reemitirDiagnostico` (insertar, no marcar), sin el pipeline.
        const [nuevo] = (await tx.execute(
          sql`insert into diagnoses (evaluation_id, efr_state_number, phenotype_id, fr_sector_id,
                                     diagnosis_name, engine_version, model_version_id, rules_version,
                                     survey_version_id, emission_versions, created_at)
              select evaluation_id, efr_state_number, phenotype_id, fr_sector_id,
                     diagnosis_name, '9.9.9-candado', model_version_id, rules_version,
                     survey_version_id, emission_versions, now() + interval '1 second'
                from diagnoses where id = ${objetivo.diagnosis_id}
              returning id`,
        )) as unknown as { id: string }[];
        nuevoId = nuevo.id;

        despues = await cuentas(tx);
        const [fila] = (await tx.execute(
          sql`select diagnosis_id, engine_version from public.evaluaciones_vigentes
               where id = ${objetivo.id}`,
        )) as unknown as { diagnosis_id: string; engine_version: string }[];
        diagnosticoVigente = fila?.diagnosis_id ?? null;

        // Y SE DESHACE. El throw es el rollback; la aserccion vive afuera.
        throw new Error("rollback a proposito");
      }),
    ).rejects.toThrow("rollback a proposito");

    expect(antes).toBeDefined();
    expect(despues, "la transaccion no llego a medir despues de insertar").toBeDefined();
    expect(
      despues,
      "reemitir un diagnostico cambio una cuenta de evaluaciones: es el defecto de la 0234",
    ).toEqual(antes);
    // Y LO QUE SI TIENE QUE CAMBIAR: cual es el diagnostico vigente de esa evaluacion. Sin esto el caso
    // pasaria con una vista que ignore los diagnosticos nuevos, que seria el error contrario.
    expect(diagnosticoVigente, "la vista tiene que seguir al diagnostico nuevo, no al viejo").toBe(
      nuevoId,
    );
  });

  it("una SEGUNDA toma de BIS en la misma evaluacion no cambia ninguna cuenta", async () => {
    let antes: Record<string, number> | undefined;
    let despues: Record<string, number> | undefined;
    let medicionVigente: string | null = null;
    let nuevoId: string | null = null;

    await expect(
      db.transaction(async (tx: any) => {
        const [objetivo] = (await tx.execute(
          sql`select id, measurement_id from public.evaluaciones_vigentes
               where measurement_id is not null limit 1`,
        )) as unknown as { id: string; measurement_id: string }[];
        if (!objetivo) {
          throw new Error("el seed no tiene ninguna evaluacion vigente con medicion: este caso no probo nada");
        }

        antes = await cuentas(tx);

        const [nuevo] = (await tx.execute(
          sql`insert into bis_measurements (evaluation_id, device_id, measurement_date, created_at)
              select evaluation_id, device_id, measurement_date, now() + interval '1 second'
                from bis_measurements where id = ${objetivo.measurement_id}
              returning id`,
        )) as unknown as { id: string }[];
        nuevoId = nuevo.id;

        despues = await cuentas(tx);
        const [fila] = (await tx.execute(
          sql`select measurement_id from public.evaluaciones_vigentes where id = ${objetivo.id}`,
        )) as unknown as { measurement_id: string }[];
        medicionVigente = fila?.measurement_id ?? null;

        throw new Error("rollback a proposito");
      }),
    ).rejects.toThrow("rollback a proposito");

    expect(despues, "la transaccion no llego a medir despues de insertar").toBeDefined();
    expect(
      despues,
      "reemplazar la toma de BIS cambio una cuenta de evaluaciones: la vista volvio a multiplicar por medicion",
    ).toEqual(antes);
    expect(medicionVigente, "la toma vigente es la que entro despues").toBe(nuevoId);
  });

  it("la cohorte autorizada no supera a las vigentes, contadas por evaluacion", async () => {
    const c = await cuentas(db);
    expect(c.cohorte).toBeLessThanOrEqual(c.evaluaciones);
    expect(c.con_diagnostico).toBeLessThanOrEqual(c.evaluaciones);
    expect(c.importadas).toBeLessThanOrEqual(c.evaluaciones);
  });
});
