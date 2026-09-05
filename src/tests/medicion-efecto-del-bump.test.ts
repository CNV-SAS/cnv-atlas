import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.loadEnvFile(".env.local");

// MEDICION DEL EFECTO DE UN BUMP DE MOTOR. NO es un candado: no afirma que una cifra sea correcta, mide
// CUANTO se mueve y a cuantos pacientes. Se escribio para encender el LE8 (PLAN_LE8_ENCENDIDO §3) y se
// queda porque la pregunta se repite en cada bump: ya se hizo a mano en 1.1.0, en 1.2.0 y en 1.3.0, y
// reconstruirla cada vez es como se pierde la comparacion con lo que la Direccion Cientifica anuncia.
//
// COMO SE USA. Con el porte en el arbol de trabajo y ANTES de aplicar nada, se corre contra local y
// contra la NUBE (apuntando DATABASE_URL alla). Manda la nube: los datos locales estan sembrados y
// pueden caer justo sobre los valores viejos, que es lo que paso al encender el LE8 (35 de 42). Una
// medicion local no decide sobre datos de la nube.
//
// Imprime con el prefijo MEDICION_LE8 para poder pescarlo del log. Solo agregados: conteos y promedios,
// nunca un dato de paciente.
//
// DOS MEDICIONES, y hacen falta las dos:
//
//  (A) AISLADA. Para cada evaluacion se calcula el LE8 de hoy y se reconstruye por ARITMETICA EXACTA el
//      ICEC que habria dado con el interruptor apagado: los dos dominios que el interruptor mueve vuelven
//      a sus constantes (Alimentacion 30, Hidratacion 20) y los otros seis se dejan como estan, porque el
//      interruptor no los toca. Asi el delta es del LE8 y de nada mas, que es lo que se contrasta con su
//      cifra ("entre 1 y 8 anos").
//
//  (B) CONTRA LO SELLADO. Compara el snapshot con el recomputado de hoy, que es lo que de verdad dispara
//      la reemision en pantalla. Ese delta MEZCLA el LE8 con los bumps anteriores (hay diagnosticos
//      sellados con 1.0.0 y 1.1.0), asi que no sirve para contrastar su cifra, pero si para saber a
//      cuantos pacientes hay que reemitir.

