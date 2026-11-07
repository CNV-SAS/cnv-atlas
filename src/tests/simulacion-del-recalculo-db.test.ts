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
//  4. Y AL ARREGLAR EL TIEMPO SE CAYERON LOS 282, QUE ERAN UN ARTEFACTO DEL PROPIO TIMEOUT (segunda
//     corrida, 174 s: quedan 14). Vale dejar escrito como se produjo, porque cualquier medicion larga
//     contra la nube puede repetirlo: al cumplirse los 300 s vitest falla el test y corre el `afterAll`,
//     que CIERRA EL POOL, pero la funcion del test sigue viva (una promesa suelta; JavaScript no se
//     interrumpe). Desde ese instante toda consulta falla, `simularConCienciaDeHoy` se la traga y
//     devuelve `null`, asi que las que faltaban se marcaron "no recomputables" de golpe y el bucle
//     termino rapido, imprimiendo el JSON completo justo DESPUES del fallo. Cuadra exacto: 210 + 282 =
//     492, y las cifras de movimiento de esa corrida escalaban por 478/210 = 2,28 (19 -> 47 acelerados,
//     55 -> 106 rutas, 91 -> 189 reemisiones). O sea que medían el 43 % de la cohorte con el rotulo de
//     toda. LA LECCION: una medicion que agota su timeout no da un resultado parcial, da un resultado
//     FALSO, y encima creible. El timeout va holgado y el latido de progreso dice si avanza.
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
    domains?: { id: string; sev: number | null; clasif?: string | null; lectura?: string | null }[];
    riesgo?: { nivel?: string; score?: number | null };
    rutas?: string[];
    le8Total?: number | null;
  };
  versions?: { engine?: string };
  // LAS TRES CAPAS QUE EL PIPELINE CONGELA junto al EngineOutput. La reemision nacio sin escribirlas y
  // dejo 424 consultas con "0 rutas activas": se miden para saber a cuantas les falta y para confirmar la
  // reparacion. Opcionales en el tipo porque los snapshots viejos tampoco las traen todas.
  rutasContent?: unknown[];
  efrContent?: unknown;
  validityCaveats?: unknown[];
};

// ═══ SE IMPRIME CON `process.stdout.write` Y NO CON `console.log`  ·  2026-11-07 ═══
//
// Vitest INTERCEPTA `console.*`, y segun como se corra (sin terminal interactiva, con la salida redirigida
// a un archivo, en CI) la salida de un test que PASA no aparece. Y el resultado de esta medicion ES la
// salida: una corrida de tres minutos contra la nube que termina en verde y no imprime nada obliga a
// repetirla. `process.stdout.write` no pasa por esa intercepcion y sale en los dos sitios.
const imprimir = (linea: string) => process.stdout.write(`${linea}\n`);

