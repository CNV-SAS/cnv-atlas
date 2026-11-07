import { beforeAll, describe, expect, it, vi } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL MENSAJE PARA EL PACIENTE, CONTRA LA BASE  ·  0237, 2026-11-07
//
// ═══ QUE SE COMPRUEBA, Y POR QUE NO BASTA EL CANDADO DE CODIGO ═══
//
// `el-informe-que-pidio-santiago` comprueba que el lector PIDE la columna y que la migracion la declara.
// Lo que solo la base puede decir es que el tope de 200 caracteres EXISTE ahi: declarado en Zod, lo
// respeta el formulario; declarado en la COLUMNA, no hay via de escritura (un script, una importacion,
// una consulta a mano) que pueda dejar un mensaje capaz de partir el informe en dos hojas.
//
// Es la misma leccion que dejo la reparacion de las capas congeladas el mismo dia: un candado que lee el
// codigo comprueba lo que escribimos; solo una prueba contra la BD real comprueba lo que la base acepta.
//
// Y SE COMPRUEBA LA REGLA DE LECTURA, que es la que tiene consecuencia clinica: el informe toma la ultima
// fila QUE TENGA mensaje, no el mensaje de la ultima fila. Si fuera lo segundo, escribir una nota clinica
// mas (sin mensaje) le borraria del informe el mensaje que ya se le habia dejado al paciente.
//
// TODO DENTRO DE TRANSACCIONES QUE SE DESHACEN, y cada caso en la suya: en Postgres una sentencia que
// falla ABORTA la transaccion, asi que lo que venga despues fallaria con "current transaction is aborted"
// y mediria otra cosa.
//
// SE AUTO-SALTA sin DATABASE_URL. Necesita la 0237 aplicada (`pnpm db:probar`).
// ══════════════════════════════════════════════════════════════════════════════════════════════════

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el guard salta el bloque.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("el mensaje para el paciente (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let sql: any;

  beforeAll(async () => {
    if (!HAS_DB) return;
    ({ db } = await import("@/db"));
    ({ sql } = await import("drizzle-orm"));
  });

  /** Un tratamiento cualquiera, para poder colgarle notas. */
  const unTratamiento = async (ejecutor: any) => {
    const [fila] = (await ejecutor.execute(
      sql`select id from treatments order by created_at desc limit 1`,
    )) as unknown as { id: string }[];
    return fila ?? null;
  };

  const motivoDeLaBase = async (fn: () => Promise<unknown>): Promise<string> => {
    try {
      await fn();
    } catch (e) {
      // El motivo real vive en la CAUSA: Drizzle envuelve el error de Postgres.
      return (e as { cause?: { message?: string } }).cause?.message ?? (e as Error).message;
    }
    return "(no fallo)";
  };

  it("la columna existe, es opcional y su tope son 200 caracteres", async () => {
    const [col] = (await db.execute(sql`
      select is_nullable, character_maximum_length as largo, column_default as predeterminado
        from information_schema.columns
       where table_name = 'treatment_notes' and column_name = 'mensaje_para_el_paciente'`)) as unknown as {
      is_nullable: string;
      largo: number;
      predeterminado: string | null;
    }[];
    expect(col, "falta la columna: aplica la migracion 0237 (pnpm db:probar)").toBeDefined();
    expect(col.largo, "el tope de la columna dejo de ser 200").toBe(200);
    // OPCIONAL POR DISEÑO: null significa "no le dejo mensaje", y entonces el informe sale solo.
    expect(col.is_nullable).toBe("YES");
    expect(col.predeterminado, "un default le inventaria un mensaje a quien no escribio ninguno").toBeNull();
  });

  it("y la BASE rechaza un mensaje mas largo, no solo Zod", async () => {
    const motivo = await motivoDeLaBase(() =>
      db.transaction(async (tx: any) => {
        const t = await unTratamiento(tx);
        if (!t) throw new Error("el seed no tiene tratamientos: este caso no probo nada");
        await tx.execute(sql`
          insert into treatment_notes (treatment_id, note, mensaje_para_el_paciente)
          values (${t.id}, 'nota del candado', ${"x".repeat(201)})`);
      }),
    );
    expect(motivo).toMatch(/value too long|character varying/i);
  });

  it("la nota clinica, en cambio, NO tiene tope: es un registro clinico", async () => {
    // El defecto que la 0237 cierra: hasta el 7 de noviembre `note` estaba topada en 200 por una razon de
    // PAPEL. Aqui se comprueba que la base acepta una nota larga, que es lo que hace cierto el cambio.
    let entro = false;
    await expect(
      db.transaction(async (tx: any) => {
        const t = await unTratamiento(tx);
        if (!t) throw new Error("el seed no tiene tratamientos: este caso no probo nada");
        await tx.execute(sql`
          insert into treatment_notes (treatment_id, note)
          values (${t.id}, ${"palabra ".repeat(200)})`);
        entro = true;
        throw new Error("rollback a proposito");
      }),
    ).rejects.toThrow("rollback a proposito");
    expect(entro, "la base rechazo una nota clinica larga: el tope volvio a `note`").toBe(true);
  });

  it("el informe toma la ultima fila QUE TENGA mensaje, no el mensaje de la ultima fila", async () => {
    let leido: string | null | undefined;
    await expect(
      db.transaction(async (tx: any) => {
        const [t] = (await tx.execute(sql`
          select t.id, d.evaluation_id
            from treatments t join diagnoses d on d.id = t.diagnosis_id
           order by t.created_at desc limit 1`)) as unknown as {
          id: string;
          evaluation_id: string;
        }[];
        if (!t) throw new Error("el seed no tiene tratamientos con diagnostico: este caso no probo nada");

        // PRIMERO el mensaje, DESPUES una nota clinica sin mensaje. Es la secuencia real: la profesional
        // le deja una linea al paciente y mas tarde anota algo para el equipo.
        await tx.execute(sql`
          insert into treatment_notes (treatment_id, note, mensaje_para_el_paciente, created_at)
          values (${t.id}, 'nota uno', 'Seguimos con lo acordado.', now() + interval '1 second')`);
        await tx.execute(sql`
          insert into treatment_notes (treatment_id, note, created_at)
          values (${t.id}, 'nota dos, solo clinica', now() + interval '2 seconds')`);

        // LA MISMA CONSULTA DEL LECTOR, no una parecida: si aqui se escribiera otra, el candado podria
        // pasar mientras el informe lee algo distinto.
        const [fila] = (await tx.execute(sql`
          select n.mensaje_para_el_paciente as mensaje
            from treatment_notes n
            join treatments t on t.id = n.treatment_id
            join diagnoses d on d.id = t.diagnosis_id
           where d.evaluation_id = ${t.evaluation_id}
             and n.mensaje_para_el_paciente is not null
             and btrim(n.mensaje_para_el_paciente) <> ''
           order by n.created_at desc
           limit 1`)) as unknown as { mensaje: string }[];
        leido = fila?.mensaje ?? null;

        throw new Error("rollback a proposito");
      }),
    ).rejects.toThrow("rollback a proposito");

    expect(
      leido,
      "la nota clinica posterior borro del informe el mensaje que ya se le habia dejado al paciente",
    ).toBe("Seguimos con lo acordado.");
  });
});