describe("medicion del encendido del LE8", () => {
  it("mide el efecto, aislado y contra lo sellado", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const { simularConCienciaDeHoy } = await import(
      "@/modules/clinical-pipeline/data/simular-con-ciencia-de-hoy"
    );
    const { readPipelineInputs, readActiveModel } = await import(
      "@/modules/clinical-pipeline/data/pipeline-reader"
    );
    const { buildEngineInput } = await import(
      "@/modules/clinical-pipeline/services/build-engine-input"
    );
    const { veredictoDeReemision } = await import("@/modules/clinical-pipeline/reemision");
    const { calcLE8 } = await import("@/clinical-engine/analysis");
    const ix = await import("@/clinical-engine/frozen/engine.indices.js");
    const core = await import("@/clinical-engine/frozen/engine.core.js");

    const filas = await db
      .select({
        evaluationId: schema.diagnoses.evaluationId,
        confirmedAt: schema.diagnoses.confirmedAt,
        snapshot: schema.reports.snapshot,
      })
      .from(schema.diagnoses)
      .innerJoin(schema.reports, eq(schema.reports.evaluationId, schema.diagnoses.evaluationId));

    type Snap = {
      indicators?: Record<string, number | null>;
      classifications?: Record<string, { label?: string } | null>;
      dfi?: {
        domains?: { id: string; sev: number | null }[];
        riesgo?: { nivel?: string };
        rutas?: string[];
      };
    };

    const model = await readActiveModel();
    const DIST: string[] = [];
    const deltasEb: number[] = [];
    let recomputables = 0;
    let icecMovido = 0;
    let bandaIaeAislada = 0;
    let cambiaIae = 0;
    let cambiaD3 = 0;
    let cambiaD5 = 0;
    let cambiaRiesgo = 0;
    let cambiaRutas = 0;
    let reemisionObligatoria = 0;
    let reemisionEnConfirmados = 0;
    let confirmados = 0;

    for (const f of filas) {
      const sellado = f.snapshot as Snap | null;
      if (!sellado) continue;
      if (f.confirmedAt != null) confirmados++;
      const hoy = (await simularConCienciaDeHoy(f.evaluationId)) as Snap | null;
      if (!hoy) continue;
      recomputables++;

      // ---- (A) AISLADA ----
      const inputs = await readPipelineInputs(f.evaluationId);
      const ifc = hoy.indicators?.ifc ?? null;
      const pabu = hoy.indicators?.pabu ?? null;
      if (inputs && model && ifc != null && pabu != null) {
        const ei = buildEngineInput(
          {
            sex: inputs.sex,
            birthDate: inputs.birthDate,
            surveyAnswers: inputs.surveyAnswers,
            expectedFieldKeys: inputs.expectedFieldKeys,
            bisRaw: inputs.bisRaw,
            gripStrengthKg: inputs.gripStrengthKg,
          },
          { version: model.versionName, rulesVersion: model.rulesVersion },
          new Date(),
        );
        const le8 = calcLE8(ei.survey as Record<string, unknown>) as {
          scores: { dom: string; v: number }[];
          total: number | null;
        };
        if (le8.scores.length === 8) {
          const suma = le8.scores.reduce((a, s) => a + s.v, 0);
          const alim = le8.scores.find((s) => s.dom === "Alimentación")?.v ?? 0;
          const agua = le8.scores.find((s) => s.dom === "Hidratación")?.v ?? 0;
          const icecOn = Math.round(suma / 8);
          const icecOff = Math.round((suma - alim - agua + 30 + 20) / 8);
          if (icecOn !== icecOff) icecMovido++;
          DIST.push(alim + "/" + agua);
          const ebOn = ix.computeEBBIS(ifc, pabu, icecOn) as number;
          const ebOff = ix.computeEBBIS(ifc, pabu, icecOff) as number;
          deltasEb.push(Number((ebOn - ebOff).toFixed(2)));
          // La banda que dispara la reemision es la del IAE, y la edad se cancela al comparar las dos.
          const edad = ei.edad ?? 40;
          if (core.cIAE(ebOn - edad).l !== core.cIAE(ebOff - edad).l) bandaIaeAislada++;
        }
      }

      // ---- (B) CONTRA LO SELLADO ----
      const lab = (o: Snap | null, k: string) => o?.classifications?.[k]?.label ?? null;
      if (lab(sellado, "IAE") !== lab(hoy, "IAE")) cambiaIae++;
      const sev = (o: Snap | null, id: string) =>
        o?.dfi?.domains?.find((d) => d.id === id)?.sev ?? null;
      if (sev(sellado, "d3") !== sev(hoy, "d3")) cambiaD3++;
      if (sev(sellado, "d5") !== sev(hoy, "d5")) cambiaD5++;
      if ((sellado.dfi?.riesgo?.nivel ?? null) !== (hoy.dfi?.riesgo?.nivel ?? null)) cambiaRiesgo++;
      if (JSON.stringify(sellado.dfi?.rutas ?? []) !== JSON.stringify(hoy.dfi?.rutas ?? []))
        cambiaRutas++;

      const v = veredictoDeReemision(sellado as never, hoy as never, true);
      if (v.kind === "reemision-obligatoria") {
        reemisionObligatoria++;
        if (f.confirmedAt != null) reemisionEnConfirmados++;
      }
    }

    const movidos = deltasEb.filter((d) => Math.abs(d) > 0.005);
    const abs = movidos.map(Math.abs);
    const med = (xs: number[]) =>
      xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)) : null;
    console.log(
      "MEDICION_LE8 " +
        JSON.stringify(
          {
            distribucionAlimAgua: Object.fromEntries(Object.entries(DIST.reduce((m: Record<string, number>, k) => { m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a, b) => (b[1] as number) - (a[1] as number))),
            diagnosticos: filas.length,
            confirmados,
            recomputables,
            aislada: {
              comparables: deltasEb.length,
              icecSeMueve: icecMovido,
              ebSeMueve: movidos.length,
              ebDeltaMinAnos: abs.length ? Number(Math.min(...abs).toFixed(2)) : null,
              ebDeltaMaxAnos: abs.length ? Number(Math.max(...abs).toFixed(2)) : null,
              ebDeltaMedioAnos: med(abs),
              direccion: movidos.every((d) => d < 0)
                ? "SIEMPRE BAJA (como el anuncio)"
                : movidos.every((d) => d > 0)
                  ? "SIEMPRE SUBE (contrario al anuncio)"
                  : "MIXTA",
              bandaIaeCambia: bandaIaeAislada,
            },
            contraLoSellado: {
              cambiaIae,
              cambiaD3,
              cambiaD5,
              cambiaRiesgo,
              cambiaRutas,
              reemisionObligatoria,
              reemisionEnConfirmados,
            },
          },
          null,
          2,
        ),
    );
    expect(recomputables).toBeGreaterThan(0);
  }, 180000);
});
