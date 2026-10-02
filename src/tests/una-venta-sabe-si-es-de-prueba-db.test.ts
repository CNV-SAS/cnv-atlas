import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ CANDADO DE LA COLUMNA QUE RESPONDE "¿ESTA VENTA CUENTA?" (0203) ═══
//
// POR QUE EXISTE ESTA COLUMNA, y es la historia de dos semanas: SEIS veces el mismo defecto, dos pantallas de
// la misma cifra con el filtro en una y no en la otra. La sexta enseño lo que faltaba entender: los dos
// lectores aplicaban EL MISMO FILTRO y daban distinto, porque el INSUMO del filtro era distinto (uno pedia
// los pacientes marcados bajo la RLS del profesional y no los veia todos).
//
// Asi que la respuesta no era otro filtro bien escrito: era que la pregunta tuviera UNA respuesta guardada.
//
// Y POR ESO EL CANDADO VA CONTRA LA BASE: la regla ya no esta en TypeScript, esta en un trigger. Lo que hay
// que comprobar es que RECALCULE en los cuatro momentos en que la respuesta cambia.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("una venta sabe si es de prueba (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let orgId: string;
  let profId: string;
  let pacienteReal: string;
  let pacienteDePrueba: string;
  let productoReal: string;
  const ventas: string[] = [];
  const pacientes: string[] = [];
  let marcaOriginalDelProfesional = false;

  const marca = async (txId: string): Promise<boolean> => {
    const [f] = await db.execute(dsql`select cuenta_como_de_prueba from transactions where id = ${txId}`);
    return Boolean(f?.cuenta_como_de_prueba);
  };

  const venta = async (patientId: string, nutraceuticalId: string | null): Promise<string> => {
    const [t] = await db.execute(dsql`
      insert into transactions (organization_id, patient_id, professional_id, status, amount, currency,
                                payment_method, wompi_env, idempotency_key)
      values (${orgId}, ${patientId}, ${profId}, 'paid', '50000', 'COP', 'efectivo', 'test',
              ${`cuenta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`})
      returning id`);
    ventas.push(t.id);
    if (nutraceuticalId) {
      await db.execute(dsql`
        insert into transaction_items (transaction_id, nutraceutical_id, quantity, unit_price)
        values (${t.id}, ${nutraceuticalId}, 1, '50000')`);
    }
    return t.id;
  };

  const nuevoPaciente = async (dePrueba: boolean): Promise<string> => {
    const [p] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number, is_test)
      values (${orgId}, 'CC', ${`CNT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`}, ${dePrueba})
      returning id`);
    pacientes.push(p.id);
    return p.id;
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    const [prof] = await db.execute(dsql`
      select pp.id, coalesce(pp.is_test, false) as is_test, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by pp.created_at limit 1`);
    profId = prof.id;
    orgId = prof.organization_id;
    marcaOriginalDelProfesional = prof.is_test;
    // SE PARTE DE UN PROFESIONAL NO MARCADO, para que la marca de la venta venga del paciente o del producto
    // y no de el. Se devuelve al final.
    await db.execute(dsql`update professional_profiles set is_test = false where id = ${profId}`);
    pacienteReal = await nuevoPaciente(false);
    pacienteDePrueba = await nuevoPaciente(true);
    const [n] = await db.execute(dsql`
      select id from nutraceuticals where coalesce(is_test, false) = false order by name limit 1`);
    productoReal = n.id;
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of ventas) {
      await db.execute(dsql`delete from transaction_items where transaction_id = ${id}`);
      await db.execute(dsql`delete from transactions where id = ${id}`);
    }
    for (const id of pacientes) await db.execute(dsql`delete from patients where id = ${id}`);
    await db.execute(dsql`set session_replication_role = default`);
    await db.execute(
      dsql`update professional_profiles set is_test = ${marcaOriginalDelProfesional} where id = ${profId}`,
    );
  });

  it("una venta real a un paciente real con producto real CUENTA", async () => {
    expect(await marca(await venta(pacienteReal, productoReal))).toBe(false);
  });

  it("el PACIENTE de prueba la marca, sin que nadie toque la venta", async () => {
    expect(await marca(await venta(pacienteDePrueba, productoReal))).toBe(true);
  });

  it("y marcar al paciente DESPUES arrastra las ventas que ya existian", async () => {
    const t = await venta(pacienteReal, productoReal);
    expect(await marca(t)).toBe(false);
    await db.execute(dsql`update patients set is_test = true where id = ${pacienteReal}`);
    expect(await marca(t), "marcar al paciente no recalculo su venta").toBe(true);
    // Y AL DESMARCARLO VUELVE: la derivacion tiene que ser reversible en los dos sentidos.
    await db.execute(dsql`update patients set is_test = false where id = ${pacienteReal}`);
    expect(await marca(t)).toBe(false);
  });

  it("el PRODUCTO de prueba la marca al agregarse la linea", async () => {
    const [prueba] = await db.execute(dsql`
      select id from nutraceuticals where coalesce(is_test, false) = true limit 1`);
    if (!prueba) return; // sin producto de prueba en la base no hay nada que comprobar
    const t = await venta(pacienteReal, null);
    expect(await marca(t), "una venta sin lineas no deberia estar marcada").toBe(false);
    await db.execute(dsql`
      insert into transaction_items (transaction_id, nutraceutical_id, quantity, unit_price)
      values (${t}, ${prueba.id}, 1, '11900')`);
    expect(await marca(t), "agregar una linea de producto de prueba no recalculo la venta").toBe(true);
  });

  // ═══ Y LA BANDEJA DE REVISAR TIENE SU PROPIO MATIZ, que NO es esta columna ═══
  //
  // Las otras bandejas ocultan por la columna. Esta no puede: si el producto era REAL, el descuento de
  // inventario tambien fue real y la vitrina esta descuadrada DE VERDAD, aunque el paciente o el profesional
  // sean de prueba. Esconderlo esconderia un problema FISICO, que es el unico de esta familia que cuesta
  // unidades y no una cifra.
  it("la bandeja de revisar oculta por el PRODUCTO, no por la columna", async () => {
    const { listarVentasPorRevisar } = await import("@/modules/payments/data/ventas-por-revisar");
    // Una venta a un paciente de PRUEBA con producto REAL: la columna la marca, y la bandeja la deja ver,
    // porque su descuento de inventario si fue real.
    const t = await venta(pacienteDePrueba, productoReal);
    // SOLO EL ESTADO: poner `registered_retroactively_at` sin su responsable y su factura lo rechaza el
    // CHECK `tx_retroactiva_completa` (las tres van juntas). La venta es de hoy, asi que ya entra en la
    // ventana de 30 dias de la bandeja.
    await db.execute(dsql`update transactions set stock_state = 'sin_saldo' where id = ${t}`);
    expect(await marca(t), "la columna deberia marcarla por el paciente").toBe(true);
    const visibles = await listarVentasPorRevisar();
    expect(
      visibles.some((v: { id: string }) => v.id === t),
      "la bandeja escondio un descuadre de inventario REAL por ser de un paciente de prueba",
    ).toBe(true);
  });

  it("y el PROFESIONAL de prueba marca las suyas, que es la que manda sobre las otras dos", async () => {
    const t = await venta(pacienteReal, productoReal);
    expect(await marca(t)).toBe(false);
    await db.execute(dsql`update professional_profiles set is_test = true where id = ${profId}`);
    expect(await marca(t), "marcar al profesional no recalculo sus ventas").toBe(true);
    await db.execute(dsql`update professional_profiles set is_test = false where id = ${profId}`);
    expect(await marca(t)).toBe(false);
  });
});
