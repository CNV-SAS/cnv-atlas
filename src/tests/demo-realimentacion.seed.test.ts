import { beforeAll, describe, expect, it, vi } from "vitest";

import { and, desc, eq } from "drizzle-orm";

import { normalizeHeader } from "@/modules/bis/services/header-map";
import biodyJson from "./fixtures/clinical-engine/biody-demo-realimentacion-f10.json";
import { DFI_COMPLETE_ANSWERS as ANSWERS, resolveAnswerValue } from "./fixtures/clinical-engine/dfi-complete-answers";
import { pickDemoProfessional, reassignDemoEvaluations } from "./fixtures/demo-professional";

// SEED de los avisos del PLAN ALIMENTARIO. Siembra, por la VIA REAL del pipeline, dos pacientes de
// demostracion que hacen visible lo que el motor calcula y el nutricionista tiene que ver:
//   F1 - riesgo de sindrome de realimentacion (fenotipo F10 + GEB < 1200 + IMC < 18.5).
//   F3 - lo mismo MAS insuficiencia renal e HTA, que levantan las RESTRICCIONES DEL MODELO
//        (proteina, fosforo y potasio por KDIGO; sodio por DASH), cada una con su referencia.
// Existe porque un aviso de seguridad no se da por bueno leyendo el codigo: hay que verlo renderizar,
// y cada vez que se toque esa zona hace falta un caso con que probar. La fila BIS es SINTETICA y esta
// marcada como demo en el nombre del paciente; sus valores estan calibrados para el caso (candado en
// demo-realimentacion-fixture.test.ts), no son una medicion. Idempotente, y REPARA lo ya sembrado.
// Corre bajo vitest solo con SEED_REALIMENTACION=1 y DATABASE_URL.
//
// EL PROFESIONAL SE ELIGE A PROPOSITO, NO "EL PRIMERO" (2026-08-23). La primera version tomaba
// `professional_profiles LIMIT 1` sin ORDER BY: le toco el MEDICO, y la pagina daba 404 al
// nutricionista (el reader es RLS: si la evaluacion no es suya devuelve null -> notFound). Ademas el
// smoke es del panel del NUTRICIONISTA, asi que asignarsela a otra profesion no serviria aunque
// abriera. Ahora se busca la nutricionista de forma determinista y, si no hay ninguna, el seed FALLA
// con un mensaje claro en vez de sembrar algo que nadie puede abrir.
//
// Donde mirar: /evaluaciones/<id> -> subpestaña del Nutricionista. La realimentacion sale DOS veces,
// a proposito y con redacciones distintas (el resumen informa, encima de la cadena instruye las 10
// kcal/kg/dia, ASPEN 2023). Las restricciones del modelo salen una vez, encima de la cadena.

vi.mock("server-only", () => ({}));

let RUN = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local
}
RUN = Boolean(process.env.DATABASE_URL) && process.env.SEED_REALIMENTACION === "1";

const biody = biodyJson as Record<string, unknown>;
function bisRawRows(fixture: Record<string, unknown>): { name: string; value: string }[] {
  const rows: { name: string; value: string }[] = [];
  for (const [k, v] of Object.entries(fixture)) {
    if (typeof v === "number" && Number.isFinite(v)) rows.push({ name: normalizeHeader(k), value: String(v) });
  }
  return rows;
}

// IDs fijos, obvios como demo (nadie los confunde con reales).
const PAT_SIMPLE = "a0000000-0000-4000-8000-0000000000f1";
const EVAL_SIMPLE = "a0000000-0000-4000-8000-0000000000f2";
const PAT_IRC = "a0000000-0000-4000-8000-0000000000f3";
const EVAL_IRC = "a0000000-0000-4000-8000-0000000000f4";

// Comorbilidades de la variante: van por el TEXTO de la respuesta, que es lo que lee el motor
// congelado (substring "renal" -> IRC, "hipert"/"hta" -> HTA). Son opciones reales de la encuesta
// vigente; si alguna se renombrara, el seed falla al no encontrarla en vez de sembrar un caso mudo.
const COMORBILIDADES: Record<string, string> = {
  d5_39: JSON.stringify(["Insuficiencia renal", "HTA"]),
  d5_36: "Sí",
};

