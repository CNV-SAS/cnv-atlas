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
               where diagnosis_id is not null order by id limit 1`,
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

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // EL TERCER LADO, QUE SE ABRIO EL 2026-11-07: UNA FILA SUCESORA DE `reports`
  //
  // La reparacion de las capas congeladas no reescribe el informe sellado: INSERTA uno que lo sucede (el
  // trigger `prevent_report_snapshot_mutation` rechaza lo otro, y con razon). Asi que desde ese dia una
  // consulta reemitida tiene TRES informes, y cualquier cuenta que recorra `reports` sin quedarse con el
  // ultimo por evaluacion empieza a contar de mas, igual que paso con `diagnoses` en la 0234.
  //
  // LAS VISTAS NO MIRAN `reports` (toman el diagnostico por LATERAL), asi que esto no deberia moverlas. Es
  // justamente lo que hay que poder AFIRMAR: el candado de la 0234 fijo el acto para los otros dos lados y
  // este cierra el que faltaba, para que la proxima reparacion por sucesion no tenga que ir a mano.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("una fila SUCESORA de reports (la reparacion por sucesion) no cambia ninguna cuenta", async () => {
    let antes: Record<string, number> | undefined;
    let despues: Record<string, number> | undefined;
    let nuevoId: string | null = null;
    let informeVigente: string | null = null;

    await expect(
      db.transaction(async (tx: any) => {
        // CON JOIN A `patients`: en la base local hay informes cuyo paciente ya no existe, y la clave ajena
        // tumbaria el caso por una razon que no dice nada sobre lo que se mide.
        const [objetivo] = (await tx.execute(sql`
          select r.id, r.evaluation_id
            from reports r
            join patients p on p.id = r.patient_id
            join public.evaluaciones_vigentes v on v.id = r.evaluation_id
           where r.type = 'paciente'
           order by r.created_at desc
           limit 1`)) as unknown as { id: string; evaluation_id: string }[];
        if (!objetivo) {
          throw new Error("el seed no tiene informes de paciente en la cohorte: este caso no probo nada");
        }

        antes = await cuentas(tx);

        const [nuevo] = (await tx.execute(sql`
          insert into reports (evaluation_id, patient_id, type, status, snapshot, professional_notes,
                               trajectory, trajectory_communicated_at, trajectory_communicated_by,
                               created_at)
          select r.evaluation_id, r.patient_id, r.type, 'draft',
                 r.snapshot || '{"rutasContent":[]}'::jsonb,
                 r.professional_notes, r.trajectory, r.trajectory_communicated_at,
                 r.trajectory_communicated_by, now() + interval '1 second'
            from reports r where r.id = ${objetivo.id}
          returning id`)) as unknown as { id: string }[];
        nuevoId = nuevo.id;

        despues = await cuentas(tx);
        const [vig] = (await tx.execute(sql`
          select id from reports
           where evaluation_id = ${objetivo.evaluation_id} and type = 'paciente'
           order by created_at desc limit 1`)) as unknown as { id: string }[];
        informeVigente = vig?.id ?? null;

        throw new Error("rollback a proposito");
      }),
    ).rejects.toThrow("rollback a proposito");

    expect(antes).toBeDefined();
    expect(despues, "la transaccion no llego a medir despues de insertar").toBeDefined();
    expect(
      despues,
      "una fila sucesora de reports movio una cuenta de evaluaciones: alguna vista empezo a mirar reports",
    ).toEqual(antes);
    // Y LO QUE SI TIENE QUE CAMBIAR, por la misma razon que en el caso del diagnostico: el informe
    // vigente de esa consulta pasa a ser el nuevo. Sin esto, el caso pasaria con una base que ignore la
    // insercion, que es el error contrario.
    expect(informeVigente, "la sucesora tiene que ser el informe vigente de su consulta").toBe(nuevoId);
  });

  it("una SEGUNDA toma de BIS en la misma evaluacion no cambia ninguna cuenta", async () => {
    let antes: Record<string, number> | undefined;
    let despues: Record<string, number> | undefined;
    let medicionVigente: string | null = null;
    let nuevoId: string | null = null;

    await expect(
      db.transaction(async (tx: any) => {
        // CON `order by`: sin el, Postgres puede devolver otra fila en cada corrida, y entonces el caso
        // mide una evaluacion distinta cada vez. Ya nos costo 451 valores sobre 352 mediciones.
        const [objetivo] = (await tx.execute(
          sql`select id, measurement_id from public.evaluaciones_vigentes
               where measurement_id is not null order by id limit 1`,
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
        // Y SUS CRUDOS, que no es un adorno del fixture: la huella de la toma sale de las cuatro lecturas
        // electricas, y `huella_repetida` decide si la consulta entra a la cohorte. Una copia SIN crudos
        // dejaria a la evaluacion sin huella y podria devolverla a la cohorte, asi que el caso fallaria
        // por lo que el fixture no copio y no por la vista. Reemplazar una toma con las mismas lecturas es
        // el escenario que de verdad no debe mover nada.
        await tx.execute(
          sql`insert into bis_raw_values (measurement_id, variable_name, value, origin, derived_formula_version)
              select ${nuevo.id}::uuid, variable_name, value, origin, derived_formula_version
                from bis_raw_values where measurement_id = ${objetivo.measurement_id}`,
        );

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
