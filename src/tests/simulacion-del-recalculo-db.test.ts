import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.loadEnvFile(".env.local");

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// SIMULACION DEL RECALCULO DEL MOTOR 3.0.0 + 3.1.0  ·  SOLO LECTURA  ·  2026-11-06
//
// NO ES UN CANDADO: no afirma que una cifra sea correcta. MIDE cuanto se movera la cohorte si se ejecuta
// el recalculo, para que Santiago pueda aprobarlo (o no) con las cifras delante. Es el mismo genero que
// `medicion-efecto-del-bump.test.ts`, y existe por la misma razon: la pregunta se repite en cada bump y
// reconstruirla a mano es como se pierde la comparacion.
//
// ═══ QUE HAY QUE DECIDIR, Y POR ESO QUE SE MIDE ESTO ═══
//
// El motor subio DOS veces el mismo dia: a 3.0.0 (el DFI pasa a leer la EB-BIS de la v7: CA-3, su v15) y a
// 3.1.0 (el puntaje de alimentacion del ICEC, re-portado de su v16 §4.2). Las dos mueven el DIAGNOSTICO, y
// lo ya emitido NO se reescribe (regla 7): se reemite. Asi que antes de ejecutar hace falta saber a cuantos
// pacientes toca, que se les mueve, y cuantos de los frenados quedan libres.
//
// POR QUE SON DOS VERSIONES Y NO UNA: la 3.0.0 ya se habia empujado cuando se porto el calcPatron, asi que
// meterlo dentro habria hecho que una misma version cubriera dos calculos del ICEC. Ver `version.ts`.
//
// ═══ NO ESCRIBE NADA, Y ESO ES LA MITAD DEL DISEÑO ═══
//
// `simularConCienciaDeHoy` recomputa sin persistir. Esta medicion no emite, no sella y no reemite: la
// reemision es un acto del profesional (su §12b), y el recalculo masivo es un acto que Santiago aprueba.
//
// ═══ COMO SE CORRE ═══
//
//   local:  pnpm vitest run --project db src/tests/simulacion-del-recalculo-db.test.ts
//   nube:   DATABASE_URL=<la de produccion> pnpm vitest run --project db src/tests/...
//
// MANDA LA NUBE. Los datos locales estan sembrados y pueden caer justo sobre los valores viejos, que es
// lo que paso al encender el LE8 (35 de 42 en local). Una medicion local no decide sobre datos de la nube.
//
// Imprime con el prefijo SIMULACION_300 para pescarlo del log. Solo agregados y UUID de evaluacion: ni un
// nombre, ni un documento, ni una cifra de paciente identificable.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

// SE CIERRA EL POOL AL TERMINAR. Misma razon que en `medicion-efecto-del-bump`: `postgres-js` deja hasta
// diez conexiones vivas, y varias corridas seguidas agotaban los slots, con el sintoma apareciendo en
// OTROS tests (29 fallos de auth con "Database error finding user").
afterAll(async () => {
  const { db } = await import("@/db");
  await (db.$client as { end: () => Promise<void> }).end();
});

type Snap = {
  indicators?: Record<string, number | null>;
  ebBis?: { estado?: string; iae?: number | null; eb?: number | null };
  dfi?: {
    domains?: { id: string; sev: number | null; lectura?: string | null }[];
    riesgo?: { nivel?: string; score?: number | null };
    rutas?: string[];
    le8Total?: number | null;
  };
  versions?: { engine?: string };
};

