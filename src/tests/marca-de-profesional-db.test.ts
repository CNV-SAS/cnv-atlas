import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ CANDADO DE LA MARCA DE PROFESIONAL DE PRUEBA, DESDE LA PANTALLA (Santiago, 2026-10-04) ═══
//
// LO QUE VIGILA, y no es el boton: que marcar al PROFESIONAL arrastre lo que tiene que arrastrar. La columna
// `professional_profiles.is_test` existe desde la 0199 y hasta hoy solo se escribia por SQL; al darle una
// pantalla, lo que hay que probar es que un clic produzca el MISMO efecto que producia el SQL.
//
// Y ESE EFECTO NO LO HACE ESTE ESCRITOR: lo hacen los triggers de la 0202 (sus pacientes pasan a contar como
// de prueba) y de la 0203 (sus ventas dejan de contar). El escritor cambia UNA columna, y esa es justamente la
// razon por la que es seguro. Lo que este candado comprueba es que esa cadena siga enganchada: si alguien
// tocara los triggers, un clic dejaria la marca puesta y las cifras contando igual.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("marcar un profesional de prueba (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let escritor: typeof import("@/modules/professionals/data/marca-de-prueba-writer");
  let profId: string;
  let actorId: string;
  let pacienteId: string;
  let ventaId: string;
  let marcaOriginal = false;

  const dato = async (tabla: string, campo: string, id: string): Promise<boolean> => {
    const [f] = await db.execute(dsql`select ${dsql.raw(campo)} as v from ${dsql.raw(tabla)} where id = ${id}::uuid`);
    return Boolean(f?.v);
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    escritor = await import("@/modules/professionals/data/marca-de-prueba-writer");
    // ═══ EL QUE MENOS VENTAS TENGA, NO EL PRIMERO (2026-10-06) ═══
    //
    // Decia `order by pp.created_at`, que cae en "Profesional Demo" con 16.299 ventas en la base local. Este
    // candado lo marca y lo desmarca CUATRO veces, y cada una dispara el trigger de la 0203 sobre todas sus
    // transacciones: mas de treinta segundos por vuelta, por encima del `testTimeout`.
    //
    // ES EXACTAMENTE LA LECCION QUE ESTE MISMO ARCHIVO YA TENIA ESCRITA unas lineas mas abajo, para el
    // paciente y la venta: "tomar los primeros que haya ata el caso a datos que cambian, y ya nos costo dos
    // veces". La escribi, la apliqué al paciente y a la venta, y no al profesional.
    //
    // Y NO CAMBIA LO QUE EL CANDADO PRUEBA: la cadena de triggers es la misma con una venta que con 16.000.
    const [prof] = await db.execute(dsql`
      select pp.id, coalesce(pp.is_test, false) as is_test, p.organization_id, p.id as profile_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       where coalesce(pp.is_test, false) = false
       order by (select count(*) from transactions t where t.professional_id = pp.id), pp.created_at
       limit 1`);
    profId = prof.id;
    actorId = prof.profile_id;
    marcaOriginal = prof.is_test;

    // UN PACIENTE PROPIO Y UNA VENTA PROPIA, creados aqui: tomar los primeros que haya ata el caso a datos
    // que cambian, y ya nos costo dos veces.
    const [pa] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number)
      values (${prof.organization_id}, 'CC', ${`MPR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`})
      returning id`);
    pacienteId = pa.id;
    await db.execute(dsql`
      insert into patient_professional_relationships (patient_id, professional_id, status)
      values (${pacienteId}::uuid, ${profId}::uuid, 'active')`);
    const [n] = await db.execute(dsql`
      select id from nutraceuticals where coalesce(is_test, false) = false order by name limit 1`);
    const [t] = await db.execute(dsql`
      insert into transactions (organization_id, patient_id, professional_id, status, amount, currency,
                                payment_method, wompi_env, idempotency_key)
      values (${prof.organization_id}, ${pacienteId}, ${profId}, 'paid', '50000', 'COP', 'efectivo', 'test',
              ${`marca-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`})
      returning id`);
    ventaId = t.id;
    await db.execute(dsql`
      insert into transaction_items (transaction_id, nutraceutical_id, quantity, unit_price)
      values (${ventaId}, ${n.id}, 1, '50000')`);
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db.execute(dsql`set session_replication_role = replica`);
    await db.execute(dsql`delete from clinical_audit_log where entity_id = ${profId}`);
    await db.execute(dsql`delete from transaction_items where transaction_id = ${ventaId}::uuid`);
    await db.execute(dsql`delete from transactions where id = ${ventaId}::uuid`);
    await db.execute(dsql`delete from patient_professional_relationships where patient_id = ${pacienteId}::uuid`);
    await db.execute(dsql`delete from patients where id = ${pacienteId}::uuid`);
    await db.execute(dsql`set session_replication_role = default`);
    await db.execute(dsql`update professional_profiles set is_test = ${marcaOriginal} where id = ${profId}`);
  });

  it("marcar arrastra sus VENTAS y sus PACIENTES, sin tocarlos a mano", async () => {
    expect(await dato("transactions", "cuenta_como_de_prueba", ventaId)).toBe(false);
    expect(await dato("patients", "cuenta_como_de_prueba", pacienteId)).toBe(false);

    await escritor.marcarProfesionalDePrueba({
      professionalId: profId,
      esDePrueba: true,
      motivo: "Cuenta del smoke",
      actorId,
      actorEmail: null,
    });

    expect(await dato("professional_profiles", "is_test", profId)).toBe(true);
    expect(await dato("transactions", "cuenta_como_de_prueba", ventaId), "sus ventas siguen contando").toBe(true);
    expect(await dato("patients", "cuenta_como_de_prueba", pacienteId), "sus pacientes siguen contando").toBe(true);
  });

  it("y queda en el audit, porque sacar a alguien de las cifras lleva firma", async () => {
    const [f] = await db.execute(dsql`
      select count(*)::int as n from clinical_audit_log
       where event = 'profesional.marcado_de_prueba' and entity_id = ${profId}`);
    expect(Number(f.n)).toBe(1);
  });

  it("marcarlo dos veces avisa, en vez de decir que se hizo algo que no paso", async () => {
    await expect(
      escritor.marcarProfesionalDePrueba({
        professionalId: profId,
        esDePrueba: true,
        motivo: "Otra vez",
        actorId,
        actorEmail: null,
      }),
    ).rejects.toBeInstanceOf(escritor.MarcaDeProfesionalError);
  });

  it("marcar SIN motivo se rechaza: sacar de las cifras sin razon escrita es lo que hay que poder auditar", async () => {
    await expect(
      escritor.marcarProfesionalDePrueba({
        professionalId: profId,
        esDePrueba: true,
        motivo: null,
        actorId,
        actorEmail: null,
      }),
    ).rejects.toBeInstanceOf(escritor.MarcaDeProfesionalError);
  });

  it("y revertirlo devuelve las ventas y los pacientes a las cifras", async () => {
    await escritor.marcarProfesionalDePrueba({
      professionalId: profId,
      esDePrueba: false,
      motivo: null,
      actorId,
      actorEmail: null,
    });
    expect(await dato("professional_profiles", "is_test", profId)).toBe(false);
    expect(await dato("transactions", "cuenta_como_de_prueba", ventaId), "la venta no volvio").toBe(false);
    expect(await dato("patients", "cuenta_como_de_prueba", pacienteId), "el paciente no volvio").toBe(false);
  });
});
