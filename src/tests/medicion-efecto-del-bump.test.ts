import { afterAll, describe, expect, it, vi } from "vitest";

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

// SE CIERRA EL POOL AL TERMINAR, y no es higiene de estilo: `postgres-js` abre hasta diez conexiones y
// las deja vivas mientras el proceso exista. Esta medicion se corre VARIAS veces seguidas (local, nube,
// otra vez con mas desglose), y cada corrida dejaba su pool: a la quinta se agotaron los slots de
// Postgres y el sintoma NO fue este archivo, fueron 29 fallos en auth-flows y rls con "Database error
// finding user". Un test que se corre en tanda tiene que devolver lo que toma.
afterAll(async () => {
  const { db } = await import("@/db");
  await (db.$client as { end: () => Promise<void> }).end();
});

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
    type Caso = { anos: number; alim: number; agua: number; gruposRespondidos: number; aguaPresente: boolean };
    const SUBEN: Caso[] = [];
    const BAJAN: Caso[] = [];
    // Los ids de las evaluaciones que piden reemision, para que el smoke sepa CUAL abrir. Un UUID no es
    // dato de paciente, y sin esto el recorrido de la reemision no se puede cerrar: hay que buscar a
    // ciegas cual de todas muestra el ambar con la lista.
    const PIDEN_REEMISION: { evaluationId: string; confirmado: boolean; cambios: string[] }[] = [];
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

          // DIRECCION, Y POR QUE HAY QUE MIRARLA. El valor fijo viejo era alimentacion 30 + hidratacion
          // 20 = 50. Al encender, la edad BAJA si la suma real supera 50 y SUBE si no llega, o sea que
          // subir es la conducta correcta para quien come e hidrata peor que ese fijo.
          //
          // PERO HAY UN CASO QUE SE VE IGUAL Y ES UN DEFECTO: un paciente cuya MATRIZ no esta respondida
          // (encuesta anterior a C9, o campos sin llegar) da `calcPatron` = 10 sobre un enc vacio y
          // agua = 20 por ausencia, o sea suma 30 y la edad le sube 1,50 anos exactos sobre datos que no
          // dio. Por eso se cuenta cuantos grupos respondio y si el agua llego: sin ese desglose, la
          // correccion y el defecto se leen igual.
          const respondidosMatriz = Array.from({ length: 15 }, (_, i) => `d1_${i + 1}_i`).filter(
            (k) => {
              const v = (ei.survey as Record<string, unknown>)[k];
              return typeof v === "string" && v !== "";
            },
          ).length;
          const aguaPresente =
            typeof (ei.survey as Record<string, unknown>).d7_agua === "string" &&
            (ei.survey as Record<string, unknown>).d7_agua !== "";
          const delta = Number((ebOn - ebOff).toFixed(2));
          if (delta > 0.005) {
            SUBEN.push({ anos: delta, alim, agua, gruposRespondidos: respondidosMatriz, aguaPresente });
          } else if (delta < -0.005) {
            BAJAN.push({ anos: delta, alim, agua, gruposRespondidos: respondidosMatriz, aguaPresente });
          }
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
        PIDEN_REEMISION.push({
          evaluationId: f.evaluationId,
          confirmado: f.confirmedAt != null,
          cambios: v.cambios.map((c) => c.que),
        });
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
              // EL DESGLOSE QUE SEPARA LA CORRECCION DEL DEFECTO. Subir la edad es correcto cuando la
              // suma real de alimentacion + hidratacion no llega a 50, que era el fijo viejo. NO lo es
              // cuando el paciente no respondio la matriz: ahi el 10 de `calcPatron` sobre un enc vacio
              // es un dato fabricado y el +1,50 exacto es su firma.
              bajan: {
                n: BAJAN.length,
                maxAnos: BAJAN.length ? Number(Math.min(...BAJAN.map((c) => c.anos)).toFixed(2)) : null,
                elExtremo: BAJAN.length
                  ? BAJAN.slice().sort((x, y) => x.anos - y.anos)[0]
                  : null,
              },
              suben: {
                n: SUBEN.length,
                maxAnos: SUBEN.length ? Number(Math.max(...SUBEN.map((c) => c.anos)).toFixed(2)) : null,
                // El tope aritmetico de la subida es +2,25 anos (alim 0 + agua 20). Cualquier cosa por
                // encima significa que la reconstruccion del ICEC apagado no es la que se supone.
                porEncimaDelTopeAritmetico: SUBEN.filter((c) => c.anos > 2.26).length,
                // La firma del defecto: matriz sin responder -> alim 10, agua ausente -> 20, +1,50 exacto.
                sinMatrizRespondida: SUBEN.filter((c) => c.gruposRespondidos === 0).length,
                sinAgua: SUBEN.filter((c) => !c.aguaPresente).length,
                conMatrizYAguaCompletos: SUBEN.filter((c) => c.gruposRespondidos === 15 && c.aguaPresente).length,
                casos: SUBEN.slice().sort((x, y) => y.anos - x.anos),
              },
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
              // Cuales abrir en el smoke. Los confirmados primero: son los que muestran el ambar con la lista.
              cuales: PIDEN_REEMISION.slice().sort((x, y) => Number(y.confirmado) - Number(x.confirmado)),
            },
          },
          null,
          2,
        ),
    );
    expect(recomputables).toBeGreaterThan(0);
  }, 180000);
});
