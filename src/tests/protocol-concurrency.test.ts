import { eq, sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  adjustmentSignature,
  intercambioSignature,
  tiemposSignature,
  tiemposActivosSignature,
  menuSemanalSignature,
  nutraceuticalsSignature,
  objetivoSignature,
  restriccionesSignature,
} from "@/modules/treatment/data/protocol-signature";
import type { IntercambioSaved, TiemposSaved } from "@/modules/treatment/data/treatment-view-types";

// Candado de concurrencia del tratamiento, contra BD real.
//
// ESTE ARCHIVO SE PODO EL 2026-09-09, y lo que queda es deliberado. Tenia diez casos de "camino feliz /
// carrera", uno por seccion, porque cada seccion tenia su propia accion, su propio writer y su propio
// Stale*Error. Al unificar los siete guardados del panel en uno (peticion de Santiago), esa matriz la
// cubre `guardar-protocolo-transaccional.test.ts`, y ademas MEJOR: alli se comprueba que un rechazo no
// deja NINGUNA seccion escrita, que es la propiedad nueva y la que de verdad importa.
//
// LO QUE SE QUEDA AQUI son las dos garantias que NO son la matriz, y que se habrian perdido al podar:
//   · La PROCEDENCIA del peso meta, que no se reescribe cuando un guardado no lo toco.
//   · Una fila guardada con la FORMA VIEJA del intercambio, que el writer sobrescribe sin reventar. Es el
//     camino real de un 500 del 2026-08-22.
// Mas los nutraceuticos, que conservan su guardado propio (escriben una tabla HIJA, no columnas).
//
// Se auto-salta sin DATABASE_URL.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el bloque se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("candado de concurrencia de las secciones del tratamiento (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let guardarProtocolo: any;
  let saveNutraceuticals: any;
  let StaleNutraceuticalsError: any;
  let treatmentId: string;
  let diagnosisId: string;
  let evaluationId: string;
  let patientId: string;
  let nutraA: string;
  let nutraB: string;
  const actor = { actorId: "", actorEmail: "concurrency@test", ip: null };

  // Firma actual de la PRESCRIPCION de nutraceuticos (base del candado de saveNutraceuticals).
  async function currentNutraSignature(): Promise<string> {
    const nutras = await db
      .select({ nutraceuticalId: schema.treatmentNutraceuticals.nutraceuticalId, dosage: schema.treatmentNutraceuticals.dosage, durationDays: schema.treatmentNutraceuticals.durationDays })
      .from(schema.treatmentNutraceuticals)
      .where(eq(schema.treatmentNutraceuticals.treatmentId, treatmentId));
    return nutraceuticalsSignature({ treatmentId, nutraceuticals: nutras });
  }

  async function nutraCount(): Promise<number> {
    const rows = await db.select({ id: schema.treatmentNutraceuticals.id }).from(schema.treatmentNutraceuticals).where(eq(schema.treatmentNutraceuticals.treatmentId, treatmentId));
    return rows.length;
  }

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    ({ saveNutraceuticals, StaleNutraceuticalsError } = await import(
      "@/modules/treatment/data/treatment-writer"
    ));
    ({ guardarProtocolo } = await import("@/modules/treatment/data/protocolo-writer"));

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
    // SIN FILA DE INTAKE, A PROPOSITO. El peso meta vive en `evaluations` desde la 0096 justamente porque
    // esta fila es OPCIONAL: al medirlo, 41 de 60 tratamientos tenian su evaluacion sin ella, y la version
    // anterior dejaba el panel bloqueado. Esta fixture reproduce ese estado, asi que si el peso meta
    // volviera a colgar de las condiciones de la toma, estos tests se ponen rojos aqui y no en produccion.
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


  /** El peso meta GUARDADO, de su sitio unico: la EVALUACION (migracion 0096). */
  async function pesoMetaGuardado(): Promise<number | null> {
    const [e] = await db
      .select({ peso: schema.evaluations.weightGoalKg })
      .from(schema.evaluations)
      .where(eq(schema.evaluations.id, evaluationId));
    return e?.peso != null ? Number(e.peso) : null;
  }

  /** La PROCEDENCIA guardada: se conserva al unificar porque es informacion clinica. */
  async function origenPesoMeta(): Promise<string | null> {
    const [e] = await db
      .select({ origen: schema.evaluations.weightGoalSetIn })
      .from(schema.evaluations)
      .where(eq(schema.evaluations.id, evaluationId));
    return e?.origen ?? null;
  }

  /**
   * LAS SIETE FIRMAS VIGENTES, que es lo que el guardado unico exige.
   *
   * Se recomponen EXACTAMENTE como las recompone el servidor bajo lock, o el candado rechazaria guardados
   * legitimos. Es la mitad que se rompe en silencio si alguien mueve una columna y se olvida de este lado.
   */
  async function firmasVigentes(): Promise<Record<string, string>> {
    const [t] = await db
      .select({
        geb: schema.treatments.adjGeb,
        pal: schema.treatments.adjPal,
        kcalObj: schema.treatments.adjKcalObj,
        protGkg: schema.treatments.adjProtGkg,
        fatPct: schema.treatments.adjFatPct,
        deficit: schema.treatments.adjDeficit,
        objetivo: schema.treatments.objetivoTexto,
        restricciones: schema.treatments.restricciones,
        intercambio: schema.treatments.intercambioPorciones,
        activos: schema.treatments.tiemposActivos,
        tiempos: schema.treatments.tiempos,
        menu: schema.treatments.menuSemanal,
      })
      .from(schema.treatments)
      .where(eq(schema.treatments.id, treatmentId));
    const n = (v: unknown) => (v == null ? null : Number(v));
    return {
      ajustes: adjustmentSignature({
        treatmentId,
        adjGeb: n(t.geb),
        adjPal: n(t.pal),
        adjKcalObj: n(t.kcalObj),
        adjProtGkg: n(t.protGkg),
        adjFatPct: n(t.fatPct),
        adjDeficit: n(t.deficit),
        pesoMetaFijado: await pesoMetaGuardado(),
      }),
      objetivo: objetivoSignature({ treatmentId, objetivo: t.objetivo }),
      restricciones: restriccionesSignature({ treatmentId, restricciones: t.restricciones ?? [] }),
      intercambio: intercambioSignature({
        treatmentId,
        intercambio: (t.intercambio as IntercambioSaved | null) ?? null,
      }),
      tiemposActivos: tiemposActivosSignature({
        treatmentId,
        activos: (t.activos as Record<string, boolean> | null) ?? null,
      }),
      tiempos: tiemposSignature({ treatmentId, tiempos: (t.tiempos as TiemposSaved | null) ?? null }),
      menuSemanal: menuSemanalSignature({ treatmentId, menu: (t.menu as never) ?? null }),
    };
  }

  /** Lo editable, tal como esta guardado, para mandar solo lo que un caso quiere cambiar. */
  async function editableVigente() {
    const [t] = await db
      .select({
        geb: schema.treatments.adjGeb,
        pal: schema.treatments.adjPal,
        kcalObj: schema.treatments.adjKcalObj,
        protGkg: schema.treatments.adjProtGkg,
        fatPct: schema.treatments.adjFatPct,
        deficit: schema.treatments.adjDeficit,
        objetivo: schema.treatments.objetivoTexto,
        restricciones: schema.treatments.restricciones,
        intercambio: schema.treatments.intercambioPorciones,
        activos: schema.treatments.tiemposActivos,
        tiempos: schema.treatments.tiempos,
        menu: schema.treatments.menuSemanal,
      })
      .from(schema.treatments)
      .where(eq(schema.treatments.id, treatmentId));
    const n = (v: unknown) => (v == null ? null : Number(v));
    return {
      ajustes: {
        adjGeb: n(t.geb),
        adjPal: n(t.pal),
        adjKcalObj: n(t.kcalObj),
        adjProtGkg: n(t.protGkg),
        adjFatPct: n(t.fatPct),
        adjDeficit: n(t.deficit),
        pesoMetaFijado: await pesoMetaGuardado(),
      },
      objetivo: t.objetivo,
      restricciones: t.restricciones ?? [],
      intercambio: t.intercambio ?? null,
      tiemposActivos: t.activos ?? null,
      tiempos: t.tiempos ?? null,
      menuSemanal: t.menu ?? null,
    };
  }

  it("guardar la cadena SIN tocar el peso meta no reescribe quién lo fijó", async () => {
    // El formulario de la cadena manda las seis columnas de golpe, asi que se guarda tambien cuando el
    // profesional vino a mover el PAL y ni miro el peso meta. Si la procedencia se reescribiera en ese
    // caso, un guardado cualquiera afirmaria que el peso lo decidio el nutricionista cuando lo habia
    // acordado quien hizo la entrada. La procedencia es informacion clinica, no un sello de "ultimo que
    // guardo": se conservo justo para poder distinguir esas dos cosas.
    await db
      .update(schema.evaluations)
      .set({ weightGoalKg: "72.5", weightGoalSetIn: "entrada" })
      .where(eq(schema.evaluations.id, evaluationId));

    // EL WRITER CAMBIO, LA GARANTIA NO (2026-09-09): era `saveAdjustments` y ahora es `guardarProtocolo`,
    // que escribe las siete secciones en una transaccion. La regla de la procedencia se porto con el, y
    // este caso es lo que lo comprueba: si al portarla se hubiera perdido, aqui sale rojo.
    let editable = await editableVigente();
    await guardarProtocolo({
      treatmentId,
      editable: {
        ...editable,
        ajustes: { ...editable.ajustes, adjGeb: 1950, adjPal: 1.55, pesoMetaFijado: 72.5 },
      },
      firmas: await firmasVigentes(),
      ...actor,
    });

    expect(await pesoMetaGuardado()).toBe(72.5);
    expect(await origenPesoMeta(), "un guardado que no tocó el peso meta reescribió su procedencia").toBe(
      "entrada",
    );

    // Y CAMBIARLO SI la cambia: sin esta mitad, el test de arriba pasaria verde tambien con la procedencia
    // congelada para siempre, que es el otro modo de mentir sobre quien decidio.
    editable = await editableVigente();
    await guardarProtocolo({
      treatmentId,
      editable: { ...editable, ajustes: { ...editable.ajustes, pesoMetaFijado: 70 } },
      firmas: await firmasVigentes(),
      ...actor,
    });
    expect(await pesoMetaGuardado()).toBe(70);
    expect(await origenPesoMeta()).toBe("tratamiento");
  });

  // Checkpoint 2.3: candado de saveNutraceuticals (BD real). Mismo patron que saveAdjustments: la prescripcion
  // se reemplaza EN BLOQUE, asi que sin candado un guardado con estado viejo borraria lo que otro profesional
  // acaba de prescribir. Al arrancar hay 1 nutraceutico (nutraA, del beforeAll).
  it("nutraceuticals camino feliz: firma base == actual -> escribe (reemplaza el set)", async () => {
    const base = await currentNutraSignature();
    await saveNutraceuticals({
      treatmentId,
      nutraceuticals: [
        { nutraceuticalId: nutraA, dosage: "1/dia", durationDays: 30 },
        { nutraceuticalId: nutraB, dosage: "2/dia", durationDays: 60 },
      ],
      baseSignature: base,
      ...actor,
    });
    expect(await nutraCount()).toBe(2);
  });

  it("nutraceuticals carrera: firma base != actual -> rechaza sin pisar (StaleNutraceuticalsError)", async () => {
    const antes = await nutraCount();
    await expect(
      saveNutraceuticals({
        treatmentId,
        nutraceuticals: [], // un guardado ciego aqui BORRARIA la prescripcion entera
        baseSignature: "STALE-DE-OTRA-SESION",
        ...actor,
      }),
    ).rejects.toBeInstanceOf(StaleNutraceuticalsError);
    expect(await nutraCount()).toBe(antes); // no se borro la prescripcion
  });
  const INTER: IntercambioSaved = { objetivoBase: 2000, porciones: { Cereales: 3 } };

  // CAMINO REAL del 500 (2026-08-22): una fila guardada con la FORMA VIEJA (por-grupo, {grupos}) de las pruebas
  // de CP1 antes del cambio a por-alimento. El writer la RELEE cruda y calculaba Object.keys(undefined) -> 500.
  // Este test siembra la forma vieja en la BD y guarda con el baseSignature que manda el cliente (el panel la
  // normaliza a null -> §none): el guardado debe SOBRESCRIBIRLA sin reventar, no rechazarla. Es el camino que
  // ningun test cubria (los otros arrancan de NULL o construyen el objeto a mano con la forma nueva).
  it("intercambio con forma VIEJA guardada: el writer la sobrescribe sin 500 (camino real)", async () => {
    await db
      .update(schema.treatments)
      .set({ intercambioPorciones: { objetivoBase: 1800, grupos: { G1: { porciones: 3, sub: "Cereales" } } } as never })
      .where(eq(schema.treatments.id, treatmentId));
    // El cliente ve la fila normalizada a null, asi que su firma es §none (no la de la forma vieja).
    const editable = await editableVigente();
    const firmas = { ...(await firmasVigentes()), intercambio: `${treatmentId}§none` };
    await expect(
      guardarProtocolo({ treatmentId, editable: { ...editable, intercambio: INTER }, firmas, ...actor }),
    ).resolves.toBeDefined();
    const [t] = await db.select({ inter: schema.treatments.intercambioPorciones }).from(schema.treatments).where(eq(schema.treatments.id, treatmentId));
    expect((t.inter as IntercambioSaved).porciones).toBeDefined();
    expect((t.inter as IntercambioSaved).objetivoBase).toBe(2000);
  });
});