describe("simulacion del recalculo del motor 3.0.0 y 3.1.0", () => {
  it("mide a cuantos toca, que se mueve, y cuantos frenados se liberan", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const { simularConCienciaDeHoy } = await import(
      "@/modules/clinical-pipeline/data/simular-con-ciencia-de-hoy"
    );
    const { lecturaDelDfi, lecturaDeLaEbBis, seContradicen } = await import(
      "@/modules/reports/data/freno-de-la-contradiccion"
    );
    const { veredictoDeReemision } = await import("@/modules/clinical-pipeline/reemision");
    const { BANDA_IAE_ANIOS } = await import("@/clinical-engine/presentacion-eb-bis");
    const { ENGINE_VERSION } = await import("@/clinical-engine");

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

    // ── CONTADORES ───────────────────────────────────────────────────────────────────────────────
    const porMotorSellado: Record<string, number> = {};
    let recomputables = 0;
    const noRecomputables: string[] = [];

    // ═══ TODO SE CUENTA TAMBIEN POR MAYOR SELLADO, Y SIN ESO LA CIFRA GRANDE ENGAÑA ═══
    //
    // Comparar el recomputado de hoy contra un snapshot sellado con el mayor 1 mezcla TODOS los bumps
    // desde entonces: el encendido del LE8 de septiembre, la EB-BIS v7 de octubre, y los dos cambios de
    // la 3.0.0. En local eso hace que el ICEC "se mueva" en 343 de 344 consultas, y casi nada de eso es
    // del cambio que hay que aprobar hoy.
    //
    // EL GRUPO QUE DECIDE ES EL DEL MAYOR 2: ahi el unico delta posible son los dos cambios de la 3.0.0,
    // y es tambien el unico grupo al que el freno de la contradiccion puede aplicarse.
    const porMayor = new Map<string, Record<string, number>>();
    const sube = (mayor: string, k: string) => {
      const m = porMayor.get(mayor) ?? {};
      m[k] = (m[k] ?? 0) + 1;
      porMayor.set(mayor, m);
    };

    let cambiaD3 = 0;
    let cambiaD5 = 0;
    let cambiaRiesgoNivel = 0;
    let cambiaRutas = 0;
    let cambiaIcec = 0;
    let reemisionObligatoria = 0;
    const deltasIcec: Record<string, number[]> = {};

    // d3 que NACE: la recuperacion de CA-3 (la v5 lo dejaba sin puntuar sin ICEC, la v7 no lo necesita).
    let d3Nace = 0;
    let d3Muere = 0;

    // El volteo de "acelerado", que es lo que el freno mira.
    const volteoAcelerado = { pasaAAcelerado: 0, dejaDeSerAcelerado: 0, igual: 0 };

    // Las rutas, por codigo: cuantas veces entra y cuantas sale cada una.
    const rutaEntra: Record<string, number> = {};
    const rutaSale: Record<string, number> = {};

    // EL FRENO: cuantas de las frenadas HOY quedarian libres con el recomputado.
    let frenadasHoy = 0;
    let frenadasHoyYaEnviadas = 0;
    let seDestraban = 0;
    const siguenFrenadas: string[] = [];
    // Y el reverso, que es el que hay que mirar con lupa: una consulta que HOY se puede entregar y que
    // despues del recalculo se contradiria. Con las dos lecturas saliendo de la v7 no deberia haber
    // ninguna; si aparece una, el recalculo NO se ejecuta hasta entender por que.
    const frenadasNuevas: string[] = [];

    // EL BORDE DE ±5. Su v15 pasa `cIAE` a cortes cerrados y el Δ de su linea 15628 sigue abierto, asi
    // que en ±5,0 exacto su propio archivo se contradice (es su pregunta 36). Aqui se cuenta a cuantos
    // pacientes REALES les toca ese borde, que es lo que hace la pregunta urgente o irrelevante.
    const enElBorde: { evaluationId: string; iae: number }[] = [];
    let aceladosConNuestroCorte = 0;
    let aceladosConSuCorte = 0;

    for (const [evaluationId, f] of ultimo) {
      const sellado = f.snapshot as Snap | null;
      if (!sellado) continue;
      const motor = sellado.versions?.engine ?? "sin version";
      porMotorSellado[motor] = (porMotorSellado[motor] ?? 0) + 1;

      const hoy = (await simularConCienciaDeHoy(evaluationId)) as Snap | null;
      if (!hoy) {
        // NO SE PUEDE RECOMPUTAR: sin BIS, sin modelo activo, o el motor no corre con esos insumos. Son
        // las que su §1.4 manda dejar en "pendiente", nunca mostrando el v5.
        noRecomputables.push(evaluationId);
        continue;
      }
      recomputables++;
      const mayor = /^(?:anibise-)?(\d+)\./.exec(motor)?.[1] ?? "sin version";
      sube(mayor, "consultas");

      const sev = (o: Snap | null, id: string) =>
        o?.dfi?.domains?.find((d) => d.id === id)?.sev ?? null;
      const lect = (o: Snap | null, id: string) =>
        o?.dfi?.domains?.find((d) => d.id === id)?.lectura ?? null;

      const sevAntes = sev(sellado, "d3");
      const sevDespues = sev(hoy, "d3");
      if (sevAntes !== sevDespues) {
        cambiaD3++;
        sube(mayor, "dominio3");
      }
      if (sevAntes == null && sevDespues != null) {
        d3Nace++;
        sube(mayor, "dominio3QueNACE");
      }
      if (sevAntes != null && sevDespues == null) d3Muere++;
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
      // CUANTO se mueve, no solo a cuantos. Un "cambia en 62 de 62" con deltas de un punto es otra cosa
      // que el mismo conteo con deltas de diez, y la decision de recalcular depende de cual de las dos es.
      if (icecAntes != null && icecDespues != null) {
        (deltasIcec[mayor] ??= []).push(icecDespues - icecAntes);
      }

      const rutasAntes = new Set((sellado.dfi?.rutas ?? []).map(String));
      const rutasDespues = new Set((hoy.dfi?.rutas ?? []).map(String));
      const codigo = (r: string) => r.split(" ")[0];
      if (
        rutasAntes.size !== rutasDespues.size ||
        [...rutasAntes].some((r) => !rutasDespues.has(r))
      ) {
        cambiaRutas++;
        sube(mayor, "rutas");
        for (const r of rutasDespues) if (!rutasAntes.has(r)) rutaEntra[codigo(r)] = (rutaEntra[codigo(r)] ?? 0) + 1;
        for (const r of rutasAntes) if (!rutasDespues.has(r)) rutaSale[codigo(r)] = (rutaSale[codigo(r)] ?? 0) + 1;
      }

      // ── EL FRENO, con el MISMO criterio que usa el freno de verdad ──
      const iaeAntes = sellado.indicators?.iae ?? null;
      const iaeDespues = hoy.indicators?.iae ?? null;
      const comparableAntes = motor.startsWith("2.") && iaeAntes != null;

      const dfiAntes = lecturaDelDfi(sevAntes, lect(sellado, "d3"), sellado.dfi?.rutas);
      const dfiDespues = lecturaDelDfi(sevDespues, lect(hoy, "d3"), hoy.dfi?.rutas);
      if (dfiAntes !== dfiDespues) {
        if (dfiDespues === "acelerado") volteoAcelerado.pasaAAcelerado++;
        else volteoAcelerado.dejaDeSerAcelerado++;
      } else {
        volteoAcelerado.igual++;
      }

      if (comparableAntes) {
        const frenadaAntes = seContradicen({
          iae: iaeAntes,
          segunLaEbBis: lecturaDeLaEbBis(iaeAntes),
          segunElDfi: dfiAntes,
        });
        if (frenadaAntes) {
          frenadasHoy++;
          if (f.sentAt) frenadasHoyYaEnviadas++;
        }
        const frenadaDespues =
          iaeDespues == null
            ? false
            : seContradicen({
                iae: iaeDespues,
                segunLaEbBis: lecturaDeLaEbBis(iaeDespues),
                segunElDfi: dfiDespues,
              });
        if (frenadaAntes && !frenadaDespues) seDestraban++;
        if (frenadaAntes && frenadaDespues) siguenFrenadas.push(evaluationId);
        if (!frenadaAntes && frenadaDespues) frenadasNuevas.push(evaluationId);
      }

      // ── EL BORDE DE ±5, sobre el IAE recomputado (el que va a regir) ──
      if (iaeDespues != null) {
        // NUESTRO corte (engine.core.js L140-149): abajo abierto, arriba CERRADO (+5,0 queda Concordante).
        if (iaeDespues > BANDA_IAE_ANIOS) aceladosConNuestroCorte++;
        // El de su v15 (`cIAE`, L4487): los dos bordes inclusivos hacia el extremo.
        if (iaeDespues >= BANDA_IAE_ANIOS) aceladosConSuCorte++;
        if (Math.abs(Math.abs(iaeDespues) - BANDA_IAE_ANIOS) < 0.05) {
          enElBorde.push({ evaluationId, iae: iaeDespues });
        }
      }

      const v = veredictoDeReemision(sellado as never, hoy as never, true);
      if (v.kind === "reemision-obligatoria") reemisionObligatoria++;
    }

    console.log(
      "SIMULACION_300 " +
        JSON.stringify(
          {
            motorDeHoy: ENGINE_VERSION,
            consultasConInforme: ultimo.size,
            // SI APARECEN SNAPSHOTS CON EL MOTOR DE HOY, mirar de donde salieron. En LOCAL es normal: se
            // sellan al probar, y pueden haberse sellado con la 3.0.0 a medio construir (antes del
            // re-porte de `calcPatron`), asi que la misma cadena de version cubre dos matematicas. En la
            // NUBE no puede haber ninguno hasta que se empuje, y si hay uno es que se empujo sin aprobar.
            porMotorSellado,
            recomputables,
            // LA TABLA QUE DECIDE. El grupo "2" es el unico cuyo delta es SOLO de la 3.0.0; el "1"
            // mezcla todos los bumps desde su sello y sirve para dimensionar la reemision, no el cambio.
            porMayorSellado: Object.fromEntries([...porMayor].sort()),
            // LAS QUE EL RECALCULO NO VA A PODER TOCAR. Su §1.4 decide que hacer con ellas: quedan
            // "pendiente", nunca el v5. Son las que hay que marcar con su motivo.
            noRecomputables: { n: noRecomputables.length, cuales: noRecomputables },
            seMueve: {
              dominio3: cambiaD3,
              dominio3QueNACE: d3Nace,
              dominio3QueDESAPARECE: d3Muere,
              dominio5: cambiaD5,
              // EL ICEC NO TIENE CLASIFICADOR DE BANDA EN ATLAS: su "nivel" es el dominio 5 del DFI, que
              // es por donde entra al diagnostico. Asi que aqui va el total y arriba el dominio.
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
                      // La direccion importa: el puntaje de alimentacion del v16 penaliza mas de lo que
                      // premia, asi que lo esperable es que el ICEC BAJE en la mayoria.
                      bajan: movidos.filter((d) => d < 0).length,
                      suben: movidos.filter((d) => d > 0).length,
                    },
                  ];
                }),
            ),
            envejecimiento: volteoAcelerado,
            rutas: { entran: rutaEntra, salen: rutaSale },
            freno: {
              frenadasHoy,
              // TIENE QUE SER 0: el freno existe porque ninguna se habia enviado todavia.
              frenadasHoyYaEnviadas,
              seDestraban,
              siguenFrenadas: { n: siguenFrenadas.length, cuales: siguenFrenadas },
              // SI ESTO NO ES 0, EL RECALCULO NO SE EJECUTA. Con las dos lecturas saliendo de la v7 no
              // puede haber contradiccion nueva; una sola significa que algo no entendimos.
              frenadasNuevas: { n: frenadasNuevas.length, cuales: frenadasNuevas },
            },
            bordeDeLos5: {
              corte: BANDA_IAE_ANIOS,
              aceleradosConNuestroCorte: aceladosConNuestroCorte,
              aceleradosConSuCorteDeV15: aceladosConSuCorte,
              // La diferencia son los pacientes a los que la pregunta 36 les cambia la etiqueta.
              diferencia: aceladosConSuCorte - aceladosConNuestroCorte,
              exactamenteEnElBorde: enElBorde,
            },
          },
          null,
          2,
        ),
    );

    // LO UNICO QUE SE AFIRMA: que hubo algo que simular. Una medicion sobre cero filas imprime un informe
    // perfecto y no dice nada, que es la forma mas facil de aprobar un recalculo a ciegas.
    expect(recomputables).toBeGreaterThan(0);
  }, 300000);
});
