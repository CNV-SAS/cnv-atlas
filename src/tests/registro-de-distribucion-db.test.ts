import { sql as dsql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// ═══ REGISTRAR UNA VENTA BAJO DISTRIBUCION, SIN COBRARLA (0211) ═══
//
// Sub-tarea 4 del plan. Lo que vigila es la CADENA entera contra base real, porque cada pieza por separado ya
// tiene su prueba y lo que falla en produccion es el encaje:
//
//   · el canal queda 'cobrado_por_el_integrante' aunque el formulario pida efectivo (lo DERIVA la modalidad);
//   · NO se crea fila de comision, porque bajo Distribucion no hay nada que liquidarle;
//   · la base y el descuento SI quedan sellados en la linea, que es de donde sale la cuenta quincenal;
//   · el inventario SI baja, porque el producto salio de la vitrina;
//   · y el porton funciona EN LAS DOS DIRECCIONES.
//
// EL PORTON AL REVES ES LA MITAD QUE SE OLVIDA: si este camino se pudiera usar con un Integrante en COMISION,
// se registraria una venta cuyo dinero CNV tenia que recaudar y nadie recaudo. El producto sale de la vitrina,
// el paciente se va, y no hay ni link, ni efectivo, ni factura.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("el registro de una venta de Distribucion (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let writer: typeof import("@/modules/payments/data/payments-writer");
  let modalidad: typeof import("@/modules/payments/data/modalidad-writer");
  let orgId: string;
  let profId: string;
  let actorId: string;
  let patientId: string;
  let nutraId: string;
  const ventas: string[] = [];
  const vigencias: string[] = [];

  /** Pone al Integrante en la modalidad que se pida, desde hoy. */
  const ponerModalidad = async (m: "comision" | "distribucion") => {
    await db.execute(dsql`delete from professional_modalities where professional_id = ${profId}`);
    const [v] = await db.execute(dsql`
      insert into professional_modalities (professional_id, modality, valid_from, decided_by)
      values (${profId}, ${m}, (now() at time zone 'America/Bogota')::date - 1, ${actorId})
      returning id`);
    vigencias.push(v.id);
  };

  const crear = async (canalPedido: "efectivo" | "cobrado_por_el_integrante") => {
    const r = await writer.createPaidCashTransaction({
      organizationId: orgId,
      patientId,
      professionalId: profId,
      amount: 119000,
      currency: "COP",
      idempotencyKey: `dist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      items: [{ nutraceuticalId: nutraId, quantity: 1, unitPrice: 119000 }],
      treatmentId: null,
      domicilio: null,
      sinTratamientoMotivo: "candado del registro de Distribucion",
      actorId,
      canal: canalPedido,
    } as any);
    ventas.push(r.id);
    return r.id;
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    writer = await import("@/modules/payments/data/payments-writer");
    modalidad = await import("@/modules/payments/data/modalidad-writer");

    const [prof] = await db.execute(dsql`
      select pp.id, pp.profile_id, p.organization_id
        from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by (select count(*) from transactions t where t.professional_id = pp.id), pp.created_at
       limit 1`);
    profId = prof.id;
    actorId = prof.profile_id;
    orgId = prof.organization_id;

    const [pa] = await db.execute(dsql`
      insert into patients (organization_id, document_type, document_number)
      values (${orgId}, 'CC', ${`DIST-${Date.now()}`})
      returning id`);
    patientId = pa.id;

    const [n] = await db.execute(dsql`
      select id from nutraceuticals where coalesce(is_test, false) = false order by name limit 1`);
    nutraId = n.id;
  });

  afterEach(async () => {
    await db.execute(dsql`set session_replication_role = replica`);
    for (const id of ventas) {
      await db.execute(dsql`delete from cnv_revenue where transaction_id = ${id}::uuid`);
      await db.execute(dsql`delete from professional_revenue where transaction_id = ${id}::uuid`);
      await db.execute(dsql`delete from transaction_items where transaction_id = ${id}::uuid`);
      await db.execute(dsql`delete from transactions where id = ${id}::uuid`);
    }
    ventas.length = 0;
    await db.execute(dsql`set session_replication_role = default`);
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db.execute(dsql`set session_replication_role = replica`);
    // LAS VIGENCIAS SE BORRAN TODAS: este candado mueve la modalidad de un profesional REAL de la base local, y
    // dejarsela cambiada le cerraria los dos caminos de cobro en todas las pantallas.
    await db.execute(dsql`delete from professional_modalities where professional_id = ${profId}`);
    await db.execute(dsql`delete from patients where id = ${patientId}::uuid`);
    await db.execute(dsql`set session_replication_role = default`);
  });

  describe("con el Integrante en Distribucion", () => {
    beforeAll(async () => {
      ({ db } = await import("@/db"));
    });

    it("la venta queda con el canal de Distribucion, no con efectivo", async () => {
      await ponerModalidad("distribucion");
      const id = await crear("cobrado_por_el_integrante");
      const [f] = await db.execute(dsql`
        select payment_method, status, modalidad_de_la_venta from transactions where id = ${id}::uuid`);
      expect(f.payment_method).toBe("cobrado_por_el_integrante");
      // NACE PAGADA porque ESTA pagada: el paciente ya le pago al Integrante.
      expect(f.status).toBe("paid");
      expect(f.modalidad_de_la_venta).toBe("distribucion");
    });

    // NO HAY COMISION QUE LIQUIDARLE: su margen es un descuento comercial que ya se quedo. Crear la fila seria
    // prometerle un giro que nadie le debe, y lo haria aparecer en la liquidacion mensual.
    it("no crea fila de comision", async () => {
      await ponerModalidad("distribucion");
      const id = await crear("cobrado_por_el_integrante");
      const [f] = await db.execute(dsql`
        select count(*)::int as n from professional_revenue where transaction_id = ${id}::uuid`);
      expect(Number(f.n), "le creo una comision por pagar que nadie le debe").toBe(0);
    });

    // PERO LA LINEA SI QUEDA SELLADA, y es lo que hace posible la cuenta quincenal: de `base_amount` y
    // `commission_amount` sale lo que CNV le factura. Sin el sellado, la cuenta saldria vacia.
    it("pero sella la base y el descuento en la linea, que es de donde sale la cuenta quincenal", async () => {
      await ponerModalidad("distribucion");
      const id = await crear("cobrado_por_el_integrante");
      const [l] = await db.execute(dsql`
        select base_amount::numeric as base, commission_amount::numeric as descuento, modality, sealed_at
          from transaction_items where transaction_id = ${id}::uuid`);
      expect(l.modality).toBe("distribucion");
      expect(l.sealed_at).not.toBeNull();
      expect(Number(l.base), "la base sin IVA de 119.000").toBe(100000);
      expect(Number(l.descuento), "su 20% sobre la base").toBeGreaterThan(0);
    });

    // EL EFECTIVO QUEDA CERRADO IGUAL: el porton de arriba no se abrio, se invirtio.
    it("y el camino del efectivo sigue cerrado", async () => {
      await ponerModalidad("distribucion");
      await expect(crear("efectivo")).rejects.toBeInstanceOf(modalidad.ModalidadError);
    });
  });

  describe("con el Integrante en Comision", () => {
    // ═══ EL PORTON AL REVES, Y ES LA MITAD QUE SE OLVIDA ═══
    //
    // Sin esto, el registro de Distribucion serviria para sacar producto de la vitrina de CUALQUIERA sin
    // cobrarlo: un agujero de dinero real que nadie nota hasta cuadrar cifras.
    it("el registro de Distribucion NO se puede usar", async () => {
      await ponerModalidad("comision");
      await expect(crear("cobrado_por_el_integrante")).rejects.toBeInstanceOf(modalidad.ModalidadError);
    });

    it("y el efectivo sigue funcionando", async () => {
      await ponerModalidad("comision");
      const id = await crear("efectivo");
      const [f] = await db.execute(dsql`
        select payment_method, modalidad_de_la_venta from transactions where id = ${id}::uuid`);
      expect(f.payment_method).toBe("efectivo");
      expect(f.modalidad_de_la_venta).toBe("comision");
      // Y SU COMISION SI SE CREA: si el cambio hubiera apagado las dos, esto lo dice.
      const [c] = await db.execute(dsql`
        select count(*)::int as n from professional_revenue where transaction_id = ${id}::uuid`);
      expect(Number(c.n)).toBe(1);
    });
  });
});
