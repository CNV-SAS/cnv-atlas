import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.loadEnvFile(".env.local");

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// SIMULACION DEL RECALCULO DEL MOTOR 3.x  ·  SOLO LECTURA  ·  2026-11-06, corregida el 2026-11-07
//
// NO ES UN CANDADO: no afirma que una cifra sea correcta. MIDE cuanto se movera la cohorte si se ejecuta
// el recalculo, para que Santiago pueda aprobarlo (o no) con las cifras delante. Es el mismo genero que
// `medicion-efecto-del-bump.test.ts`, y existe por la misma razon: la pregunta se repite en cada bump y
// reconstruirla a mano es como se pierde la comparacion.
//
// ═══ QUE HAY QUE DECIDIR ═══
//
// El motor subio TRES veces en dos dias: 3.0.0 (el DFI pasa a leer la EB-BIS de la v7: CA-3, su v15),
// 3.1.0 (el puntaje de alimentacion del ICEC, de su v16 §4.2) y 3.2.0 (el borde de ±5 cerrado, de su v16).
// Las tres mueven el DIAGNOSTICO, y lo ya emitido NO se reescribe (regla 7): se reemite.
//
// SON TRES VERSIONES Y NO UNA porque cada una se escribio DESPUES de que la anterior ya estuviera
// empujada, asi que la nube podia estar sellando con ella. Ver `version.ts`.
//
// ═══ NO ESCRIBE NADA, Y ESO ES LA MITAD DEL DISEÑO ═══
//
// `simularConCienciaDeHoy` recomputa sin persistir. Esta medicion no emite, no sella y no reemite: la
// reemision es un acto del profesional (su §12b), y el recalculo masivo es un acto que Santiago aprueba.
//
// ═══ LAS TRES CORRECCIONES DEL 2026-11-07, QUE SALIERON DE LA PRIMERA CORRIDA CONTRA LA NUBE ═══
//
//  1. SE PASABA DE LOS 300 s, Y FALLABA DESPUES DE IMPRIMIR. No era una conexion sin cerrar (el pool se
//     cierra en `afterAll`, y se cerro): eran 492 consultas recomputadas DE UNA EN UNA contra un Postgres
//     remoto, y cada `simularConCienciaDeHoy` son varias consultas de ida y vuelta. Ahora van en LOTES
//     paralelos (`EN_PARALELO`), con latido de progreso y un timeout acorde.
//
//  2. `frenadasHoy` DECIA 28 CUANDO SON 70, y el error era de SITIO: se contaba DENTRO del bucle de
//     recomputo, despues de descartar las que no se pueden recomputar. O sea que medía "frenadas Y
//     recomputables" con el rotulo de "frenadas". El estado de HOY sale del snapshot sellado y no necesita
//     recomputar nada, asi que ahora se cuenta ANTES, en su propia fase. Y se añade la cifra que de verdad
//     decide: las frenadas que el recalculo NO VA A PODER TOCAR, que se quedarian frenadas para siempre.
//
//  3. NO DECIA POR QUE una consulta no se puede recomputar. `simularConCienciaDeHoy` devuelve `null` y se
//     traga el motivo a proposito (su consumidor es un aviso informativo y un fallo no puede tumbar la
//     pagina de una evaluacion vieja). Para la simulacion eso no alcanza: 282 de 492 sin causa no es un
//     dato, es un agujero. Ahora cada `null` se re-deriva paso a paso y se agrupa por causa.
//
// ═══ COMO SE CORRE ═══
//
//   local:  pnpm vitest run --project db src/tests/simulacion-del-recalculo-db.test.ts
//   nube:   $env:DATABASE_URL = "<la de produccion>"; pnpm vitest run --project db src/tests/simul...
//
// MANDA LA NUBE. Los datos locales estan sembrados y pueden caer justo sobre los valores viejos, que es
// lo que paso al encender el LE8 (35 de 42 en local). Y ya volvio a pasar con esta simulacion: en local
// "ninguna consulta pasaba a acelerado" y en la nube son 19.
//
// Imprime con el prefijo SIMULACION_300 para pescarlo del log. Solo agregados y UUID de evaluacion: ni un
// nombre, ni un documento, ni una cifra de paciente identificable.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Cuantas consultas se recomputan a la vez. El pool de `postgres-js` abre hasta diez conexiones. */
const EN_PARALELO = 8;

