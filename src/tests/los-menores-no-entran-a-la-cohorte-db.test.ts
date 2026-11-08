import { beforeAll, describe, expect, it, vi } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// UN MENOR DE EDAD NO ENTRA A LA COHORTE DE INVESTIGACION  ·  EL CANDADO DE LA 0239
//
// ═══ EL DEFECTO QUE CIERRA ═══
//
// La simulacion del 2026-11-07 (17:51), corrida contra la nube: en `evaluaciones_para_investigacion`
// entraba UNA consulta de una persona de 13 años al medirse, con el motor 1.0.0. Santiago: *"Los menores
// quedan FUERA de la cohorte de investigacion (o marcados y excluidos por defecto en /obbia), con
// candado."*
//
// ═══ POR QUE NO ALCANZA CON MIRAR EL SQL DE LA MIGRACION ═══
//
// Un `toContain("menor_al_medirse")` sobre el archivo comprueba que alguien escribio una palabra. Lo que
// hay que poder afirmar es que la vista SE COMPORTA asi con un dato que todavia no existe, y eso solo se
// puede medir escribiendo uno: se siembra un paciente menor con su consentimiento de investigacion en
// regla, se mide, y la consulta tiene que estar DENTRO de `evaluaciones_vigentes` y FUERA de la cohorte.
//
// LAS DOS MITADES IMPORTAN IGUAL. Si solo se comprobara la exclusion, una vista que se dejara fuera a
// todo el mundo pasaria el caso; y la consulta de un menor SI tiene que seguir contando como consulta
// atendida, que es por lo que la marca y la exclusion viven en vistas distintas.
//
// Y EL TERCER CASO ES EL QUE DE VERDAD PUEDE ROMPERSE AL EDITAR: la edad se mide A LA FECHA DE LA TOMA.
// Escrita contra `now()`, un menor que cumple 18 el mes que viene entraria a la cohorte sin que su
// medicion hubiera cambiado, y nada fallaria. El caso siembra a alguien que HOY es mayor y que era menor
// el dia que se midio.
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