describe.skipIf(!RUN)("seed demo de los avisos del plan (via pipeline real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let runClinicalPipeline: any;
  let orgId: string, proId: string, actorId: string, svId: string;

  beforeAll(async () => {
    schema = await import("@/db/schema");
    db = (await import("@/db")).db;
    runClinicalPipeline = (await import("@/modules/clinical-pipeline/services/run-pipeline")).runClinicalPipeline;
    orgId = (await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1))[0].id;
    // La NUTRICIONISTA, no "la primera fila" (ver demo-professional.ts, fuente unica de los tres seeds).
    const pro = await pickDemoProfessional(db, schema, "nutricionista");
    proId = pro.proId;
    actorId = pro.actorId;
    svId = (
      await db
        .select({ id: schema.surveyVersions.id })
        .from(schema.surveyVersions)
        .orderBy(desc(schema.surveyVersions.publishedAt))
        .limit(1)
    )[0].id;
  });

  async function sembrar(
    patientId: string,
    evalId: string,
    documento: string,
    nombre: string,
    apellido: string,
    overrides: Record<string, string>,
  ) {
    await db
      .insert(schema.patients)
      .values({ id: patientId, organizationId: orgId, documentType: "CC", documentNumber: documento })
      .onConflictDoNothing();
    await db
      .insert(schema.patientProfiles)
      .values({ patientId, firstName: nombre, lastName: apellido, sex: "F", birthDate: "1958-03-12", city: "Medellin" })
      .onConflictDoNothing();
    await db
      .insert(schema.patientProfessionalRelationships)
      .values({ patientId, professionalId: proId })
      .onConflictDoNothing();
    await db.insert(schema.patientContacts).values({ patientId, email: "sau.idk001@gmail.com" }).onConflictDoNothing();

    const dx = await db
      .select({ id: schema.diagnoses.id })
      .from(schema.diagnoses)
      .where(eq(schema.diagnoses.evaluationId, evalId))
      .limit(1);

    if (dx.length === 0) {
      await db
        .insert(schema.evaluations)
        .values({
          id: evalId,
          patientId,
          professionalId: proId,
          organizationId: orgId,
          type: "inicial",
          status: "in_progress",
        })
        .onConflictDoNothing();
      const respId = (
        await db
          .insert(schema.surveyResponses)
          .values({ evaluationId: evalId, surveyVersionId: svId })
          .returning({ id: schema.surveyResponses.id })
      )[0].id;
      // La encuesta se responde COMPLETA: el pipeline rechaza una incompleta (validacion de dominio).
      // Prioridad: override del caso > fixture DFI > primera opcion (o valor neutro si es abierta). El
      // relleno es por TIPO y no por lista, asi un bump de la encuesta no lo deja a medias en silencio.
      const questions = await db
        .select({
          id: schema.surveyQuestions.id,
          fieldKey: schema.surveyQuestions.fieldKey,
          tipo: schema.surveyQuestions.questionType,
        })
        .from(schema.surveyQuestions)
        .where(eq(schema.surveyQuestions.surveyVersionId, svId));
      for (const q of questions as { id: string; fieldKey: string | null; tipo: string }[]) {
        const opts = await db
          .select({ text: schema.surveyOptions.optionText })
          .from(schema.surveyOptions)
          .where(eq(schema.surveyOptions.questionId, q.id))
          .orderBy(schema.surveyOptions.orderIndex);
        const texts = opts.map((o: { text: string }) => o.text);
        let value: string;
        if (q.fieldKey && q.fieldKey in overrides) {
          value = overrides[q.fieldKey];
          const elegidas: string[] = value.startsWith("[") ? JSON.parse(value) : [value];
          for (const t of elegidas) {
            if (!texts.includes(t)) throw new Error(`opcion inexistente para ${q.fieldKey}: ${t}`);
          }
        } else if (q.fieldKey && q.fieldKey in ANSWERS) {
          value = resolveAnswerValue(texts, ANSWERS[q.fieldKey]);
        } else if (texts.length > 0) {
          value = q.tipo === "opcion_multiple" ? JSON.stringify([texts[0]]) : texts[0];
        } else {
          value = q.tipo === "numero" ? "1" : "Sin dato (paciente demo)";
        }
        await db.insert(schema.surveyAnswers).values({ responseId: respId, questionId: q.id, answerValue: value });
      }
      const measId = (
        await db
          .insert(schema.bisMeasurements)
          .values({ evaluationId: evalId, measurementDate: new Date("2026-08-20T10:00:00Z") })
          .returning({ id: schema.bisMeasurements.id })
      )[0].id;
      await db
        .insert(schema.bisRawValues)
        .values(bisRawRows(biody).map((r) => ({ measurementId: measId, variableName: r.name, value: r.value })));
      const res = await runClinicalPipeline({ evaluationId: evalId, actorId, actorEmail: "realim-demo@cnv", ip: null });
      expect(res.ok, res.ok ? "" : JSON.stringify(res.error)).toBe(true);
    } else {
      // REPARACION de lo ya sembrado con el dueño equivocado (ver demo-professional.ts).
      await reassignDemoEvaluations(db, schema, [evalId], proId);
    }

    const dxId = (
      await db
        .select({ id: schema.diagnoses.id })
        .from(schema.diagnoses)
        .where(eq(schema.diagnoses.evaluationId, evalId))
        .limit(1)
    )[0].id;
    return (
      await db
        .select({ p: schema.treatments.protocolSuggested })
        .from(schema.treatments)
        .where(eq(schema.treatments.diagnosisId, dxId))
        .limit(1)
    )[0].p;
  }

  it("F10 sin comorbilidad: el protocolo sellado levanta alertaSindRealim", async () => {
    const p = await sembrar(PAT_SIMPLE, EVAL_SIMPLE, "DEMO-REALIM-01", "Demo Realimentación", "Bajo peso (smoke)", {});
    expect(p.fenotipo.id).toBe("F10");
    expect(p.alertaSindRealim).toBe(true);
    // Sin comorbilidad no hay restricciones del modelo: el aviso ambar NO debe salir en este.
    expect(p.restricciones).toEqual([]);
  });

  it("F10 + IRC/HTA: ademas sella las restricciones del modelo con su referencia", async () => {
    const p = await sembrar(PAT_IRC, EVAL_IRC, "DEMO-REALIM-02", "Demo Restricciones", "Renal (smoke)", COMORBILIDADES);
    expect(p.alertaSindRealim).toBe(true);
    expect(p.flags.tieneIRC).toBe(true);
    expect(p.flags.tieneHTA).toBe(true);
    const nombres = (p.restricciones as { nombre: string }[]).map((r) => r.nombre);
    expect(nombres).toContain("Proteína");
    expect(nombres).toContain("Fósforo");
    expect(nombres).toContain("Potasio");
    expect(nombres).toContain("Sodio");
    // Cada una con su referencia: es lo que las distingue de una preferencia del profesional.
    for (const r of p.restricciones as { ref: string }[]) expect(r.ref.length).toBeGreaterThan(0);
  });

  it("las dos evaluaciones quedan a nombre de la NUTRICIONISTA (si no, la pagina da 404)", async () => {
    for (const evalId of [EVAL_SIMPLE, EVAL_IRC]) {
      const row = (
        await db
          .select({ pro: schema.evaluations.professionalId })
          .from(schema.evaluations)
          .where(eq(schema.evaluations.id, evalId))
          .limit(1)
      )[0];
      expect(row.pro).toBe(proId);
    }
    const prof = (
      await db
        .select({ p: schema.professionalProfiles.profession })
        .from(schema.professionalProfiles)
        .where(eq(schema.professionalProfiles.id, proId))
        .limit(1)
    )[0];
    expect(prof.p).toBe("nutricionista");
    // Y con el vinculo paciente-profesional creado: sin el, el roster no lo lista.
    for (const patientId of [PAT_SIMPLE, PAT_IRC]) {
      const rel = await db
        .select({ id: schema.patientProfessionalRelationships.patientId })
        .from(schema.patientProfessionalRelationships)
        .where(
          and(
            eq(schema.patientProfessionalRelationships.patientId, patientId),
            eq(schema.patientProfessionalRelationships.professionalId, proId),
          ),
        )
        .limit(1);
      expect(rel.length).toBe(1);
    }
  });
});