// SE CIERRA EL POOL AL TERMINAR. `postgres-js` deja hasta diez conexiones vivas, y varias corridas
// seguidas agotaban los slots, con el sintoma apareciendo en OTROS tests (29 fallos de auth con "Database
// error finding user").
afterAll(async () => {
  const { db } = await import("@/db");
  await (db.$client as { end: () => Promise<void> }).end();
});

type Snap = {
  indicators?: Record<string, number | null>;
  ebBis?: { estado?: string; iae?: number | null; eb?: number | null; motivo?: string | null };
  dfi?: {
    domains?: { id: string; sev: number | null; lectura?: string | null }[];
    riesgo?: { nivel?: string; score?: number | null };
    rutas?: string[];
    le8Total?: number | null;
  };
  versions?: { engine?: string };
};

/** Corre `fn` sobre `items` en lotes de `n`, conservando el orden, con latido de progreso. */
async function enLotes<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += n) {
    out.push(...(await Promise.all(items.slice(i, i + n).map(fn))));
    const hechas = Math.min(i + n, items.length);
    // Un latido cada diez lotes: sin esto, una corrida lenta contra la nube no se distingue de un cuelgue.
    if ((i / n) % 10 === 0) console.log(`SIMULACION_300 progreso ${hechas}/${items.length}`);
  }
  return out;
}

