import { sql as dsql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import {
  instanteDeLaConsulta,
  partirNombre,
  respuestasDeLaConsulta,
  tipoDeDocumento,
  tipoDeLaConsulta,
  valoresBisDeLaConsulta,
} from "@/modules/importacion-html/services/mapeo-de-la-consulta";

vi.mock("server-only", () => ({}));

// ═══ LA IMPORTACION Y EL DESHACER (sesion 4, 2026-09-22) ═══
//
// Lo puro se prueba sin base; lo que escribe, CONTRA LA BASE REAL, porque es lo unico que atrapa un CHECK, un
// FK o una cascada mal puesta. Con datos sinteticos (ningun paciente real entra a una prueba).

describe("el mapeo de una consulta del HTML", () => {
  it("las respuestas viajan como las de Atlas: la opción múltiple, en JSON", () => {
    const c = { d3_27: "Muy mala", d2_21: ["Vómito", "Ejercicio excesivo"], d3_29: 10, d1_1_i: null, d4_32: "" };
    expect(respuestasDeLaConsulta(c, ["d3_27", "d2_21", "d3_29", "d1_1_i", "d4_32", "d9_nada"])).toEqual([
      { clave: "d3_27", valor: "Muy mala" },
      { clave: "d2_21", valor: '["Vómito","Ejercicio excesivo"]' },
      { clave: "d3_29", valor: "10" },
    ]);
  });

  it("la medición usa los nombres de variable de Atlas, y la cintura sigue la cadena de respaldo", () => {
    const valores = valoresBisDeLaConsulta(
      { Re: 627.3, Ri: 1306.4, FM: 18.04, tallaCm: 177, peso: 80.4, cintura: null, cadera: 0 },
      { excel: { cintura: null }, aMano: { cintura: 84, cadera: 106 } },
    );
    const por = Object.fromEntries(valores.map((v) => [v.variableName, v.value]));
    expect(por["Extracellular resistance"]).toBe(627.3);
    expect(por["Altura cm"]).toBe(177);
    expect(por["Waist Size cm"]).toBe(84);
    expect(por["Hips Size cm"]).toBe(106);
  });

  it("un cero no es una medida, y un ratio colado en la cintura tampoco", () => {
    const valores = valoresBisDeLaConsulta({ Re: 0, cintura: 0.84, cadera: 106 });
    expect(valores.find((v) => v.variableName === "Waist Size cm")).toBeUndefined();
    expect(valores.find((v) => v.variableName === "Extracellular resistance")).toBeUndefined();
  });

  it("si el paciente ya tenía evaluaciones en Atlas, ninguna importada es su inicial", () => {
    expect(tipoDeLaConsulta(0, false)).toBe("inicial");
    expect(tipoDeLaConsulta(1, false)).toBe("seguimiento");
    expect(tipoDeLaConsulta(0, true)).toBe("seguimiento");
  });

  it("el nombre se parte, y el tipo de documento cae en CC si no es de los nuestros", () => {
    expect(partirNombre("Ana María Prueba Gómez")).toEqual({ firstName: "Ana María", lastName: "Prueba Gómez" });
    expect(partirNombre("Ana")).toEqual({ firstName: "Ana", lastName: "" });
    expect(tipoDeDocumento("ce")).toBe("CE");
    expect(tipoDeDocumento("cedula")).toBe("CC");
  });

  it("la fecha de la consulta se guarda al mediodía de Bogotá, así ningún huso la corre de día", () => {
    expect(instanteDeLaConsulta("2026-08-13").toISOString()).toBe("2026-08-13T17:00:00.000Z");
  });
});

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const creado: { paciente?: string; lote?: string } = {};

describe.skipIf(!HAS_DB)("importar y deshacer un lote (BD real)", () => {
  afterAll(async () => {
    const { db } = await import("@/db");
    if (creado.paciente) await db.execute(dsql`delete from patients where id = ${creado.paciente}`);
    if (creado.lote) await db.execute(dsql`delete from html_import_batches where id = ${creado.lote}`);
  });

  it("escribe la consulta con su fecha, su encuesta, su medición y su consentimiento; y se deshace entero", async () => {
    const { db } = await import("@/db");
    const { importarLote, revertirLote } = await import("@/modules/importacion-html/data/importar-lote-writer");

    const [pp] = await db.execute<{ id: string; profile_id: string; organization_id: string }>(
      dsql`select pp.id, pp.profile_id, p.organization_id from professional_profiles pp
             join profiles p on p.id = pp.profile_id limit 1`,
    );
    const [version] = await db.execute<{ id: string }>(
      dsql`select id from survey_versions order by published_at desc limit 1`,
    );
    const preguntas = await db.execute<{ id: string; field_key: string }>(
      dsql`select id, field_key from survey_questions where survey_version_id = ${version.id} and field_key in ('d3_27','d2_21')`,
    );
    const preguntasPorClave = Object.fromEntries(preguntas.map((q) => [q.field_key, q.id]));
    const documento = `IMP-${Date.now()}`;

    const r = await importarLote({
      organizationId: pp.organization_id,
      professionalId: pp.id,
      actorId: pp.profile_id,
      actorEmail: "admin@cnv",
      ip: null,
      archivo: { nombre: "prueba.json", hash: "a".repeat(64) },
      declaracion: { version: "1.0", aceptadaEn: "2026-09-22T10:00:00Z" },
      surveyVersionId: version.id,
      preguntasPorClave,
      pacientes: [
        {
          documento,
          nombre: "Sintético Prueba",
          consultas: [
            {
              fecha: "2026-08-13",
              consulta: {
                nombre: "Sintético Prueba",
                fechaNac: "1990-05-01",
                sexo: "M",
                tipoDoc: "CC",
                email: "sintetico@example.com",
                consentimientoAceptado: true,
                firmaNombre: "Sintético Prueba",
                fechaConsentimiento: "13 de agosto de 2026",
                motivo: ["Control de peso"],
                d3_27: "Muy mala",
                Re: 627.3,
                Ri: 1306.4,
                FM: 18.04,
                peso: 80.4,
                tallaCm: 177,
                cintura: 84,
                cadera: 106,
              },
            },
            {
              // La segunda, SIN firma: el legal dijo que se importa igual, con esa marca.
              fecha: "2026-09-04",
              consulta: { nombre: "Sintético Prueba", consentimientoAceptado: false, firmaNombre: "", d2_21: ["Vómito"] },
            },
          ],
        },
      ],
    });
    creado.lote = r.batchId;
    expect(r.pacientesCreados).toBe(1);
    expect(r.consultasImportadas).toBe(2);

    const [paciente] = await db.execute<{ id: string }>(
      dsql`select id from patients where document_number = ${documento}`,
    );
    creado.paciente = paciente.id;

    const evals = await db.execute<{ id: string; type: string; status: string; created_at: string; import_batch_id: string }>(
      dsql`select id, type, status, created_at, import_batch_id from evaluations where patient_id = ${paciente.id} order by created_at`,
    );
    expect(evals.map((e) => e.type)).toEqual(["inicial", "seguimiento"]);
    expect(evals.every((e) => e.status === "in_progress")).toBe(true);
    expect(evals.every((e) => e.import_batch_id === r.batchId)).toBe(true);
    // La fecha de la consulta es la del HTML, no la de hoy.
    expect(new Date(evals[0].created_at).toISOString().slice(0, 10)).toBe("2026-08-13");

    // Encuesta, medicion y consentimiento de la primera.
    const [respuestas] = await db.execute<{ n: number }>(
      dsql`select count(*)::int as n from survey_answers sa join survey_responses sr on sr.id = sa.response_id
             where sr.evaluation_id = ${evals[0].id}`,
    );
    expect(respuestas.n).toBe(1);
    const valores = await db.execute<{ variable_name: string; value: string }>(
      dsql`select variable_name, value from bis_raw_values brv join bis_measurements bm on bm.id = brv.measurement_id
             where bm.evaluation_id = ${evals[0].id}`,
    );
    expect(valores.find((v) => v.variable_name === "Waist Size cm")?.value).toBe("84");
    const consentimientos = await db.execute<{ signature_method: string; typed_name: string | null }>(
      dsql`select signature_method, typed_name from patient_external_consents where patient_id = ${paciente.id}
             order by source_consultation_date`,
    );
    expect(consentimientos.map((c) => c.signature_method)).toEqual([
      "nombre_tecleado_sin_codigo",
      "sin_prueba_de_firma",
    ]);
    expect(consentimientos[1].typed_name).toBeNull();

    // NO se escribe ni diagnostico ni condiciones de la toma: eso lo hace el profesional en Atlas.
    const [sinDx] = await db.execute<{ n: number }>(
      dsql`select count(*)::int as n from diagnoses where evaluation_id = ${evals[0].id}`,
    );
    expect(sinDx.n).toBe(0);
    const [sinCondiciones] = await db.execute<{ n: number }>(
      dsql`select count(*)::int as n from evaluation_bis_intake where evaluation_id = ${evals[0].id}`,
    );
    expect(sinCondiciones.n).toBe(0);

    // Y la auditoria, por consulta.
    const [auditoria] = await db.execute<{ n: number }>(
      dsql`select count(*)::int as n from clinical_audit_log where event = 'importacion_html.consulta_importada'
             and payload->>'lote' = ${r.batchId}`,
    );
    expect(auditoria.n).toBe(2);

    // ── DESHACER ──────────────────────────────────────────────────────────────────────────────────
    const deshecho = await revertirLote({ batchId: r.batchId, actorId: pp.profile_id, actorEmail: "admin@cnv", ip: null });
    expect(deshecho.consultasRetiradas).toBe(2);
    expect(deshecho.pacientesBorrados).toBe(1);
    const [quedan] = await db.execute<{ n: number }>(
      dsql`select count(*)::int as n from patients where document_number = ${documento}`,
    );
    expect(quedan.n).toBe(0);
    creado.paciente = undefined;
    // El lote NO se borra: queda la constancia de que existio y de que se deshizo.
    const [lote] = await db.execute<{ reverted_at: string | null }>(
      dsql`select reverted_at from html_import_batches where id = ${r.batchId}`,
    );
    expect(lote.reverted_at).not.toBeNull();
  });
});

describe.skipIf(!HAS_DB)("la importada, con la encuesta completa, pide las condiciones (BD real)", () => {
  const rastro: { paciente?: string; lote?: string } = {};
  afterAll(async () => {
    const { db } = await import("@/db");
    // Las evaluaciones NO se van en cascada con el paciente (su FK es restrict): se borran primero.
    if (rastro.paciente) {
      await db.execute(dsql`delete from evaluations where patient_id = ${rastro.paciente}`);
      await db.execute(dsql`delete from patient_external_consents where patient_id = ${rastro.paciente}`);
      await db.execute(dsql`delete from patients where id = ${rastro.paciente}`);
    }
    if (rastro.lote) await db.execute(dsql`delete from html_import_batches where id = ${rastro.lote}`);
  });

  it("el gate del diagnóstico nombra las condiciones, no la encuesta", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const { importarLote } = await import("@/modules/importacion-html/data/importar-lote-writer");
    const { fillSurveyComplete } = await import("./fixtures/survey-fill");
    const { runClinicalPipeline } = await import("@/modules/clinical-pipeline/services/run-pipeline");

    const [pp] = await db.execute<{ id: string; profile_id: string; organization_id: string }>(
      dsql`select pp.id, pp.profile_id, p.organization_id from professional_profiles pp
             join profiles p on p.id = pp.profile_id limit 1`,
    );
    const [version] = await db.execute<{ id: string }>(
      dsql`select id from survey_versions order by published_at desc limit 1`,
    );
    const documento = `IMPGATE-${Date.now()}`;
    const r = await importarLote({
      organizationId: pp.organization_id,
      professionalId: pp.id,
      actorId: pp.profile_id,
      actorEmail: "admin@cnv",
      ip: null,
      archivo: { nombre: "prueba.json", hash: "b".repeat(64) },
      declaracion: { version: "1.0", aceptadaEn: "2026-09-22T10:00:00Z" },
      surveyVersionId: version.id,
      preguntasPorClave: {},
      pacientes: [
        {
          documento,
          nombre: "Sintético Gate",
          consultas: [
            {
              fecha: "2026-08-13",
              consulta: { nombre: "Sintético Gate", sexo: "M", fechaNac: "1990-05-01", Re: 627.3, Ri: 1306.4, Rinf: 423.8, C: 2.96, FM: 18.04, FFMI: 19.9, peso: 80.4, tallaCm: 177 },
            },
          ],
        },
      ],
    });
    rastro.lote = r.batchId;
    const [paciente] = await db.execute<{ id: string }>(dsql`select id from patients where document_number = ${documento}`);
    rastro.paciente = paciente.id;
    const [evaluacion] = await db.execute<{ id: string }>(
      dsql`select id from evaluations where patient_id = ${paciente.id}`,
    );

    // La encuesta, COMPLETA (es lo que el profesional hace al retomar al paciente).
    const [respuesta] = await db
      .insert(schema.surveyResponses)
      .values({ evaluationId: evaluacion.id, surveyVersionId: version.id })
      .returning({ id: schema.surveyResponses.id });
    await fillSurveyComplete(db, schema, eq, respuesta.id, version.id);

    const res = await runClinicalPipeline({
      evaluationId: evaluacion.id,
      actorId: pp.profile_id,
      actorEmail: "prof@cnv",
      ip: null,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain("condiciones de la toma BIS");
    // Llenar las 64 respuestas y correr el pipeline contra la base pasa de los 5 s por defecto cuando la
    // suite entera esta corriendo.
  }, 30_000);
});

describe("el ICC y el ICT de la consulta importada", () => {
  it("son los que calculó el HTML desde la cintura y la cadera tecleadas, no los del equipo", async () => {
    const { BIODY_COLUMNS } = await import("@/clinical-engine");
    const { normalizeHeader } = await import("@/modules/bis/services/header-map");
    const valores = valoresBisDeLaConsulta({ Re: 627.3, ICC: 0.79, ICT: 0.47, cintura: 84, cadera: 106 });
    const por = Object.fromEntries(valores.map((v) => [v.variableName, v.value]));
    expect(por[normalizeHeader(BIODY_COLUMNS.icc.header)]).toBe(0.79);
    expect(por[normalizeHeader(BIODY_COLUMNS.ict.header)]).toBe(0.47);
  });
});

describe.skipIf(!HAS_DB)("teclear la cintura y la cadera de una importada (BD real)", () => {
  const rastro: { paciente?: string; lote?: string } = {};
  afterAll(async () => {
    const { db } = await import("@/db");
    if (rastro.paciente) {
      await db.execute(dsql`delete from evaluations where patient_id = ${rastro.paciente}`);
      await db.execute(dsql`delete from patient_external_consents where patient_id = ${rastro.paciente}`);
      await db.execute(dsql`delete from patients where id = ${rastro.paciente}`);
    }
    if (rastro.lote) await db.execute(dsql`delete from html_import_batches where id = ${rastro.lote}`);
  });

  it("se guardan con su marca, y el ICC y el ICT se recalculan con la fórmula del HTML", async () => {
    const { db } = await import("@/db");
    const { BIODY_COLUMNS } = await import("@/clinical-engine");
    const { normalizeHeader } = await import("@/modules/bis/services/header-map");
    const { importarLote } = await import("@/modules/importacion-html/data/importar-lote-writer");
    const { guardarCircunferenciasTecleadas, CircunferenciasNoEditablesError } = await import(
      "@/modules/bis/data/circunferencias-writer"
    );

    const [pp] = await db.execute<{ id: string; profile_id: string; organization_id: string }>(
      dsql`select pp.id, pp.profile_id, p.organization_id from professional_profiles pp
             join profiles p on p.id = pp.profile_id limit 1`,
    );
    const [version] = await db.execute<{ id: string }>(
      dsql`select id from survey_versions order by published_at desc limit 1`,
    );
    const documento = `IMPCIRC-${Date.now()}`;
    const r = await importarLote({
      organizationId: pp.organization_id,
      professionalId: pp.id,
      actorId: pp.profile_id,
      actorEmail: "admin@cnv",
      ip: null,
      archivo: { nombre: "prueba.json", hash: "c".repeat(64) },
      declaracion: { version: "1.0", aceptadaEn: "2026-09-22T10:00:00Z" },
      surveyVersionId: version.id,
      preguntasPorClave: {},
      pacientes: [
        {
          documento,
          nombre: "Sintético Sin Cadera",
          // Como el paciente real de Santiago: con cintura y SIN cadera.
          consultas: [
            {
              fecha: "2026-08-13",
              consulta: { nombre: "Sintético Sin Cadera", Re: 627.3, FM: 18.04, peso: 80.4, tallaCm: 177, cintura: 84, cadera: 0 },
            },
          ],
        },
      ],
    });
    rastro.lote = r.batchId;
    const [paciente] = await db.execute<{ id: string }>(dsql`select id from patients where document_number = ${documento}`);
    rastro.paciente = paciente.id;
    const [evaluacion] = await db.execute<{ id: string }>(
      dsql`select id from evaluations where patient_id = ${paciente.id}`,
    );

    await guardarCircunferenciasTecleadas({
      evaluationId: evaluacion.id,
      cintura: null, // ya estaba
      cadera: 106,
      actorId: pp.profile_id,
      actorEmail: "prof@cnv",
      ip: null,
    });

    const valores = await db.execute<{ variable_name: string; value: string; origin: string }>(
      dsql`select variable_name, value, origin from bis_raw_values brv
             join bis_measurements bm on bm.id = brv.measurement_id where bm.evaluation_id = ${evaluacion.id}`,
    );
    const por = Object.fromEntries(valores.map((v) => [v.variable_name, v]));
    expect(por["Hips Size cm"].value).toBe("106");
    expect(por["Hips Size cm"].origin).toBe("tecleado");
    // ICC = cintura / cadera y ICT = cintura / talla, a tres decimales (v9 L7154-7155).
    expect(Number(por[normalizeHeader(BIODY_COLUMNS.icc.header)].value)).toBeCloseTo(84 / 106, 3);
    expect(Number(por[normalizeHeader(BIODY_COLUMNS.ict.header)].value)).toBeCloseTo(84 / 177, 3);
    // Y la cintura que ya estaba no cambia de origen: no se tecleo.
    expect(por["Waist Size cm"].origin).toBe("medido");

    // En una evaluación que NO vino del HTML, esto no se puede: ahí se vuelve a medir.
    const [propia] = await db.execute<{ id: string }>(
      dsql`select id from evaluations where import_batch_id is null limit 1`,
    );
    if (propia) {
      await expect(
        guardarCircunferenciasTecleadas({
          evaluationId: propia.id,
          cintura: 84,
          cadera: 106,
          actorId: pp.profile_id,
          actorEmail: "prof@cnv",
          ip: null,
        }),
      ).rejects.toBeInstanceOf(CircunferenciasNoEditablesError);
    }
  }, 30_000);
});
