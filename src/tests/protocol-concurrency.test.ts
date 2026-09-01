import { eq, sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  adjustmentSignature,
  guidelinesSignature,
  intercambioSignature,
  tiemposSignature,
  nutraceuticalsSignature,
  objetivoSignature,
  restriccionesSignature,
} from "@/modules/treatment/data/protocol-signature";
import type { IntercambioSaved, TiemposSaved } from "@/modules/treatment/data/treatment-view-types";

// Candado de concurrencia de las secciones editables del tratamiento (BD real): restricciones, guias,
// nutraceuticos, ajustes de la cadena. Cada una tiene su propia accion que REEMPLAZA su set EN BLOQUE, con
// su candado (checkpoint 2.4/2.5: el "Protocolo de tratamiento" y su firma por secciones se desarmaron).
// Verifica, por cada seccion: camino feliz (firma base == actual -> escribe) y carrera (firma base != actual
// -> RECHAZA sin pisar, con su Stale*Error; el dato queda INTACTO). Se auto-salta sin DATABASE_URL.

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
  let saveAdjustments: any;
  let StaleAdjustmentsError: any;
  let saveNutraceuticals: any;
  let StaleNutraceuticalsError: any;
  let saveRestricciones: any;
  let StaleRestriccionesError: any;
  let saveGuidelines: any;
  let StaleGuidelinesError: any;
  let saveObjetivo: any;
  let StaleObjetivoError: any;
  let saveIntercambio: any;
  let StaleIntercambioError: any;
  let saveTiempos: any;
  let StaleTiemposError: any;
  let treatmentId: string;
  let diagnosisId: string;
  let evaluationId: string;
  let patientId: string;
  let nutraA: string;
  let nutraB: string;
  const actor = { actorId: "", actorEmail: "concurrency@test", ip: null };

  // Firmas actuales de cada seccion editable (base de su candado). El "Protocolo de tratamiento" se desarmo
  // (checkpoint 2.4/2.5): cada una tiene su propia accion/candado/firma, no una firma por secciones.
  async function currentRestriccionesSignature(): Promise<string> {
    const [t] = await db
      .select({ restr: schema.treatments.restricciones })
      .from(schema.treatments)
      .where(eq(schema.treatments.id, treatmentId));
    return restriccionesSignature({ treatmentId, restricciones: t.restr ?? [] });
  }
  async function currentGuidelinesSignature(): Promise<string> {
    const guides = await db
      .select({ text: schema.treatmentDietGuidelines.guidelineText })
      .from(schema.treatmentDietGuidelines)
      .where(eq(schema.treatmentDietGuidelines.treatmentId, treatmentId));
    return guidelinesSignature({ treatmentId, guidelines: guides.map((g: { text: string }) => g.text) });
  }

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
    ({
      saveAdjustments,
      StaleAdjustmentsError,
      saveNutraceuticals,
      StaleNutraceuticalsError,
      saveRestricciones,
      StaleRestriccionesError,
      saveGuidelines,
      StaleGuidelinesError,
      saveObjetivo,
      StaleObjetivoError,
      saveIntercambio,
      StaleIntercambioError,
      saveTiempos,
      StaleTiemposError,
    } = await import("@/modules/treatment/data/treatment-writer"));

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

  // Checkpoint 2.4: candado de saveRestricciones (reemplaza el arreglo treatments.restricciones EN BLOQUE).
  // El seed arranca con ["sin gluten"].
  it("restricciones camino feliz: firma base == actual -> escribe", async () => {
    const base = await currentRestriccionesSignature();
    await saveRestricciones({ treatmentId, restricciones: ["sin gluten", "sin lactosa"], baseSignature: base, ...actor });
    const [t] = await db.select({ restr: schema.treatments.restricciones }).from(schema.treatments).where(eq(schema.treatments.id, treatmentId));
    expect(t.restr).toEqual(["sin gluten", "sin lactosa"]);
  });

  it("restricciones carrera: firma base != actual -> rechaza sin pisar (StaleRestriccionesError)", async () => {
    // Sin candado, este guardado ciego borraria una restriccion que otro acaba de fijar -> un plan que
    // ignora una alergia. La firma vieja no coincide -> rechaza.
    await expect(
      saveRestricciones({ treatmentId, restricciones: [], baseSignature: "STALE-DE-OTRA-SESION", ...actor }),
    ).rejects.toBeInstanceOf(StaleRestriccionesError);
    const [t] = await db.select({ restr: schema.treatments.restricciones }).from(schema.treatments).where(eq(schema.treatments.id, treatmentId));
    expect(t.restr).toEqual(["sin gluten", "sin lactosa"]); // no se borro
  });

  // Checkpoint 2.4: candado de saveGuidelines (reemplaza el set de treatment_diet_guidelines EN BLOQUE).
  async function guideCount(): Promise<number> {
    const rows = await db.select({ id: schema.treatmentDietGuidelines.id }).from(schema.treatmentDietGuidelines).where(eq(schema.treatmentDietGuidelines.treatmentId, treatmentId));
    return rows.length;
  }

  it("guias camino feliz: firma base == actual -> escribe (reemplaza el set)", async () => {
    const base = await currentGuidelinesSignature();
    await saveGuidelines({ treatmentId, guidelines: ["5 comidas al dia", "mas verduras"], baseSignature: base, ...actor });
    expect(await guideCount()).toBe(2);
  });

  it("guias carrera: firma base != actual -> rechaza sin pisar (StaleGuidelinesError)", async () => {
    const antes = await guideCount();
    await expect(
      saveGuidelines({ treatmentId, guidelines: [], baseSignature: "STALE-DE-OTRA-SESION", ...actor }),
    ).rejects.toBeInstanceOf(StaleGuidelinesError);
    expect(await guideCount()).toBe(antes); // no se borraron
  });

  // Tratamiento sub-tarea 2: candado de saveAdjustments (BD real). saveAdjustments ESCRIBE LAS SEIS columnas
  // adj_* de golpe; sin candado, dos guardados se pisan (el peso meta que otro profesional fijo se pierde).
  // Firma de los seis ajustes GUARDADOS = lo que el cliente cargo; el servidor la recomputa bajo lock.
  // EL PESO META SE LEE DE OTRA TABLA (migracion 0095), y por eso esta funcion consulta dos: la firma
  // tiene que recomponerse EXACTAMENTE como la recompone el servidor bajo lock, o el candado rechazaria
  // guardados legitimos. Es la mitad que se rompe en silencio si alguien mueve el peso meta y se olvida
  // de este lado.
  async function currentAdjSignature(): Promise<string> {
    const [t] = await db
      .select({
        geb: schema.treatments.adjGeb,
        pal: schema.treatments.adjPal,
        kcalObj: schema.treatments.adjKcalObj,
        protGkg: schema.treatments.adjProtGkg,
        fatPct: schema.treatments.adjFatPct,
      })
      .from(schema.treatments)
      .where(eq(schema.treatments.id, treatmentId));
    const pesoMeta = await pesoMetaGuardado();
    return adjustmentSignature({
      treatmentId,
      adjGeb: t.geb != null ? Number(t.geb) : null,
      adjPal: t.pal != null ? Number(t.pal) : null,
      adjKcalObj: t.kcalObj != null ? Number(t.kcalObj) : null,
      adjProtGkg: t.protGkg != null ? Number(t.protGkg) : null,
      adjFatPct: t.fatPct != null ? Number(t.fatPct) : null,
      pesoMetaFijado: pesoMeta,
    });
  }

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

  it("adjustments camino feliz: firma base == actual -> escribe los seis", async () => {
    const base = await currentAdjSignature();
    await saveAdjustments({
      treatmentId,
      adjGeb: 1950,
      adjPal: null,
      adjKcalObj: null,
      adjProtGkg: null,
      adjFatPct: null,
      pesoMetaFijado: 72.5,
      baseSignature: base,
      ...actor,
    });
    const [t] = await db
      .select({ geb: schema.treatments.adjGeb })
      .from(schema.treatments)
      .where(eq(schema.treatments.id, treatmentId));
    expect(Number(t.geb)).toBe(1950);
    // El peso meta se guardo en SU tabla, no en la del tratamiento, y con su procedencia: lo fijo el
    // nutricionista desde el panel. Sin la procedencia, el dato queda a medias (CHECK de la 0095).
    expect(await pesoMetaGuardado()).toBe(72.5);
    expect(await origenPesoMeta()).toBe("tratamiento");
    const [viejo] = await db
      .select({ pesoMeta: schema.treatments.adjPesoMeta })
      .from(schema.treatments)
      .where(eq(schema.treatments.id, treatmentId));
    expect(viejo.pesoMeta, "la columna supersedida volvió a escribirse").toBeNull();
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
        pesoMetaFijado: null, // un guardado ciego aqui BORRARIA el peso meta fijado
        baseSignature: "STALE-DE-OTRA-SESION",
        ...actor,
      }),
    ).rejects.toBeInstanceOf(StaleAdjustmentsError);

    // El dato quedo INTACTO: ni el GEB se piso ni el peso meta se borro. Y el peso meta importa doble
    // aqui, porque ahora vive en OTRA TABLA: un rechazo que revirtiera solo la del tratamiento dejaria las
    // dos escrituras desparejas, que es peor que no tener candado.
    const [t] = await db
      .select({ geb: schema.treatments.adjGeb })
      .from(schema.treatments)
      .where(eq(schema.treatments.id, treatmentId));
    expect(Number(t.geb)).toBe(1950); // el del camino feliz, no 3000
    expect(await pesoMetaGuardado()).toBe(72.5); // no se borro
    expect(await origenPesoMeta()).toBe("tratamiento");
  });

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

    await saveAdjustments({
      treatmentId,
      adjGeb: 1950,
      adjPal: 1.55, // lo unico que cambia
      adjKcalObj: null,
      adjProtGkg: null,
      adjFatPct: null,
      pesoMetaFijado: 72.5, // el MISMO que ya estaba
      baseSignature: await currentAdjSignature(),
      ...actor,
    });

    expect(await pesoMetaGuardado()).toBe(72.5);
    expect(await origenPesoMeta(), "un guardado que no tocó el peso meta reescribió su procedencia").toBe(
      "entrada",
    );

    // Y CAMBIARLO SI la cambia: sin esta mitad, el test de arriba pasaria verde tambien con la procedencia
    // congelada para siempre, que es el otro modo de mentir sobre quien decidio.
    await saveAdjustments({
      treatmentId,
      adjGeb: 1950,
      adjPal: 1.55,
      adjKcalObj: null,
      adjProtGkg: null,
      adjFatPct: null,
      pesoMetaFijado: 70,
      baseSignature: await currentAdjSignature(),
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

  // Pieza 1 (checkpoint 2.4): candado de saveObjetivo (columna treatments.objetivo_texto). El seed arranca
  // con objetivo_texto NULL.
  async function currentObjetivoSignature(): Promise<string> {
    const [t] = await db
      .select({ obj: schema.treatments.objetivoTexto })
      .from(schema.treatments)
      .where(eq(schema.treatments.id, treatmentId));
    return objetivoSignature({ treatmentId, objetivo: t.obj });
  }

  it("objetivo camino feliz: firma base == actual -> escribe", async () => {
    const base = await currentObjetivoSignature();
    await saveObjetivo({ treatmentId, objetivo: "Dieta antiinflamatoria", baseSignature: base, ...actor });
    const [t] = await db.select({ obj: schema.treatments.objetivoTexto }).from(schema.treatments).where(eq(schema.treatments.id, treatmentId));
    expect(t.obj).toBe("Dieta antiinflamatoria");
  });

  it("objetivo carrera: firma base != actual -> rechaza sin pisar (StaleObjetivoError)", async () => {
    await expect(
      saveObjetivo({ treatmentId, objetivo: "PISADO", baseSignature: "STALE-DE-OTRA-SESION", ...actor }),
    ).rejects.toBeInstanceOf(StaleObjetivoError);
    const [t] = await db.select({ obj: schema.treatments.objetivoTexto }).from(schema.treatments).where(eq(schema.treatments.id, treatmentId));
    expect(t.obj).toBe("Dieta antiinflamatoria"); // el del camino feliz, no PISADO
  });

  // CP1.2: candado de saveIntercambio (columna jsonb intercambio_porciones). Arranca NULL (firma base "§none").
  async function currentIntercambioSignature(): Promise<string> {
    const [t] = await db
      .select({ inter: schema.treatments.intercambioPorciones })
      .from(schema.treatments)
      .where(eq(schema.treatments.id, treatmentId));
    return intercambioSignature({ treatmentId, intercambio: (t.inter as IntercambioSaved | null) ?? null });
  }
  const INTER: IntercambioSaved = { objetivoBase: 2000, porciones: { Cereales: 3 } };

  it("intercambio camino feliz: firma base == actual -> escribe el jsonb", async () => {
    const base = await currentIntercambioSignature();
    await saveIntercambio({ treatmentId, intercambio: INTER, baseSignature: base, ...actor });
    const [t] = await db.select({ inter: schema.treatments.intercambioPorciones }).from(schema.treatments).where(eq(schema.treatments.id, treatmentId));
    expect((t.inter as IntercambioSaved).objetivoBase).toBe(2000);
  });

  it("intercambio carrera: firma base != actual -> rechaza sin pisar (StaleIntercambioError)", async () => {
    await expect(
      saveIntercambio({ treatmentId, intercambio: { objetivoBase: 9999, grupos: {} }, baseSignature: "STALE-DE-OTRA-SESION", ...actor }),
    ).rejects.toBeInstanceOf(StaleIntercambioError);
    const [t] = await db.select({ inter: schema.treatments.intercambioPorciones }).from(schema.treatments).where(eq(schema.treatments.id, treatmentId));
    expect((t.inter as IntercambioSaved).objetivoBase).toBe(2000); // el del camino feliz, no 9999
  });

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
    // El cliente ve la fila normalizada a null, asi que su baseSignature es §none (no la firma de la forma vieja).
    const baseComoCliente = `${treatmentId}§none`;
    await expect(
      saveIntercambio({ treatmentId, intercambio: INTER, baseSignature: baseComoCliente, ...actor }),
    ).resolves.toBeUndefined();
    const [t] = await db.select({ inter: schema.treatments.intercambioPorciones }).from(schema.treatments).where(eq(schema.treatments.id, treatmentId));
    expect((t.inter as IntercambioSaved).porciones).toBeDefined();
    expect((t.inter as IntercambioSaved).objetivoBase).toBe(2000);
  });

  // CP2.2: candado de saveTiempos (columna jsonb tiempos). Arranca NULL.
  async function currentTiemposSignature(): Promise<string> {
    const [t] = await db
      .select({ t: schema.treatments.tiempos })
      .from(schema.treatments)
      .where(eq(schema.treatments.id, treatmentId));
    return tiemposSignature({ treatmentId, tiempos: (t.t as TiemposSaved | null) ?? null });
  }
  const TIEMPOS: TiemposSaved = {
    celdas: { G1: { desayuno: 3 } },
    base: { porciones: { G1: 8 }, activos: { desayuno: true, almuerzo: true, cena: true } },
  };

  it("tiempos camino feliz: firma base == actual -> escribe el jsonb", async () => {
    const base = await currentTiemposSignature();
    await saveTiempos({ treatmentId, tiempos: TIEMPOS, baseSignature: base, ...actor });
    const [t] = await db.select({ t: schema.treatments.tiempos }).from(schema.treatments).where(eq(schema.treatments.id, treatmentId));
    expect(Object.keys((t.t as TiemposSaved).celdas)).toEqual(["G1"]);
  });

  it("tiempos carrera: firma base != actual -> rechaza sin pisar (StaleTiemposError)", async () => {
    await expect(
      saveTiempos({ treatmentId, tiempos: { ...TIEMPOS, celdas: {} }, baseSignature: "STALE-DE-OTRA-SESION", ...actor }),
    ).rejects.toBeInstanceOf(StaleTiemposError);
    const [t] = await db.select({ t: schema.treatments.tiempos }).from(schema.treatments).where(eq(schema.treatments.id, treatmentId));
    expect(Object.keys((t.t as TiemposSaved).celdas)).toEqual(["G1"]); // el del camino feliz, no vacio
  });
});