describe("simulacion del recalculo del motor 3.x", () => {
  it("mide a cuantos toca, que se mueve, y cuantos frenados se liberan", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const { simularConCienciaDeHoy } = await import(
      "@/modules/clinical-pipeline/data/simular-con-ciencia-de-hoy"
    );
    const { readPipelineInputs, readActiveModel } = await import(
      "@/modules/clinical-pipeline/data/pipeline-reader"
    );
    const { buildEngineInput } = await import("@/modules/clinical-pipeline/services/build-engine-input");
    const { hayDosLecturas, lecturaDelDfi, lecturaDeLaEbBis, seContradicen } = await import(
      "@/modules/reports/data/freno-de-la-contradiccion"
    );
    const { veredictoDeReemision } = await import("@/modules/clinical-pipeline/reemision");
    const { BANDA_IAE_ANIOS } = await import("@/clinical-engine/presentacion-eb-bis");
    const { ENGINE_VERSION, runEngine } = await import("@/clinical-engine");

    // UN INFORME POR EVALUACION, EL MAS RECIENTE. Reemitir crea otro informe de la misma consulta, y
    // contar los dos duplicaria el tamaño del recalculo. Es la misma regla que usa el freno.
    const filas = await db
      .select({
        evaluationId: schema.reports.evaluationId,
        createdAt: schema.reports.createdAt,
        sentAt: schema.reports.sentAt,
        snapshot: schema.reports.snapshot,
      })
      .from(schema.reports)
      .where(eq(schema.reports.type, "paciente"));

    const ultimo = new Map<string, (typeof filas)[number]>();
    for (const f of filas) {
      const prev = ultimo.get(f.evaluationId);
      if (!prev || f.createdAt > prev.createdAt) ultimo.set(f.evaluationId, f);
    }
    const consultas = [...ultimo.entries()];

    const sev = (o: Snap | null, id: string) => o?.dfi?.domains?.find((d) => d.id === id)?.sev ?? null;
    const lect = (o: Snap | null, id: string) => o?.dfi?.domains?.find((d) => d.id === id)?.lectura ?? null;
    const mayorDe = (motor: string) => /^(?:anibise-)?(\d+)\./.exec(motor)?.[1] ?? "sin version";

    // ══ FASE 1 · EL ESTADO DE HOY, QUE SALE DEL SNAPSHOT Y NO NECESITA RECOMPUTAR NADA ══
    const porMotorSellado: Record<string, number> = {};
    const frenadasHoy = new Set<string>();
    let frenadasHoyYaEnviadas = 0;

    for (const [evaluationId, f] of consultas) {
      const sellado = f.snapshot as Snap | null;
      const motor = sellado?.versions?.engine ?? "sin version";
      porMotorSellado[motor] = (porMotorSellado[motor] ?? 0) + 1;
      if (!sellado) continue;
      // El freno solo mira el mayor 2: antes de la v7 las dos lecturas salian del mismo calculo y desde la
      // 3.x hay una sola. Es el MISMO criterio del freno de verdad, leido de su modulo.
      const iae = sellado.indicators?.iae ?? null;
      if (!motor.startsWith("2.") || iae == null) continue;
      // SIN DOMINIO 3 NO HAY DOS LECTURAS, y por eso el freno de verdad deja pasar esa consulta. La
      // guarda se lee de SU modulo: escrita aqui a mano, la simulacion contaba de mas (un `sev` nulo lo
      // lee `lecturaDelDfi` como "no acelerado") y el numero habria dicho que el freno retiene consultas
      // que no retiene.
      if (!hayDosLecturas(sev(sellado, "d3"), lect(sellado, "d3"))) continue;
      const frenada = seContradicen({
        iae,
        segunLaEbBis: lecturaDeLaEbBis(iae),
        segunElDfi: lecturaDelDfi(sev(sellado, "d3"), lect(sellado, "d3"), sellado.dfi?.rutas),
      });
      if (frenada) {
        frenadasHoy.add(evaluationId);
        if (f.sentAt) frenadasHoyYaEnviadas++;
      }
    }

    // ══ FASE 2 · EL RECOMPUTO, EN LOTES ══
    console.log(`SIMULACION_300 recomputando ${consultas.length} consultas en lotes de ${EN_PARALELO}`);
    const recomputado = new Map<string, Snap | null>(
      await enLotes(
        consultas,
        EN_PARALELO,
        async ([evaluationId]) =>
          [evaluationId, (await simularConCienciaDeHoy(evaluationId)) as Snap | null] as [
            string,
            Snap | null,
          ],
      ),
    );

    // ══ FASE 3 · POR QUE NO SE PUEDE RECOMPUTAR, UNA POR UNA ══
    //
    // NO se duplica el motor: se vuelven a llamar las MISMAS piezas en el MISMO orden que
    // `simularConCienciaDeHoy`, y lo unico que se añade es mirar DONDE se cae.
    const sinRecomputo = consultas.filter(([id]) => recomputado.get(id) == null).map(([id]) => id);
    const modeloActivo = await readActiveModel();
    const causas: Record<string, string[]> = {};
    const anota = (causa: string, id: string) => {
      (causas[causa] ??= []).push(id);
    };

    console.log(`SIMULACION_300 buscando la causa de ${sinRecomputo.length} sin recomputo`);
    await enLotes(sinRecomputo, EN_PARALELO, async (evaluationId) => {
      if (!modeloActivo) {
        anota("no hay modelo activo (es global, no de la consulta)", evaluationId);
        return;
      }
      let inputs: Awaited<ReturnType<typeof readPipelineInputs>> = null;
      try {
        inputs = await readPipelineInputs(evaluationId);
      } catch (e) {
        anota(`el lector de insumos lanzo: ${(e as Error).message.slice(0, 80)}`, evaluationId);
        return;
      }
      if (!inputs) {
        anota("el lector de insumos no devuelve nada (la evaluacion no esta o no se puede leer)", evaluationId);
        return;
      }
      if (!inputs.hasBis) {
        anota("sin medicion de bioimpedancia vigente", evaluationId);
        return;
      }
      try {
        const ei = buildEngineInput(
          {
            sex: inputs.sex,
            birthDate: inputs.birthDate,
            measurementDate: inputs.measurementDate,
            surveyAnswers: inputs.surveyAnswers,
            expectedFieldKeys: inputs.expectedFieldKeys,
            bisRaw: inputs.bisRaw,
            gripStrengthKg: inputs.gripStrengthKg,
          },
          { version: modeloActivo.versionName, rulesVersion: modeloActivo.rulesVersion },
          new Date(),
        );
        runEngine(ei);
        // Si llega aqui, el motor SI corre: el null vino de otra parte y hay que mirarlo a mano.
        anota("el motor corre al reintentarlo: el null no viene del motor", evaluationId);
      } catch (e) {
        // El mensaje de `ClinicalInputError` dice QUE insumo falta o esta fuera de rango. Se recorta y se
        // agrupa, para que la salida sea una tabla de causas y no 282 lineas.
        anota(`el motor no corre: ${(e as Error).message.slice(0, 90)}`, evaluationId);
      }
    });

    // ══ FASE 4 · QUE SE MUEVE ══
    const porMayor = new Map<string, Record<string, number>>();
    const sube = (mayor: string, k: string) => {
      const m = porMayor.get(mayor) ?? {};
      m[k] = (m[k] ?? 0) + 1;
      porMayor.set(mayor, m);
    };

    let recomputables = 0;
    let cambiaD3 = 0;
    let cambiaD5 = 0;
    let cambiaRiesgoNivel = 0;
    let cambiaRutas = 0;
    let cambiaIcec = 0;
    let reemisionObligatoria = 0;
    const deltasIcec: Record<string, number[]> = {};
    const d3Nace: string[] = [];
    const d3Muere: {
      evaluationId: string;
      antes: number | null;
      estadoEbBis: string;
      motivo: string | null;
    }[] = [];
    const pasaAAcelerado: string[] = [];
    let dejaDeSerAcelerado = 0;
    let igualAcelerado = 0;
    const rutaEntra: Record<string, number> = {};
    const rutaSale: Record<string, number> = {};
    const conRutasQueCambian: string[] = [];
    const rutasSinAvisoDeBanda: string[] = [];
    const seDestraban: string[] = [];
    const siguenFrenadas: string[] = [];
    const frenadasNuevas: string[] = [];
    const enElBorde: { evaluationId: string; iae: number }[] = [];
    let acelerados = 0;
    let aceleradosConCorteAbierto = 0;

    for (const [evaluationId, f] of consultas) {
      const sellado = f.snapshot as Snap | null;
      const hoy = recomputado.get(evaluationId) ?? null;
      if (!sellado || !hoy) continue;
      recomputables++;
      const mayor = mayorDe(sellado.versions?.engine ?? "sin version");
      sube(mayor, "consultas");

      const sevAntes = sev(sellado, "d3");
      const sevDespues = sev(hoy, "d3");
      if (sevAntes !== sevDespues) {
        cambiaD3++;
        sube(mayor, "dominio3");
      }
      if (sevAntes == null && sevDespues != null) {
        d3Nace.push(evaluationId);
        sube(mayor, "dominio3QueNACE");
      }
      if (sevAntes != null && sevDespues == null) {
        // CON SU CAUSA AL LADO, que es lo que faltaba. El dominio 3 deja de puntuar cuando la v7 no puede
        // calcular, y entonces `ebBis.estado` trae el motivo. La v5 si podia (salia de IFC, PABU e ICEC) y
        // NO se cae a ella a proposito: volver a la cifra vieja reintroduce la contradiccion.
        d3Muere.push({
          evaluationId,
          antes: sevAntes,
          estadoEbBis: hoy.ebBis?.estado ?? "sin ebBis en el recomputado",
          motivo: hoy.ebBis?.motivo ?? null,
        });
        sube(mayor, "dominio3QueDESAPARECE");
      }
      if (sev(sellado, "d5") !== sev(hoy, "d5")) {
        cambiaD5++;
        sube(mayor, "dominio5");
      }
      if ((sellado.dfi?.riesgo?.nivel ?? null) !== (hoy.dfi?.riesgo?.nivel ?? null)) {
        cambiaRiesgoNivel++;
        sube(mayor, "riesgoNivel");
      }

      const icecAntes = sellado.dfi?.le8Total ?? null;
      const icecDespues = hoy.dfi?.le8Total ?? null;
      if (icecAntes !== icecDespues) {
        cambiaIcec++;
        sube(mayor, "icecTotal");
      }
      if (icecAntes != null && icecDespues != null) {
        (deltasIcec[mayor] ??= []).push(icecDespues - icecAntes);
      }

      const rutasAntes = new Set((sellado.dfi?.rutas ?? []).map(String));
      const rutasDespues = new Set((hoy.dfi?.rutas ?? []).map(String));
      const codigo = (r: string) => r.split(" ")[0];
      if (rutasAntes.size !== rutasDespues.size || [...rutasAntes].some((r) => !rutasDespues.has(r))) {
        cambiaRutas++;
        sube(mayor, "rutas");
        conRutasQueCambian.push(evaluationId);
        for (const r of rutasDespues)
          if (!rutasAntes.has(r)) rutaEntra[codigo(r)] = (rutaEntra[codigo(r)] ?? 0) + 1;
        for (const r of rutasAntes)
          if (!rutasDespues.has(r)) rutaSale[codigo(r)] = (rutaSale[codigo(r)] ?? 0) + 1;
      }

      const dfiAntes = lecturaDelDfi(sevAntes, lect(sellado, "d3"), sellado.dfi?.rutas);
      const dfiDespues = lecturaDelDfi(sevDespues, lect(hoy, "d3"), hoy.dfi?.rutas);
      if (dfiAntes !== dfiDespues) {
        if (dfiDespues === "acelerado") pasaAAcelerado.push(evaluationId);
        else dejaDeSerAcelerado++;
      } else {
        igualAcelerado++;
      }

      // ── EL FRENO, cruzado con la fase 1 ──
      const iaeDespues = hoy.indicators?.iae ?? null;
      const estabaFrenada = frenadasHoy.has(evaluationId);
      const frenadaDespues =
        iaeDespues == null
          ? false
          : seContradicen({
              iae: iaeDespues,
              segunLaEbBis: lecturaDeLaEbBis(iaeDespues),
              segunElDfi: dfiDespues,
            });
      if (estabaFrenada && !frenadaDespues) seDestraban.push(evaluationId);
      if (estabaFrenada && frenadaDespues) siguenFrenadas.push(evaluationId);
      if (!estabaFrenada && frenadaDespues) frenadasNuevas.push(evaluationId);

      // ── EL BORDE DE ±5, sobre el IAE recomputado (el que va a regir) ──
      if (iaeDespues != null) {
        if (iaeDespues >= BANDA_IAE_ANIOS) acelerados++;
        // EL CORTE VIEJO, el abierto, se sigue contando a proposito: la diferencia tiene que ser CERO
        // desde la 3.2.0, y si alguien reabre uno de los cuatro sitios esto lo dice en vez de callar.
        if (iaeDespues > BANDA_IAE_ANIOS) aceleradosConCorteAbierto++;
        if (Math.abs(Math.abs(iaeDespues) - BANDA_IAE_ANIOS) < 0.05) {
          enElBorde.push({ evaluationId, iae: iaeDespues });
        }
      }

      const v = veredictoDeReemision(sellado as never, hoy as never, true);
      if (v.kind === "reemision-obligatoria") reemisionObligatoria++;

      // ═══ EL CRUCE QUE DECIDE SI EL PROFESIONAL SE ENTERA ═══
      //
      // `veredictoDeReemision` compara CLASIFICACIONES (su §12b: "el criterio es el RESULTADO... cambia de
      // banda"): las bandas por indicador, el nivel de riesgo y las severidades de los cinco dominios.
      // NO compara las RUTAS. Asi que una consulta cuyas rutas sugeridas cambian pero cuyas bandas no, cae
      // en "solo marcar": el profesional ve el aviso gris de "emitido con una version anterior" y NO ve
      // que la sugerencia de tratamiento se movio.
      //
      // Esto se MIDE, no se arregla aqui: meter las rutas en la obligacion seria extender SU regla por
      // nuestra cuenta, y la Regla 0 dice que eso se le pregunta. Si la cifra es cero, no hay nada que
      // preguntar.
      if (
        (rutasAntes.size !== rutasDespues.size || [...rutasAntes].some((r) => !rutasDespues.has(r))) &&
        v.kind !== "reemision-obligatoria"
      ) {
        rutasSinAvisoDeBanda.push(evaluationId);
      }
    }

    // LAS FRENADAS QUE EL RECALCULO NO PUEDE TOCAR. Es la cifra que faltaba y la que decide si hace falta
    // una salida aparte: una consulta frenada que no se puede recomputar se queda frenada PARA SIEMPRE.
    const frenadasSinSalida = [...frenadasHoy].filter((id) => recomputado.get(id) == null);

    console.log(
      "SIMULACION_300 " +
        JSON.stringify(
          {
            motorDeHoy: ENGINE_VERSION,
            consultasConInforme: consultas.length,
            // SI APARECEN SNAPSHOTS CON EL MOTOR DE HOY, mirar de donde salieron. En LOCAL es normal (se
            // sellan al probar). En la NUBE significa que esa version ya se empujo.
            porMotorSellado,
            recomputables,
            porMayorSellado: Object.fromEntries([...porMayor].sort()),
            // LA TABLA QUE FALTABA: por que no se puede recomputar cada una, agrupado por causa.
            noRecomputables: {
              n: sinRecomputo.length,
              porCausa: Object.fromEntries(
                Object.entries(causas)
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([causa, ids]) => [causa, { n: ids.length, ejemplos: ids.slice(0, 5) }]),
              ),
            },
            seMueve: {
              dominio3: cambiaD3,
              dominio3QueNACE: d3Nace.length,
              dominio3QueDESAPARECE: { n: d3Muere.length, cuales: d3Muere },
              dominio5: cambiaD5,
              icecTotal: cambiaIcec,
              riesgoNivel: cambiaRiesgoNivel,
              rutas: cambiaRutas,
              reemisionObligatoria,
            },
            icecDelta: Object.fromEntries(
              Object.entries(deltasIcec)
                .sort()
                .map(([mayor, ds]) => {
                  const movidos = ds.filter((d) => d !== 0);
                  const prom = (xs: number[]) =>
                    xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)) : null;
                  return [
                    mayor,
                    {
                      comparables: ds.length,
                      seMueven: movidos.length,
                      min: movidos.length ? Math.min(...movidos) : null,
                      max: movidos.length ? Math.max(...movidos) : null,
                      promedio: prom(movidos),
                      bajan: movidos.filter((d) => d < 0).length,
                      suben: movidos.filter((d) => d > 0).length,
                    },
                  ];
                }),
            ),
            envejecimiento: {
              // CON SUS IDS: son los que estrenan la ruta R4, o sea los que estrenan una sugerencia de
              // tratamiento. Santiago necesita poder abrir uno en el navegador.
              pasaAAcelerado: { n: pasaAAcelerado.length, cuales: pasaAAcelerado },
              dejaDeSerAcelerado,
              igual: igualAcelerado,
            },
            rutas: {
              entran: rutaEntra,
              salen: rutaSale,
              conCambio: { n: conRutasQueCambian.length, ejemplos: conRutasQueCambian.slice(0, 10) },
              // LAS QUE CAMBIAN DE RUTA Y NO DISPARAN LA REEMISION OBLIGATORIA: el profesional ve el
              // aviso gris de procedencia, no el ambar que nombra lo que cambio. Si no es 0, hay que
              // preguntarle a Gildardo si una ruta que entra o sale cuenta como "cambio de banda".
              cambianRutaSinAvisoDeBanda: {
                n: rutasSinAvisoDeBanda.length,
                cuales: rutasSinAvisoDeBanda,
              },
            },
            freno: {
              // AHORA SI son todas las frenadas de hoy, no solo las recomputables.
              frenadasHoy: frenadasHoy.size,
              // TIENE QUE SER 0: el freno existe porque ninguna se habia enviado todavia.
              frenadasHoyYaEnviadas,
              seDestraban: seDestraban.length,
              // LAS QUE QUEDAN FRENADAS PARA SIEMPRE si no se les da otra salida.
              frenadasQueElRecalculoNoPuedeTocar: {
                n: frenadasSinSalida.length,
                cuales: frenadasSinSalida,
              },
              siguenFrenadas: { n: siguenFrenadas.length, cuales: siguenFrenadas },
              // SI ESTO NO ES 0, EL RECALCULO NO SE EJECUTA.
              frenadasNuevas: { n: frenadasNuevas.length, cuales: frenadasNuevas },
            },
            bordeDeLos5: {
              corte: BANDA_IAE_ANIOS,
              acelerados,
              // Desde la 3.2.0 los cuatro sitios usan el corte cerrado: esto tiene que ser 0.
              losQueElCorteABIERTOdejabaFuera: acelerados - aceleradosConCorteAbierto,
              exactamenteEnElBorde: enElBorde,
            },
          },
          null,
          2,
        ),
    );

    // LO UNICO QUE SE AFIRMA: que hubo algo que simular, y que cada `null` tiene una causa escrita. Una
    // medicion sobre cero filas imprime un informe perfecto y no dice nada; y 282 sin causa tampoco.
    expect(recomputables).toBeGreaterThan(0);
    expect(
      Object.values(causas).reduce((a, ids) => a + ids.length, 0),
      "hay consultas sin recomputo a las que no se les encontro la causa",
    ).toBe(sinRecomputo.length);
  }, 1_800_000);
});
