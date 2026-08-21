import { eq, sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  adjustmentSignature,
  protocolSectionSignatures,
  type SectionSignatures,
} from "@/modules/treatment/data/protocol-signature";

// Candado de concurrencia de saveProtocol (BD real). Verifica ejecutando lo que pidio la revision:
//  - camino feliz: firma base == actual -> escribe;
//  - carrera: firma base != actual (alguien cambio el protocolo desde que se cargo) -> RECHAZA sin pisar,
//    con StaleProtocolError, y el dato queda INTACTO (saveProtocol reemplaza en bloque: sin candado, una
//    escritura ciega borraria la prescripcion entera).
// Se auto-salta sin DATABASE_URL.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el bloque se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("saveProtocol: candado de concurrencia (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let saveProtocol: any;
  let StaleProtocolError: any;
  let saveAdjustments: any;
  let StaleAdjustmentsError: any;
  let treatmentId: string;
  let diagnosisId: string;
  let evaluationId: string;
  let patientId: string;
  let nutraA: string;
  let nutraB: string;
  const actor = { actorId: "", actorEmail: "concurrency@test", ip: null };

  // Lee el estado actual del protocolo y devuelve su firma por seccion (lo que el cliente mandaria como base).
  async function currentSignatures(): Promise<SectionSignatures> {
    const [t] = await db
      .select({ kcal: schema.treatments.kcalObjetivo, prot: schema.treatments.proteinaGramos, restr: schema.treatments.restricciones })
      .from(schema.treatments)
      .where(eq(schema.treatments.id, treatmentId));
    const nutras = await db
      .select({ nutraceuticalId: schema.treatmentNutraceuticals.nutraceuticalId, dosage: schema.treatmentNutraceuticals.dosage, durationDays: schema.treatmentNutraceuticals.durationDays })
      .from(schema.treatmentNutraceuticals)
      .where(eq(schema.treatmentNutraceuticals.treatmentId, treatmentId));
    const guides = await db
      .select({ text: schema.treatmentDietGuidelines.guidelineText })
      .from(schema.treatmentDietGuidelines)
      .where(eq(schema.treatmentDietGuidelines.treatmentId, treatmentId));
    return protocolSectionSignatures({ treatmentId, kcalObjetivo: t.kcal, proteinaGramos: t.prot, restricciones: t.restr ?? [], nutraceuticals: nutras, guidelines: guides });
  }

  async function nutraCount(): Promise<number> {
    const rows = await db.select({ id: schema.treatmentNutraceuticals.id }).from(schema.treatmentNutraceuticals).where(eq(schema.treatmentNutraceuticals.treatmentId, treatmentId));
    return rows.length;
  }

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    ({ saveProtocol, StaleProtocolError, saveAdjustments, StaleAdjustmentsError } = await import(
      "@/modules/treatment/data/treatment-writer"
    ));

    const [org] = await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1);
    const [prof] = await db.select({ id: schema.professionalProfiles.id, profileId: schema.professionalProfiles.profileId }).from(schema.professionalProfiles).limit(1);
    const [mv] = await db.select({ id: schema.modelVersions.id }).from(schema.modelVersions).limit(1);
    const nutras = await db.select({ id: schema.nutraceuticals.id }).from(schema.nutraceuticals).limit(2);
    nutraA = nutras[0].id;
    nutraB = nutras[1].id;
    actor.actorId = prof.profileId;

    patientId = (await db.insert(schema.patients).values({ organizationId: org.id, documentType: "CC", documentNumber: `CONC-${Date.now()}` }).returning({ id: schema.patients.id }))[0].id;
    evaluationId = (await db.insert(schema.evaluations).values({ patientId, professionalId: prof.id, organizationId: org.id, type: "inicial", status: "in_progress" }).returning({ id: schema.evaluations.id }))[0].id;
    diagnosisId = (
      await db
        .insert(schema.diagnoses)
        .values({ evaluationId, efrStateNumber: 1, diagnosisName: "Test concurrencia", engineVersion: "test", modelVersionId: mv.id, rulesVersion: "test", confirmedBy: prof.profileId, confirmedAt: new Date() })
        .returning({ id: schema.diagnoses.id })
    )[0].id;
    treatmentId = (
      await db
        .insert(schema.treatments)
        .values({ diagnosisId, createdBy: prof.profileId, kcalObjetivo: 2000, proteinaGramos: 110, restricciones: ["sin gluten"] })
        .returning({ id: schema.treatments.id })
    )[0].id;
    await db.insert(schema.treatmentNutraceuticals).values({ treatmentId, nutraceuticalId: nutraA, dosage: "1/dia", durationDays: 30 });
    await db.insert(schema.treatmentDietGuidelines).values({ treatmentId, guidelineText: "5 comidas al dia" });
  });

  afterAll(async () => {
    if (!treatmentId) return;
    await db.execute(dsql`set session_replication_role = replica`);
    await db.execute(dsql`delete from clinical_audit_log where entity_id = ${treatmentId}`);
    await db.delete(schema.treatmentNutraceuticals).where(eq(schema.treatmentNutraceuticals.treatmentId, treatmentId));
    await db.delete(schema.treatmentDietGuidelines).where(eq(schema.treatmentDietGuidelines.treatmentId, treatmentId));
    await db.delete(schema.treatmentNotes).where(eq(schema.treatmentNotes.treatmentId, treatmentId));
    await db.delete(schema.treatments).where(eq(schema.treatments.id, treatmentId));
    await db.delete(schema.diagnoses).where(eq(schema.diagnoses.id, diagnosisId));
    await db.delete(schema.evaluations).where(eq(schema.evaluations.id, evaluationId));
    await db.delete(schema.patientProfiles).where(eq(schema.patientProfiles.patientId, patientId));
    await db.delete(schema.patients).where(eq(schema.patients.id, patientId));
    await db.execute(dsql`set session_replication_role = default`);
  });

  it("camino feliz: la firma base coincide con la actual -> escribe", async () => {
    const base = await currentSignatures();
    await saveProtocol({
      treatmentId,
      kcalObjetivo: 1900, // cambio real
      proteinaGramos: 110,
      restricciones: ["sin gluten"],
      nutraceuticals: [{ nutraceuticalId: nutraA, dosage: "1/dia", durationDays: 30 }],
      guidelines: ["5 comidas al dia"],
      baseSignatures: base,
      ...actor,
    });
    const [t] = await db.select({ kcal: schema.treatments.kcalObjetivo }).from(schema.treatments).where(eq(schema.treatments.id, treatmentId));
    expect(t.kcal).toBe(1900);
  });

  it("carrera: la firma base NO coincide (otro cambio la prescripcion) -> rechaza sin pisar", async () => {
    // Base con una seccion tampereada = simula que el protocolo cambio desde que el cliente lo cargo.
    const stale: SectionSignatures = { ...(await currentSignatures()), nutraceuticals: "STALE-DE-OTRA-SESION" };
    const nutraAntes = await nutraCount();

    await expect(
      saveProtocol({
        treatmentId,
        kcalObjetivo: 999, // lo que se PERDERIA si pisara
        proteinaGramos: 110,
        restricciones: ["sin gluten"],
        nutraceuticals: [], // un guardado ciego aqui BORRARIA la prescripcion entera
        guidelines: ["5 comidas al dia"],
        baseSignatures: stale,
        ...actor,
      }),
    ).rejects.toBeInstanceOf(StaleProtocolError);

    // El dato quedo INTACTO: ni el kcal se piso ni la prescripcion se borro.
    const [t] = await db.select({ kcal: schema.treatments.kcalObjetivo }).from(schema.treatments).where(eq(schema.treatments.id, treatmentId));
    expect(t.kcal).toBe(1900); // el del camino feliz, no 999
    expect(await nutraCount()).toBe(nutraAntes); // no se borro la prescripcion
  });

  it("la seccion reportada en el rechazo es la que cambio", async () => {
    const stale: SectionSignatures = { ...(await currentSignatures()), nutraceuticals: "STALE" };
    try {
      await saveProtocol({
        treatmentId,
        kcalObjetivo: 1900,
        proteinaGramos: 110,
        restricciones: ["sin gluten"],
        nutraceuticals: [{ nutraceuticalId: nutraB, dosage: null, durationDays: null }],
        guidelines: ["5 comidas al dia"],
        baseSignatures: stale,
        ...actor,
      });
      throw new Error("deberia haber lanzado StaleProtocolError");
    } catch (e: any) {
      expect(e).toBeInstanceOf(StaleProtocolError);
      expect(e.sections).toEqual(["nutraceuticals"]);
    }
  });

  // Tratamiento sub-tarea 2: candado de saveAdjustments (BD real). saveAdjustments ESCRIBE LAS SEIS columnas
  // adj_* de golpe; sin candado, dos guardados se pisan (el peso meta que otro profesional fijo se pierde).
  // Firma de los seis ajustes GUARDADOS = lo que el cliente cargo; el servidor la recomputa bajo lock.
  async function currentAdjSignature(): Promise<string> {
    const [t] = await db
      .select({
        geb: schema.treatments.adjGeb,
        pal: schema.treatments.adjPal,
        kcalObj: schema.treatments.adjKcalObj,
        protGkg: schema.treatments.adjProtGkg,
        fatPct: schema.treatments.adjFatPct,
        pesoMeta: schema.treatments.adjPesoMeta,
      })
      .from(schema.treatments)
      .where(eq(schema.treatments.id, treatmentId));
    return adjustmentSignature({
      treatmentId,
      adjGeb: t.geb != null ? Number(t.geb) : null,
      adjPal: t.pal != null ? Number(t.pal) : null,
      adjKcalObj: t.kcalObj != null ? Number(t.kcalObj) : null,
      adjProtGkg: t.protGkg != null ? Number(t.protGkg) : null,
      adjFatPct: t.fatPct != null ? Number(t.fatPct) : null,
      adjPesoMeta: t.pesoMeta != null ? Number(t.pesoMeta) : null,
    });
  }

  it("adjustments camino feliz: firma base == actual -> escribe los seis", async () => {
    const base = await currentAdjSignature();
    await saveAdjustments({
      treatmentId,
      adjGeb: 1950,
      adjPal: null,
      adjKcalObj: null,
      adjProtGkg: null,
      adjFatPct: null,
      adjPesoMeta: 72.5,
      baseSignature: base,
      ...actor,
    });
    const [t] = await db
      .select({ geb: schema.treatments.adjGeb, pesoMeta: schema.treatments.adjPesoMeta })
      .from(schema.treatments)
      .where(eq(schema.treatments.id, treatmentId));
    expect(Number(t.geb)).toBe(1950);
    expect(Number(t.pesoMeta)).toBe(72.5);
  });

  it("adjustments carrera: firma base != actual -> rechaza sin pisar (StaleAdjustmentsError)", async () => {
    // Simula que otro profesional cambio la cadena desde que el cliente la cargo: la firma que trae ya no
    // coincide con la de BD. Sin candado, este guardado pisaria el adjGeb=1950 y borraria el peso meta.
    await expect(
      saveAdjustments({
        treatmentId,
        adjGeb: 3000, // lo que se ESCRIBIRIA si pisara
        adjPal: null,
        adjKcalObj: null,
        adjProtGkg: null,
        adjFatPct: null,
        adjPesoMeta: null, // un guardado ciego aqui BORRARIA el peso meta fijado
        baseSignature: "STALE-DE-OTRA-SESION",
        ...actor,
      }),
    ).rejects.toBeInstanceOf(StaleAdjustmentsError);

    // El dato quedo INTACTO: ni el GEB se piso ni el peso meta se borro.
    const [t] = await db
      .select({ geb: schema.treatments.adjGeb, pesoMeta: schema.treatments.adjPesoMeta })
      .from(schema.treatments)
      .where(eq(schema.treatments.id, treatmentId));
    expect(Number(t.geb)).toBe(1950); // el del camino feliz, no 3000
    expect(Number(t.pesoMeta)).toBe(72.5); // no se borro
  });
});
