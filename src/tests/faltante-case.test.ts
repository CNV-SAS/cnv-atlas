import { eq, sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Caso de faltante (T3b-3 ST1). Verifica, contra la BD real, las garantias de los triggers 0043:
//  - proyeccion: el estado del caso lo pone la ultima transicion (cache);
//  - maquina de estados: una transicion arranca donde esta el caso (from_status = estado actual);
//  - append-only: una transicion no se edita ni se borra;
//  - hechos sellados inmutables (cantidad, precio, fechas);
//  - el cargo se materializa SOLO al confirmar injustificado (dos pasos: admin propone, direccion confirma).
// Se auto-salta sin DATABASE_URL.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("caso de faltante: estado, transiciones e inmutabilidad (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let caseId: string;
  let profId: string;
  let nutraId: string;
  let actorId: string;

  async function addTransition(from: string | null, to: string, extra: Record<string, unknown> = {}) {
    await db.insert(schema.nutraceuticalFaltanteTransitions).values({
      caseId,
      fromStatus: from as any,
      toStatus: to as any,
      actorId,
      ...extra,
    });
  }
  async function caseStatus(): Promise<{ status: string; charge: string; cat: string | null; ref: string | null }> {
    const [c] = await db
      .select({
        status: schema.nutraceuticalFaltanteCases.status,
        charge: schema.nutraceuticalFaltanteCases.chargeStatus,
        cat: schema.nutraceuticalFaltanteCases.justificationCategory,
        ref: schema.nutraceuticalFaltanteCases.justificationReference,
      })
      .from(schema.nutraceuticalFaltanteCases)
      .where(eq(schema.nutraceuticalFaltanteCases.id, caseId));
    return c;
  }

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    const [prof] = await db.select({ id: schema.professionalProfiles.id, pid: schema.professionalProfiles.profileId }).from(schema.professionalProfiles).limit(1);
    const [nut] = await db.select({ id: schema.nutraceuticals.id }).from(schema.nutraceuticals).limit(1);
    profId = prof.id;
    actorId = prof.pid;
    nutraId = nut.id;
    caseId = (
      await db
        .insert(schema.nutraceuticalFaltanteCases)
        .values({
          professionalId: profId,
          nutraceuticalId: nutraId,
          quantity: 3,
          sealedUnitPrice: "50000",
          sealedTotal: "150000",
          reportedAt: new Date("2026-08-07T12:00:00Z"),
          deadlineAt: new Date("2026-08-14T12:00:00Z"),
          createdBy: actorId,
        })
        .returning({ id: schema.nutraceuticalFaltanteCases.id })
    )[0].id;
  });

  afterAll(async () => {
    if (!caseId) return;
    await db.execute(dsql`set session_replication_role = replica`); // saltar el append-only para limpiar
    await db.delete(schema.nutraceuticalFaltanteTransitions).where(eq(schema.nutraceuticalFaltanteTransitions.caseId, caseId));
    await db.delete(schema.nutraceuticalFaltanteCases).where(eq(schema.nutraceuticalFaltanteCases.id, caseId));
    await db.execute(dsql`set session_replication_role = default`);
  });

  it("arranca en reportado, sin cargo", async () => {
    const c = await caseStatus();
    expect(c.status).toBe("reportado");
    expect(c.charge).toBe("sin_cargo");
  });

  it("la apertura debe llevar from_status NULL; un from_status no-nulo se rechaza", async () => {
    await expect(addTransition("reportado", "en_revision")).rejects.toThrow(); // primera con from_status no-nulo
    await addTransition(null, "reportado"); // apertura valida
  });

  it("justificar proyecta en_revision + cachea categoria y referencia", async () => {
    await addTransition("reportado", "en_revision", {
      justificationCategory: "hurto_denuncia",
      justificationReference: "Denuncia 2026-12345",
    });
    const c = await caseStatus();
    expect(c.status).toBe("en_revision");
    expect(c.cat).toBe("hurto_denuncia");
    expect(c.ref).toBe("Denuncia 2026-12345");
    expect(c.charge).toBe("sin_cargo");
  });

  it("una transicion que no arranca donde esta el caso se rechaza (maquina de estados)", async () => {
    // el caso esta en en_revision; intentar arrancar desde reportado se rechaza
    await expect(addTransition("reportado", "injustificado_pendiente")).rejects.toThrow();
  });

  it("el cargo se materializa SOLO al confirmar injustificado (admin propone, direccion confirma)", async () => {
    await addTransition("en_revision", "injustificado_pendiente", { reason: "Justificacion no soporta la perdida" });
    let c = await caseStatus();
    expect(c.status).toBe("injustificado_pendiente");
    expect(c.charge).toBe("sin_cargo"); // aun NO se materializa

    await addTransition("injustificado_pendiente", "injustificado", { reason: "Confirmado por direccion" });
    c = await caseStatus();
    expect(c.status).toBe("injustificado");
    expect(c.charge).toBe("pendiente_liquidacion"); // recien aqui
  });

  it("una transicion es inmutable: no se edita ni se borra", async () => {
    const [t] = await db.select({ id: schema.nutraceuticalFaltanteTransitions.id }).from(schema.nutraceuticalFaltanteTransitions).where(eq(schema.nutraceuticalFaltanteTransitions.caseId, caseId)).limit(1);
    await expect(db.execute(dsql`update nutraceutical_faltante_transitions set reason = 'x' where id = ${t.id}`)).rejects.toThrow();
    await expect(db.execute(dsql`delete from nutraceutical_faltante_transitions where id = ${t.id}`)).rejects.toThrow();
  });

  it("los hechos sellados del caso son inmutables (cantidad, precio)", async () => {
    await expect(db.execute(dsql`update nutraceutical_faltante_cases set quantity = 99 where id = ${caseId}`)).rejects.toThrow();
    await expect(db.execute(dsql`update nutraceutical_faltante_cases set sealed_total = '1' where id = ${caseId}`)).rejects.toThrow();
  });

  it("el status no se puede escribir directo con un valor que no sea el de la ultima transicion", async () => {
    await expect(db.execute(dsql`update nutraceutical_faltante_cases set status = 'reportado' where id = ${caseId}`)).rejects.toThrow();
  });
});