describe.skipIf(!HAS_DB)("los menores no entran a la cohorte de investigacion (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let sql: any;

  beforeAll(async () => {
    if (!HAS_DB) return;
    ({ db } = await import("@/db"));
    ({ sql } = await import("drizzle-orm"));
  });

  /**
   * Siembra una consulta con medicion y consentimiento de investigacion vigente, con la edad que se pida
   * A LA FECHA DE LA TOMA, y devuelve lo que las dos vistas dicen de ella.
   *
   * `aniosAlMedirse` es la edad el dia de la medicion; `haceCuantosAnios` es hace cuanto fue esa
   * medicion. Con (17, 0) se siembra un menor de hoy; con (17, 5) alguien que hoy tiene 22 y se midio
   * siendo menor, que es el caso que separa "la edad a la toma" de "la edad a hoy".
   */
  const sembrarYMirar = async (
    tx: any,
    aniosAlMedirse: number,
    haceCuantosAnios: number,
  ): Promise<{ enVigentes: number; enCohorte: number; marcado: boolean | null }> => {
    // Se cuelga de una organizacion y un profesional que ya existan: lo que se mide es la vista, no la
    // capacidad de sembrar una clinica entera.
    const [base] = (await tx.execute(sql`
      select v.organization_id, v.professional_id
        from public.evaluaciones_vigentes v
       limit 1`)) as unknown as { organization_id: string; professional_id: string }[];
    if (!base) throw new Error("el seed no tiene ninguna evaluacion vigente: este caso no probo nada");

    const [paciente] = (await tx.execute(sql`
      insert into patients (organization_id, document_type, document_number, cuenta_como_de_prueba)
      values (${base.organization_id}, 'CC', ${`CANDADO-${Date.now()}`}, false)
      returning id`)) as unknown as { id: string }[];

    await tx.execute(sql`
      insert into patient_profiles (patient_id, first_name, last_name, birth_date)
      values (${paciente.id}, 'Candado', 'Menor',
              (now() - interval '1 year' * ${haceCuantosAnios + aniosAlMedirse}
                      - interval '40 days')::date)`);

    // EL CONSENTIMIENTO EN REGLA, a proposito: sin el, la fila saldria de la cohorte por la razon
    // EQUIVOCADA y el caso pasaria verde con la 0239 sin aplicar.
    await tx.execute(sql`
      insert into patient_consents (patient_id, consent_type, consent_version, document_hash)
      values (${paciente.id}, 'investigacion', 'candado-0239', 'candado-0239')`);

    const [evaluacion] = (await tx.execute(sql`
      insert into evaluations (patient_id, professional_id, organization_id, type, status)
      values (${paciente.id}, ${base.professional_id}, ${base.organization_id}, 'inicial', 'completed')
      returning id`)) as unknown as { id: string }[];

    await tx.execute(sql`
      insert into bis_measurements (evaluation_id, measurement_date)
      values (${evaluacion.id}, (now() - interval '1 year' * ${haceCuantosAnios})::date)`);

    const [fila] = (await tx.execute(sql`
      select
        (select count(*)::int from public.evaluaciones_vigentes where id = ${evaluacion.id}) as en_vigentes,
        (select count(*)::int from public.evaluaciones_para_investigacion where id = ${evaluacion.id}) as en_cohorte,
        (select menor_al_medirse from public.evaluaciones_vigentes where id = ${evaluacion.id}) as marcado
    `)) as unknown as { en_vigentes: number; en_cohorte: number; marcado: boolean | null }[];

    return { enVigentes: fila.en_vigentes, enCohorte: fila.en_cohorte, marcado: fila.marcado };
  };

  const enTransaccion = async (fn: (tx: any) => Promise<void>) => {
    await expect(
      db.transaction(async (tx: any) => {
        await fn(tx);
        throw new Error("rollback a proposito");
      }),
    ).rejects.toThrow("rollback a proposito");
  };

  it("una consulta de un menor queda MARCADA en vigentes y FUERA de la cohorte", async () => {
    let r: Awaited<ReturnType<typeof sembrarYMirar>> | undefined;
    await enTransaccion(async (tx) => {
      r = await sembrarYMirar(tx, 13, 0);
    });
    expect(r, "la transaccion no llego a medir").toBeDefined();
    expect(r?.enVigentes, "la consulta de un menor desaparecio de evaluaciones_vigentes").toBe(1);
    expect(r?.marcado, "la consulta de un menor no quedo marcada").toBe(true);
    expect(r?.enCohorte, "un menor entro a la cohorte de investigacion").toBe(0);
  });

  it("CONTROL: con la MISMA siembra y 30 años, la consulta SI entra a la cohorte", async () => {
    // Sin esto, una vista que excluyera a todo el mundo (o un consentimiento mal sembrado) haria pasar el
    // caso de arriba sin comprobar nada.
    let r: Awaited<ReturnType<typeof sembrarYMirar>> | undefined;
    await enTransaccion(async (tx) => {
      r = await sembrarYMirar(tx, 30, 0);
    });
    expect(r?.enVigentes).toBe(1);
    expect(r?.marcado, "una persona de 30 años quedo marcada como menor").toBe(false);
    expect(r?.enCohorte, "la siembra no entra a la cohorte ni siendo mayor: el caso no mide nada").toBe(1);
  });

  it("la edad se mide A LA FECHA DE LA TOMA: quien hoy tiene 22 y se midio con 17 sigue fuera", async () => {
    // El error facil es escribir la condicion contra `now()`. Con eso, este caso entraria a la cohorte y
    // nada fallaria: la toma de una persona de 17 años se publicaria porque hoy ya es mayor.
    let r: Awaited<ReturnType<typeof sembrarYMirar>> | undefined;
    await enTransaccion(async (tx) => {
      r = await sembrarYMirar(tx, 17, 5);
    });
    expect(r?.marcado, "la edad se esta midiendo a hoy y no a la fecha de la toma").toBe(true);
    expect(r?.enCohorte, "una toma hecha a los 17 años entro a la cohorte").toBe(0);
  });

  it("sin fecha de nacimiento NO se marca como menor: un dato que falta no es una edad", async () => {
    // Tratar "no se sabe" como "es menor" sacaria de la cohorte a adultos de los que solo falta un dato,
    // y lo haria en silencio. La falta de fecha de nacimiento es un problema de calidad, con su propia
    // salida en la ficha del paciente.
    let marcado: boolean | null | undefined;
    let enCohorte: number | undefined;
    await enTransaccion(async (tx) => {
      const [base] = (await tx.execute(sql`
        select v.organization_id, v.professional_id from public.evaluaciones_vigentes v limit 1`)) as unknown as {
        organization_id: string;
        professional_id: string;
      }[];
      const [paciente] = (await tx.execute(sql`
        insert into patients (organization_id, document_type, document_number, cuenta_como_de_prueba)
        values (${base.organization_id}, 'CC', ${`CANDADO-SF-${Date.now()}`}, false)
        returning id`)) as unknown as { id: string }[];
      await tx.execute(sql`
        insert into patient_profiles (patient_id, first_name, last_name, birth_date)
        values (${paciente.id}, 'Candado', 'SinFecha', null)`);
      await tx.execute(sql`
        insert into patient_consents (patient_id, consent_type, consent_version, document_hash)
        values (${paciente.id}, 'investigacion', 'candado-0239', 'candado-0239')`);
      const [ev] = (await tx.execute(sql`
        insert into evaluations (patient_id, professional_id, organization_id, type, status)
        values (${paciente.id}, ${base.professional_id}, ${base.organization_id}, 'inicial', 'completed')
        returning id`)) as unknown as { id: string }[];
      await tx.execute(sql`
        insert into bis_measurements (evaluation_id, measurement_date) values (${ev.id}, now()::date)`);
      const [fila] = (await tx.execute(sql`
        select
          (select menor_al_medirse from public.evaluaciones_vigentes where id = ${ev.id}) as marcado,
          (select count(*)::int from public.evaluaciones_para_investigacion where id = ${ev.id}) as en_cohorte
      `)) as unknown as { marcado: boolean | null; en_cohorte: number }[];
      marcado = fila.marcado;
      enCohorte = fila.en_cohorte;
    });
    expect(marcado, "una fecha de nacimiento ausente se leyo como menor de edad").toBe(false);
    expect(enCohorte, "un adulto sin fecha de nacimiento quedo fuera de la cohorte").toBe(1);
  });
});
