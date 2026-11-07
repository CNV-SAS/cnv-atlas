import { beforeAll, describe, expect, it, vi } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA REPARACION DE LAS CAPAS CONGELADAS, CONTRA EL TRIGGER DE VERDAD  ·  2026-11-07
//
// ═══ POR QUE ESTE CANDADO EXISTE: LA BASE DIJO NO EN PRODUCCION, Y NINGUNA PRUEBA LO HABIA DICHO ═══
//
// La primera version de la reparacion hacia `update reports set snapshot = snapshot || ...`. Las pruebas
// de unidad (16, verdes) comprobaban la FORMA del codigo: que el parche solo añadiera claves, que el motor
// fuera 3.x, que hubiera rastro. Ninguna podia ver lo unico que importaba: que `reports.snapshot` tiene un
// trigger que lo prohibe (`prevent_report_snapshot_mutation`, 0003, extendido en la 0010, 0033 y 0034).
// Santiago pulso el boton y la pantalla se cayo con un 500: *"reports.snapshot es inmutable: no se permite
// modificarlo"* (P0001).
//
// LA LECCION, Y ES LA DE LA CASA: un candado que lee el codigo comprueba lo que escribimos; solo una
// prueba contra la BD REAL comprueba lo que la base acepta. Es la misma familia que los embeds ambiguos de
// PostgREST, que tsc tampoco ve.
//
// ═══ QUE SE COMPRUEBA, Y POR QUE NO SE LLAMA AL SERVICIO ═══
//
// El servicio abre su propia transaccion con el `db` global, asi que no se puede meter dentro de una
// transaccion que se deshaga: correrlo aqui dejaria una fila sembrada en la base local, y `reports` no
// admite DELETE (el mismo trigger), o sea que no habria limpieza posible. Lo que se comprueba es la
// PROPIEDAD, con SQL equivalente al del servicio y todo dentro de transacciones que se revierten:
//
//   1. el `update` del snapshot lo RECHAZA la base (la forma que fallo, por si alguien la restaura);
//   2. el DELETE tambien;
//   3. la fila SUCESORA con las tres capas SI entra, y pasa a ser la vigente de esa consulta.
//
// Y el candado de unidad (`completar-las-capas-congeladas`) amarra que el servicio use `insert` y no
// `update`, asi que las dos piezas juntas cubren el acto y su forma.
//
// CADA CASO EN SU PROPIA TRANSACCION, y no es estilo: en Postgres una sentencia que falla ABORTA la
// transaccion, asi que todo lo que venga despues falla con "current transaction is aborted" y el caso
// siguiente mediria otra cosa.
//
// Se AUTO-SALTA sin DATABASE_URL.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el guard salta el bloque.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("la reparacion de las capas congeladas (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let sql: any;

  beforeAll(async () => {
    if (!HAS_DB) return;
    ({ db } = await import("@/db"));
    ({ sql } = await import("drizzle-orm"));
  });

  /**
   * Un informe de paciente cualquiera, el vigente de su consulta.
   *
   * CON EL JOIN A `patients`, y no es decoracion: en la base local hay informes cuyo paciente ya no
   * existe (una limpieza vieja los dejo huerfanos), y al insertar la fila sucesora de uno de esos el
   * primer intento de este candado se cayo con una violacion de clave ajena. Eso no prueba nada sobre la
   * reparacion: solo diria que el dato de prueba estaba roto.
   */
  const unInformeVigente = async (ejecutor: any) => {
    const [fila] = (await ejecutor.execute(sql`
      select r.id, r.evaluation_id, r.patient_id
        from reports r
        join patients p on p.id = r.patient_id
       where r.type = 'paciente'
         and r.created_at = (
           select max(r2.created_at) from reports r2
            where r2.evaluation_id = r.evaluation_id and r2.type = 'paciente'
         )
       order by r.created_at desc
       limit 1`)) as unknown as { id: string; evaluation_id: string; patient_id: string }[];
    return fila ?? null;
  };

  /**
   * El motivo REAL de un fallo de la base, que vive en la CAUSA y no en el mensaje.
   *
   * Drizzle envuelve el error de Postgres en "Failed query: <sql> params: ...". Afirmar sobre ese mensaje
   * daria verde con cualquier fallo (una columna mal escrita, una clave ajena) y el candado diria que el
   * trigger actuo cuando lo que paso fue otra cosa. Es la leccion de "Drizzle envuelve el error de
   * Postgres", y es ademas lo que el servicio tiene que leer para poder reportar la fila que fallo.
   */
  const motivoDeLaBase = async (fn: () => Promise<unknown>): Promise<string> => {
    try {
      await fn();
    } catch (e) {
      return (e as { cause?: { message?: string } }).cause?.message ?? (e as Error).message;
    }
    return "(no fallo)";
  };

  it("el trigger RECHAZA modificar el snapshot, que es la forma que fallo en produccion", async () => {
    const motivo = await motivoDeLaBase(() =>
      db.transaction(async (tx: any) => {
        const objetivo = await unInformeVigente(tx);
        if (!objetivo) throw new Error("el seed no tiene informes de paciente: este caso no probo nada");
        // EXACTAMENTE la sentencia que Drizzle mandaba, con la clave que faltaba.
        await tx.execute(sql`
          update reports
             set snapshot = snapshot || '{"rutasContent":[]}'::jsonb
           where id = ${objetivo.id}`);
      }),
    );
    expect(motivo).toMatch(/snapshot es inmutable/);
  });

  it("y RECHAZA el DELETE, asi que una fila mal escrita no se puede borrar: se sucede", async () => {
    const motivo = await motivoDeLaBase(() =>
      db.transaction(async (tx: any) => {
        const objetivo = await unInformeVigente(tx);
        if (!objetivo) throw new Error("el seed no tiene informes de paciente: este caso no probo nada");
        await tx.execute(sql`delete from reports where id = ${objetivo.id}`);
      }),
    );
    expect(motivo).toMatch(/no se permite DELETE/);
  });

  it("la fila SUCESORA con las tres capas SI entra, y pasa a ser la vigente", async () => {
    let tieneLasTres: { rutas: boolean; efr: boolean; caveats: boolean } | undefined;
    let vigenteDespues: string | null = null;
    let nuevoId: string | null = null;
    let anteriorIntacto: boolean | undefined;

    await expect(
      db.transaction(async (tx: any) => {
        const objetivo = await unInformeVigente(tx);
        if (!objetivo) throw new Error("el seed no tiene informes de paciente: este caso no probo nada");

        // EL SNAPSHOT ANTERIOR, COPIADO ENTERO, mas las tres claves. Es lo que hace el servicio: no
        // recalcula nada, asi que ninguna cifra se mueve.
        const [nuevo] = (await tx.execute(sql`
          insert into reports (evaluation_id, patient_id, type, status, snapshot, professional_notes,
                               trajectory, trajectory_communicated_at, trajectory_communicated_by,
                               created_at)
          select r.evaluation_id, r.patient_id, r.type, 'draft',
                 r.snapshot || '{"rutasContent":[],"efrContent":{},"validityCaveats":[]}'::jsonb,
                 r.professional_notes, r.trajectory, r.trajectory_communicated_at,
                 r.trajectory_communicated_by, now() + interval '1 second'
            from reports r where r.id = ${objetivo.id}
          returning id`)) as unknown as { id: string }[];
        nuevoId = nuevo.id;

        const [capas] = (await tx.execute(sql`
          select jsonb_exists(snapshot, 'rutasContent') as rutas,
                 jsonb_exists(snapshot, 'efrContent') as efr,
                 jsonb_exists(snapshot, 'validityCaveats') as caveats
            from reports where id = ${nuevo.id}`)) as unknown as {
          rutas: boolean;
          efr: boolean;
          caveats: boolean;
        }[];
        tieneLasTres = capas;

        // LA VIGENTE PASA A SER LA NUEVA: es la regla de la casa (la ultima fila), y es lo que hace que
        // la pantalla deje de decir "0 rutas activas".
        const [vig] = (await tx.execute(sql`
          select id from reports
           where evaluation_id = ${objetivo.evaluation_id} and type = 'paciente'
           order by created_at desc limit 1`)) as unknown as { id: string }[];
        vigenteDespues = vig?.id ?? null;

        // Y LA ANTERIOR SIGUE ENTERA, que es la mitad que el trigger protege.
        const [ant] = (await tx.execute(sql`
          select (snapshot is not null) as intacto from reports where id = ${objetivo.id}`)) as unknown as {
          intacto: boolean;
        }[];
        anteriorIntacto = ant?.intacto;

        throw new Error("rollback a proposito");
      }),
    ).rejects.toThrow("rollback a proposito");

    expect(tieneLasTres, "la insercion no llego a medirse").toBeDefined();
    expect(tieneLasTres).toEqual({ rutas: true, efr: true, caveats: true });
    expect(vigenteDespues, "la fila nueva tiene que ser la vigente de su consulta").toBe(nuevoId);
    expect(anteriorIntacto, "la fila anterior se quedo sin snapshot").toBe(true);
  });
});