/** Corre `fn` sobre `items` en lotes de `n`, conservando el orden, con latido de progreso. */
async function enLotes<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += n) {
    out.push(...(await Promise.all(items.slice(i, i + n).map(fn))));
    const hechas = Math.min(i + n, items.length);
    // Un latido cada diez lotes: sin esto, una corrida lenta contra la nube no se distingue de un cuelgue.
    if ((i / n) % 10 === 0) imprimir(`SIMULACION_300 progreso ${hechas}/${items.length}`);
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
    // LA MISMA PUERTA QUE LA PANTALLA DE RECALIBRACION, no una copia: si la simulacion decidiera por su
    // cuenta quien entra, mediria un conjunto y la pantalla ofreceria otro.
    const { motivoParaNoReemitir } = await import("@/modules/clinical-pipeline/motivo-para-no-reemitir");
    const { huellasRepetidasEnVigentes } = await import("@/modules/bis/data/huellas-repetidas-reader");
    const { vigenciaEmision } = await import("@/modules/clinical-pipeline/emision-vigencia");
    const { edadSiSePuede } = await import("@/modules/clinical-pipeline/services/build-engine-input");

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

    // ══ FASE 0 · EL CONTEXTO DE CADA CONSULTA, EN UNA SOLA IDA ══
    //
    // Quien la atendio (para poder decirle a cada profesional cuantas le tocan), si su paciente cuenta
    // como de prueba, su fecha de nacimiento y la de la medicion. La edad se mide A LA FECHA DE LA TOMA y
    // no a hoy: es la misma regla que cerro "una fecha ilegible que se vuelve edad cero".
    const ctxFilas = await db
      .select({
        evaluationId: schema.evaluations.id,
        profesionalId: schema.evaluations.professionalId,
        nombreDelProfesional: schema.profiles.fullName,
        esDePrueba: schema.patients.cuentaComoDePrueba,
        nacimiento: schema.patientProfiles.birthDate,
        medicion: schema.bisMeasurements.measurementDate,
      })
      .from(schema.evaluations)
      .innerJoin(schema.patients, eq(schema.patients.id, schema.evaluations.patientId))
      .innerJoin(
        schema.professionalProfiles,
        eq(schema.professionalProfiles.id, schema.evaluations.professionalId),
      )
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.professionalProfiles.profileId))
      .leftJoin(schema.patientProfiles, eq(schema.patientProfiles.patientId, schema.patients.id))
      .leftJoin(
        schema.bisMeasurements,
        eq(schema.bisMeasurements.evaluationId, schema.evaluations.id),
      );

    type Ctx = {
      /** OCHO CARACTERES, sin nombre: esta salida se pega en documentos y los nombres no van a git. */
      profesional: string;
      nombre: string;
      esDePrueba: boolean;
      nacimiento: string | null;
      medicion: Date | null;
    };
    const ctx = new Map<string, Ctx>();
    for (const f of ctxFilas) {
      // VARIAS MEDICIONES POR CONSULTA es posible (una corregida deja la anterior colgada), asi que se
      // queda la MAS RECIENTE: la misma regla de "lo vigente es la ultima fila".
      const prev = ctx.get(f.evaluationId);
      const medicion = f.medicion ?? null;
      if (prev && (medicion == null || (prev.medicion != null && prev.medicion >= medicion))) continue;
      ctx.set(f.evaluationId, {
        profesional: f.profesionalId.slice(0, 8),
        nombre: f.nombreDelProfesional,
        esDePrueba: f.esDePrueba,
        nacimiento: f.nacimiento ?? null,
        medicion,
      });
    }

    // ═══ LA PREGUNTA QUE ESTE CRUCE CONTESTA, Y NO ES LA MISMA QUE `frenadasQueElRecalculoNoPuedeTocar` ═══
    //
    // El freno mira el snapshot SELLADO y solo aplica al mayor 2. Una consulta frenada se destraba cuando
    // su diagnostico se REEMITE (ahi lo sellado pasa a 3.x), no cuando el motor PUEDE recomputarla. Asi
    // que una frenada que la pantalla no ofrece se queda frenada aunque se ejecute el recalculo entero,
    // con el agravante de que el mensaje del freno le promete que se va a habilitar.
    //
    // `frenadasQueElRecalculoNoPuedeTocar` contesta "¿el motor puede?"; esto contesta "¿la pantalla va a
    // ofrecerla?". Las dos pueden diferir, y la segunda es la que decide si alguien queda sin salida.
    const porMotivoDeLaPantalla = (ids: Iterable<string>) => {
      const m: Record<string, number> = {};
      for (const id of ids) {
        const motivo = motivoDeCadaUna.get(id);
        if (motivo == null) continue;
        m[motivo] = (m[motivo] ?? 0) + 1;
      }
      return m;
    };

    /** Cuenta un conjunto de consultas por profesional, con los OCHO caracteres como clave. */
    const porProfesional = (ids: Iterable<string>) => {
      const m: Record<string, number> = {};
      for (const id of ids) {
        const k = ctx.get(id)?.profesional ?? "sin profesional";
        m[k] = (m[k] ?? 0) + 1;
      }
      return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
    };

    // ══ FASE 0b · QUE VA A OFRECER LA PANTALLA DE RECALIBRACION ══
    //
    // NO ES LO MISMO QUE "RECOMPUTABLE", y la diferencia es la que hay que tener delante antes de ejecutar:
    // el motor puede recomputar una consulta que la pantalla NO ofrece, porque la pantalla ademas excluye
    // la huella repetida (hay que resolver a quien pertenece la medicion), las edades fuera de 18 a 100
    // (la v7 no las puntua) y los pacientes de prueba. Se mide con `motivoParaNoReemitir`, la MISMA puerta.
    //
    // UN DESCUADRE ESPERADO CONTRA LA PANTALLA: esto cuenta consultas CON INFORME y la pantalla cuenta
    // DIAGNOSTICOS desfasados. Una consulta con diagnostico y sin informe sale en la pantalla y no aqui.
    // EL DIAGNOSTICO VIGENTE DE CADA CONSULTA, que es lo que la pantalla mira: su version sellada y sus
    // claves de emision. La pantalla lista lo que `vigenciaEmision` declara desfasado, asi que sin esto la
    // simulacion contaria tambien las que YA ESTAN AL DIA y su cifra no cuadraria con la pantalla.
    const dxFilas = await db
      .select({
        evaluationId: schema.diagnoses.evaluationId,
        createdAt: schema.diagnoses.createdAt,
        engineVersion: schema.diagnoses.engineVersion,
        emissionVersions: schema.diagnoses.emissionVersions,
      })
      .from(schema.diagnoses);
    const dxVigente = new Map<string, { engineVersion: string | null; emissionVersions: Record<string, unknown> | null; createdAt: Date }>();
    for (const d of dxFilas) {
      const prev = dxVigente.get(d.evaluationId);
      if (prev && prev.createdAt >= d.createdAt) continue;
      dxVigente.set(d.evaluationId, {
        engineVersion: d.engineVersion ?? null,
        emissionVersions: (d.emissionVersions as Record<string, unknown> | null) ?? null,
        createdAt: d.createdAt,
      });
    }

    const huellasRepetidas = await huellasRepetidasEnVigentes();
    const motivoDeCadaUna = new Map<string, string | null>();
    for (const [evaluationId, f] of consultas) {
      const c = ctx.get(evaluationId);
      const dx = dxVigente.get(evaluationId);
      const alDia = vigenciaEmision({
        engineVersion: dx?.engineVersion ?? null,
        emissionVersions: dx?.emissionVersions ?? null,
      }).alDia;
      motivoDeCadaUna.set(
        evaluationId,
        alDia
          ? "ya esta al dia con la ciencia de hoy: la pantalla no la lista"
          : c?.esDePrueba
          ? "paciente de prueba: la pantalla los cuenta aparte y no los reemite"
          : motivoParaNoReemitir({
              huellaRepetida: huellasRepetidas.has(evaluationId),
              nacimiento: c?.nacimiento ?? null,
              hasta: c?.medicion ?? f.createdAt,
            }),
      );
    }
    const entranALaPantalla = [...motivoDeCadaUna]
      .filter(([, m]) => m == null)
      .map(([id]) => id);
    const noEntranPorMotivo: Record<string, { n: number; cuales: string[] }> = {};
    for (const [id, m] of motivoDeCadaUna) {
      if (m == null) continue;
      (noEntranPorMotivo[m] ??= { n: 0, cuales: [] }).n++;
      noEntranPorMotivo[m].cuales.push(id);
    }

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
    imprimir(`SIMULACION_300 recomputando ${consultas.length} consultas en lotes de ${EN_PARALELO}`);
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

    imprimir(`SIMULACION_300 buscando la causa de ${sinRecomputo.length} sin recomputo`);
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
    // CON SUS IDS, para poder repartirlas por profesional: son las que su §12b vuelve obligatorias.
    const reemisionObligatoriaIds: string[] = [];
    const deltasIcec: Record<string, number[]> = {};
    const d3Nace: string[] = [];
    const d3Muere: {
      evaluationId: string;
      antes: number | null;
      estadoEbBis: string;
      motivo: string | null;
      /** LA EDAD A LA FECHA DE LA TOMA, que es la que decide. "edad no valida" no dice si es menor o
       *  mayor de 100, y la salida es distinta: el menor no se resuelve nunca, el de mas de 100 tampoco,
       *  y una fecha mal escrita si. */
      edadAlMedirse: number | null;
      /** Y si la pantalla de recalibracion la ofrece: si no, esto no llega a produccion. */
      laPantallaLaOfrece: boolean;
      profesional: string;
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
        const c = ctx.get(evaluationId);
        d3Muere.push({
          evaluationId,
          antes: sevAntes,
          estadoEbBis: hoy.ebBis?.estado ?? "sin ebBis en el recomputado",
          motivo: hoy.ebBis?.motivo ?? null,
          edadAlMedirse: edadSiSePuede(c?.nacimiento ?? null, c?.medicion ?? f.createdAt),
          laPantallaLaOfrece: motivoDeCadaUna.get(evaluationId) == null,
          profesional: c?.profesional ?? "sin profesional",
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
      if (v.kind === "reemision-obligatoria") reemisionObligatoriaIds.push(evaluationId);

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

    // ══ FASE 5 · QUE CAMBIO CON LA REEMISION, Y QUE QUEDO SIN CONGELAR ══
    //
    // Compara el informe VIGENTE con el que sucedio (la fila anterior de la misma consulta). Es la unica
    // forma de medirlo despues de ejecutar: sellado contra recomputado ya no dice nada, porque lo sellado
    // ES lo de hoy. Contesta dos cosas distintas:
    //
    //   1. A cuantas les cambiaron las RUTAS al reemitir. Su tratamiento se construyo con las anteriores
    //      (`treatments.diagnosis_id` apunta al diagnostico de antes, a proposito), asi que son las
    //      consultas donde la profesional tiene algo que mirar de verdad.
    //   2. A cuantas les falta una de las TRES CAPAS congeladas. Mide el defecto del 7 de noviembre (el
    //      snapshot de la reemision no las escribia) y es la cifra que confirma la reparacion: tiene que
    //      llegar a 0 en las reemitidas.
    //
    // ═══ Y NO SE COMPARA CONTRA LA FILA INMEDIATAMENTE ANTERIOR  ·  2026-11-07 ═══
    //
    // Esa era la primera version, y DABA CERO despues de completar las capas congeladas, que es el
    // resultado que Santiago no se creyo. La razon: la reparacion añadio una fila SUCESORA que copia el
    // snapshot entero, asi que cada consulta reemitida tiene ahora TRES informes (2.x original ->
    // reemision 3.2.0 -> sucesora 3.2.0) y la "anterior" era la reemision, con las MISMAS rutas. Medía
    // la reparacion, no la reemision.
    //
    // LA LECCION, que es de la casa: una comparacion "contra la fila anterior" deja de medir lo que dice
    // su rotulo en cuanto alguien inserta una fila en el medio, y no falla: da cero. Asi que lo que
    // define al comparando no es su POSICION sino su MOTOR, que es lo que cambio.
    const anteriorDeOtroMotor = new Map<string, (typeof filas)[number]>();
    for (const f of filas) {
      const vigente = ultimo.get(f.evaluationId);
      if (!vigente || f.createdAt >= vigente.createdAt) continue;
      const mayorVig = mayorDe((vigente.snapshot as Snap | null)?.versions?.engine ?? "sin version");
      if (mayorDe((f.snapshot as Snap | null)?.versions?.engine ?? "sin version") === mayorVig) continue;
      const prev = anteriorDeOtroMotor.get(f.evaluationId);
      if (!prev || f.createdAt > prev.createdAt) anteriorDeOtroMotor.set(f.evaluationId, f);
    }
    const rutasDeLaReemisionCambian: string[] = [];
    const reemitidas: string[] = [];
    const sinRutasContent: string[] = [];
    const sinEfrContent: string[] = [];
    const sinValidityCaveats: string[] = [];
    const rutasQueEntraron: Record<string, number> = {};
    const rutasQueSalieron: Record<string, number> = {};
    for (const [evaluationId, f] of consultas) {
      const vig = f.snapshot as Snap | null;
      if (!vig) continue;
      if (vig.rutasContent == null) sinRutasContent.push(evaluationId);
      if (vig.efrContent == null) sinEfrContent.push(evaluationId);
      if (vig.validityCaveats == null) sinValidityCaveats.push(evaluationId);
      const ant = anteriorDeOtroMotor.get(evaluationId)?.snapshot as Snap | null | undefined;
      if (!ant) continue;
      reemitidas.push(evaluationId);
      // POR EL ID DE LA RUTA Y NO POR LA CADENA ENTERA: el rotulo viaja en el mismo string
      // ("R1 · Restauración Celular") y un cambio de redaccion suyo se contaria como ruta que cambia.
      const a = new Set((ant.dfi?.rutas ?? []).map((r) => String(r).split(" ")[0]));
      const b = new Set((vig.dfi?.rutas ?? []).map((r) => String(r).split(" ")[0]));
      if (a.size !== b.size || [...a].some((r) => !b.has(r))) rutasDeLaReemisionCambian.push(evaluationId);
      // CUALES entraron y cuales salieron, que es lo que decide a quien hay que avisar: una R3 nueva
      // manda a psicologia y una R1 que desaparece retira indicaciones que ya se entregaron.
      for (const r of b) if (!a.has(r)) rutasQueEntraron[r] = (rutasQueEntraron[r] ?? 0) + 1;
      for (const r of a) if (!b.has(r)) rutasQueSalieron[r] = (rutasQueSalieron[r] ?? 0) + 1;
    }

    // ══ FASE 5b · LA R1 Y SU ROTULO DE ACTIVACION, QUE NO DESCRIBEN LA MISMA REGLA ══
    //
    // SALIO DEL SMOKE DE `ed83ff97`: su tarjeta de R1 dice *"Activación: IFC bajo + IRC alto + IAE
    // acelerado"* y su IRC es 2,71, que es Normal. Las dos cosas son de SU archivo (v16) y las dos estan
    // portadas verbatim, pero no son la misma regla:
    //
    //   · el ROTULO (`RUTAS.R1.activacion`, su L11685) va con su predicado `condicion` (la linea
    //     siguiente en su archivo): un Y de tres, `ifc < 4.5 && irc >= 3.5 && iae >= 5`;
    //   · la ACTIVACION de verdad es el DFI (`if(dom1.sev>=2)`, su L14095), y su propio archivo lo
    //     declara con ese titulo: *"DFI como UNICA fuente de rutas"*. El dominio 1 sale de la matriz D1
    //     sobre las ETIQUETAS de IFC e IRC (su L14023), donde `"Normal|Normal"` vale 2. El IAE no entra
    //     en el dominio 1: vive en el 3, que es el que activa la R4.
    //
    // O sea que su predicado `condicion` esta MUERTO en su propio archivo (solo lo llama `activar`, que
    // no se usa) y en el nuestro (solo lo tocan los tests). Lo que se mide aqui es el TAMAÑO del
    // descuadre, para poder preguntarselo con la cifra delante: cuantas consultas llevan la R1 activa
    // sin cumplir las tres del rotulo, y cuantas cumplen las tres sin llevarla.
    //
    // NO SE ARREGLA AQUI NI EN EL MOTOR: cambiar el rotulo es editar su contenido clinico y cambiar la
    // activacion es editar su DFI. La Regla 0 dice que esto se le devuelve a el.
    const r1SinLasTres: string[] = [];
    const lasTresSinR1: string[] = [];
    // POR CELDA DE SU MATRIZ D1, que es lo que contesta la pregunta de fondo: de sus nueve celdas, SEIS
    // valen 2 o 3, y una de ellas es "Normal|Normal". O sea que la R1 queda apagada solo con IFC Alto, o
    // con IFC Normal e IRC Bajo. Con la cuenta por celda delante, la pregunta deja de ser una impresion.
    const porCeldaD1: Record<string, { r1: number; sinR1: number }> = {};
    for (const [evaluationId, f] of consultas) {
      const sellado = f.snapshot as Snap | null;
      const i = sellado?.indicators;
      const d1 = sellado?.dfi?.domains?.find((d) => d.id === "d1");
      if (d1?.clasif) {
        const celda = `${d1.clasif} (sev ${d1.sev ?? "sin medir"})`;
        const c = (porCeldaD1[celda] ??= { r1: 0, sinR1: 0 });
        if ((sellado?.dfi?.rutas ?? []).some((r) => String(r).startsWith("R1"))) c.r1 += 1;
        else c.sinR1 += 1;
      }
      if (!i) continue;
      const ifc = i.ifc ?? null;
      const irc = i.irc ?? null;
      const iae = i.iae ?? null;
      if (ifc == null || irc == null || iae == null) continue;
      const lasTres = ifc < 4.5 && ifc > 0 && irc >= 3.5 && iae >= 5;
      const tieneR1 = (sellado?.dfi?.rutas ?? []).some((r) => String(r).startsWith("R1"));
      if (tieneR1 && !lasTres) r1SinLasTres.push(evaluationId);
      if (lasTres && !tieneR1) lasTresSinR1.push(evaluationId);
    }

    // LAS FRENADAS QUE EL RECALCULO NO PUEDE TOCAR. Es la cifra que faltaba y la que decide si hace falta
    // una salida aparte: una consulta frenada que no se puede recomputar se queda frenada PARA SIEMPRE.
    const frenadasSinSalida = [...frenadasHoy].filter((id) => recomputado.get(id) == null);

    imprimir(
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
            // LA TABLA QUE FALTABA: por que no se puede recomputar cada una, agrupado por causa. CON TODOS
            // LOS IDS (tope 60 por causa): con cinco ejemplos no se puede ir a buscar a los pacientes.
            noRecomputables: {
              n: sinRecomputo.length,
              porProfesional: porProfesional(sinRecomputo),
              porCausa: Object.fromEntries(
                Object.entries(causas)
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([causa, ids]) => [
                    causa,
                    { n: ids.length, cuales: ids.slice(0, 60), porProfesional: porProfesional(ids) },
                  ]),
              ),
            },
            // ══ LO QUE LA PANTALLA DE RECALIBRACION VA A OFRECER DE VERDAD ══
            //
            // `recomputables` es cuantas puede recomputar el MOTOR. Esto es cuantas se van a poder
            // SELECCIONAR, que es siempre menos y es la cifra que decide el tamaño de la tanda.
            laPantalla: {
              entran: entranALaPantalla.length,
              porProfesional: porProfesional(entranALaPantalla),
              noEntran: Object.fromEntries(
                Object.entries(noEntranPorMotivo)
                  .sort((a, b) => b[1].n - a[1].n)
                  // VEINTE IDS POR MOTIVO: lo que decide es la CUENTA, y las listas largas vuelven la
                  // salida impegable. Las que si van completas son las 14 sin recomputo, que son las que
                  // hay que ir a buscar una por una.
                  .map(([motivo, v]) => [motivo, { n: v.n, cuales: v.cuales.slice(0, 20) }]),
              ),
            },
            // ══ LO QUE DEJO LA REEMISION ══
            //
            // `laPrescripcionSeApoyaEnElAnterior` son las consultas con un informe anterior: su
            // tratamiento se construyo con el diagnostico de antes, y en Tratamiento sale el aviso.
            // `sinCongelar` tiene que ser 0 en las tres: si no, ese informe sale sin rutas, sin evidencia
            // del estado EFR o sin la reserva de validez de la medicion.
            laReemision: {
              laPrescripcionSeApoyaEnElAnterior: {
                n: reemitidas.length,
                porProfesional: porProfesional(reemitidas),
              },
              // CONTRA EL INFORME DEL MOTOR ANTERIOR (2.x o 1.x), no contra la fila de al lado: la
              // sucesora de la reparacion copia el snapshot, asi que comparar con ella da siempre 0.
              rutasQueCambiaronAlReemitir: {
                n: rutasDeLaReemisionCambian.length,
                porProfesional: porProfesional(rutasDeLaReemisionCambian),
                ejemplos: rutasDeLaReemisionCambian.slice(0, 10),
                cualesEntraron: rutasQueEntraron,
                cualesSalieron: rutasQueSalieron,
              },
              sinCongelar: {
                rutasContent: {
                  n: sinRutasContent.length,
                  reemitidas: sinRutasContent.filter((id) => anteriorDeOtroMotor.has(id)).length,
                  porProfesional: porProfesional(sinRutasContent.filter((id) => anteriorDeOtroMotor.has(id))),
                },
                efrContent: {
                  n: sinEfrContent.length,
                  reemitidas: sinEfrContent.filter((id) => anteriorDeOtroMotor.has(id)).length,
                },
                validityCaveats: {
                  n: sinValidityCaveats.length,
                  reemitidas: sinValidityCaveats.filter((id) => anteriorDeOtroMotor.has(id)).length,
                },
              },
            },
            // ══ EL DESCUADRE DE LA R1: SU ROTULO CONTRA SU ACTIVACION (fase 5b) ══
            //
            // `r1ConRotuloQueNoAplica` son las consultas donde la tarjeta dice "IFC bajo + IRC alto + IAE
            // acelerado" y la R1 entro por otra via (la matriz D1: "Normal|Normal" vale 2). `lasTresSinR1`
            // es el otro lado: cumplen las tres y NO llevan la ruta. Las dos cifras son para preguntarle a
            // Gildardo cual de sus dos reglas manda.
            laR1YSuRotulo: {
              r1ConRotuloQueNoAplica: {
                n: r1SinLasTres.length,
                porProfesional: porProfesional(r1SinLasTres),
                ejemplos: r1SinLasTres.slice(0, 10),
              },
              lasTresSinR1: { n: lasTresSinR1.length, ejemplos: lasTresSinR1.slice(0, 10) },
              // CON R1 Y SIN R1 POR CELDA DEL DOMINIO 1: dice SI el descuadre es un borde raro o la
              // regla general. Tope de 20 celdas para que la salida siga siendo pegable.
              porCeldaDelDominio1: Object.fromEntries(
                Object.entries(porCeldaD1)
                  .sort((x, y) => y[1].r1 + y[1].sinR1 - (x[1].r1 + x[1].sinR1))
                  .slice(0, 20),
              ),
            },
            // ══ A QUIEN LE TOCA MIRAR ALGO DESPUES, por profesional (ocho caracteres) ══
            //
            // Las tres cosas que le cambian el trabajo a una profesional: el aviso ambar que la obliga a
            // reemitir, las consultas cuya sugerencia de tratamiento se mueve, y los informes que se
            // destraban y ya puede entregar.
            quienTieneQueMirar: {
              reemisionObligatoria: {
                n: reemisionObligatoriaIds.length,
                porProfesional: porProfesional(reemisionObligatoriaIds),
                // EL AVISO AMBAR QUE NO SE VA A IR: son las que cambian de banda y la pantalla no ofrece.
                queLaPantallaNOofrece: {
                  n: reemisionObligatoriaIds.filter((id) => motivoDeCadaUna.get(id) != null).length,
                  porMotivo: porMotivoDeLaPantalla(reemisionObligatoriaIds),
                },
              },
              rutasQueCambian: {
                n: conRutasQueCambian.length,
                porProfesional: porProfesional(conRutasQueCambian),
              },
              informesQueSeDestraban: {
                n: seDestraban.length,
                porProfesional: porProfesional(seDestraban),
              },
            },
            seMueve: {
              dominio3: cambiaD3,
              dominio3QueNACE: d3Nace.length,
              dominio3QueDESAPARECE: { n: d3Muere.length, cuales: d3Muere },
              dominio5: cambiaD5,
              icecTotal: cambiaIcec,
              riesgoNivel: cambiaRiesgoNivel,
              rutas: cambiaRutas,
              reemisionObligatoria: reemisionObligatoriaIds.length,
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
              frenadasHoyPorProfesional: porProfesional(frenadasHoy),
              frenadasHoyCuales: [...frenadasHoy],
              // LAS QUE SE QUEDAN FRENADAS AUNQUE SE EJECUTE TODO, con su motivo y su profesional.
              frenadasQueLaPantallaNOofrece: {
                n: [...frenadasHoy].filter((id) => motivoDeCadaUna.get(id) != null).length,
                porMotivo: porMotivoDeLaPantalla(frenadasHoy),
                porProfesional: porProfesional(
                  [...frenadasHoy].filter((id) => motivoDeCadaUna.get(id) != null),
                ),
              },
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

    // ═══ EL DIRECTORIO DE PROFESIONALES, EN SU PROPIA LINEA Y FUERA DEL JSON ═══
    //
    // Los agregados de arriba llevan OCHO CARACTERES y ningun nombre, porque esa salida se pega en
    // documentos que van a git. Esta linea traduce los ocho caracteres a nombre para poder repartir el
    // trabajo, y es la unica que NO se copia a un documento versionado: va a `docs/entregas/dudas/`, que
    // esta fuera de git. No lleva ni un dato de paciente.
    const directorio = new Map<string, string>();
    for (const c of ctx.values()) directorio.set(c.profesional, c.nombre);
    imprimir(
      "SIMULACION_300 directorio (NO va a git) " +
        JSON.stringify(Object.fromEntries([...directorio].sort()), null, 2),
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
