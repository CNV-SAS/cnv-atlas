import { beforeAll, describe, expect, it, vi } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LEER POR INSTRUMENTO NO PUEDE CAMBIAR NI UNA PREGUNTA DE LA LINEA BASE  ·  EL CANDADO DE LA 0240
//
// ═══ QUE SE ESTA CAMBIANDO, Y POR QUE ESTO ES EL SEGURO ═══
//
// Hasta la 0240 la encuesta del paciente era "las preguntas de la version mas reciente, por su
// `order_index`". Desde la 0240 es "las preguntas que este INSTRUMENTO aplica, en el orden que el
// instrumento dice". Para la linea base tiene que ser EXACTAMENTE lo mismo: mismas preguntas, mismo
// orden, mismo texto.
//
// Y es la clase de cambio que no falla en voz alta. Si el instrumento se quedara sin una pregunta, la
// encuesta saldria con 63 en vez de 64 y nadie lo notaria hasta que un diagnostico se quede sin su
// insumo. Asi que no se afirma que sean iguales: se COMPARAN las dos listas, por los dos caminos.
//
// ═══ Y TRES PROPIEDADES MAS QUE LA ESTRUCTURA TIENE QUE CUMPLIR ═══
//
//   · ningun item de la linea base es `retirar` ni `confirmar`: en la primera consulta no hay nada
//     anterior que confirmar, y un `retirar` ahi dejaria una pregunta fuera del cuestionario completo;
//   · ningun `field_key` se repite dentro de un instrumento, que es la invariancia del §7.4 vista desde
//     la base: dos filas con el mismo `field_key` serian dos textos para la misma pregunta;
//   · el orden del instrumento no tiene huecos que lo vuelvan ambiguo (el UNIQUE ya lo impide, pero el
//     caso lo dice: el orden de presentacion sale de aqui).
//
// Se AUTO-SALTA sin DATABASE_URL. Requiere `supabase start`, migraciones aplicadas y el seed.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el guard salta el bloque.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("el instrumento de la linea base aplica la encuesta entera (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let sql: any;

  beforeAll(async () => {
    if (!HAS_DB) return;
    ({ db } = await import("@/db"));
    ({ sql } = await import("drizzle-orm"));
  });

  // ═══ LA VERSION DE LA LINEA BASE ES LA QUE SU INSTRUMENTO USA, no "la mas reciente publicada" ═══
  //
  // Y esto NO es circular: lo que el caso afirma es que el instrumento cubre esa version ENTERA y en su
  // orden. Si el instrumento perdiera una pregunta, la version la seguiria teniendo y las dos listas
  // diferirian, que es exactamente lo que hay que atrapar.
  //
  // "La mas reciente publicada" dejo de servir el 2026-11-07, y es el defecto que el cambio del lector
  // vino a cerrar: desde que el Modulo S tiene su propia version, esa consulta devuelve SIETE preguntas.
  // Este caso lo vivio: fallo diciendo "la base no tiene preguntas" cuando lo que pasaba es que estaba
  // mirando el cuestionario equivocado.
  const porLaVersion = async () =>
    (await db.execute(sql`
      select q.id, q.question_text, q.field_key, q.order_index
        from survey_questions q
       where q.survey_version_id = (
               select q2.survey_version_id
                 from survey_instrument_items i2
                 join survey_questions q2 on q2.id = i2.question_id
                 join survey_instruments s2 on s2.id = i2.instrument_id
                where s2.codigo = 'CNV v2.0'
                limit 1
             )
       order by q.order_index asc
    `)) as unknown as { id: string; question_text: string; field_key: string | null }[];

  const porElInstrumento = async () =>
    (await db.execute(sql`
      select q.id, q.question_text, q.field_key, i.order_index, i.comportamiento
        from survey_instrument_items i
        join survey_questions q on q.id = i.question_id
        join survey_instruments s on s.id = i.instrument_id
       where s.codigo = 'CNV v2.0'
       order by i.order_index asc
    `)) as unknown as {
      id: string;
      question_text: string;
      field_key: string | null;
      comportamiento: string;
    }[];

  it("las dos listas son la MISMA, en el mismo orden", async () => {
    const version = await porLaVersion();
    const instrumento = await porElInstrumento();
    expect(version.length, "la base no tiene preguntas: este caso no probaria nada").toBeGreaterThan(50);
    expect(
      instrumento.map((q) => `${q.id}|${q.question_text}`),
      "leer por instrumento cambio la encuesta de la linea base",
    ).toEqual(version.map((q) => `${q.id}|${q.question_text}`));
  });

  it("y en la linea base TODAS son `repetir`", async () => {
    // En la primera consulta no hay nada anterior que confirmar, y un `retirar` dejaria una pregunta
    // fuera del cuestionario completo sin que el conteo de completitud lo dijera.
    const comportamientos = new Set((await porElInstrumento()).map((q) => q.comportamiento));
    expect([...comportamientos]).toEqual(["repetir"]);
  });

  it("ningun `field_key` se repite dentro de un instrumento", async () => {
    // Es la invariancia de su §7.4 vista desde la base: dos filas con el mismo `field_key` en el mismo
    // instrumento serian dos textos para la misma pregunta, que es justo lo que esta estructura existe
    // para impedir. El motor congelado lee por `field_key` y se quedaria con uno de los dos.
    const repetidos = (await db.execute(sql`
      select s.codigo, q.field_key, count(*)::int as n
        from survey_instrument_items i
        join survey_questions q on q.id = i.question_id
        join survey_instruments s on s.id = i.instrument_id
       where q.field_key is not null
       group by 1, 2
      having count(*) > 1
    `)) as unknown as { codigo: string; field_key: string; n: number }[];
    expect(
      repetidos.map((r) => `${r.codigo}:${r.field_key} x${r.n}`),
      "un field_key aparece dos veces en el mismo instrumento",
    ).toEqual([]);
  });

  it("'la version mas reciente publicada' YA NO es la encuesta, y por eso el lector no la usa", async () => {
    // El lector preguntaba por la version mas reciente SIN filtrar por plantilla. Desde que el Modulo S
    // tiene la suya, esa consulta devuelve el Modulo S: la encuesta del paciente habria pasado a ser
    // siete preguntas de adherencia. Este caso fija el hecho para que nadie "simplifique" el lector
    // volviendo a esa consulta.
    const [reciente] = (await db.execute(sql`
      select v.id,
             (select count(*)::int from survey_questions q where q.survey_version_id = v.id) as n
        from survey_versions v
       order by v.published_at desc, v.id desc
       limit 1
    `)) as unknown as { id: string; n: number }[];
    const base = await porLaVersion();
    expect(
      reciente.n,
      "la version mas reciente volvio a ser la encuesta entera: si es asi, este caso ya no mide nada",
    ).not.toBe(base.length);
  });

  it("EL LECTOR DE VERDAD trae la encuesta entera, con sus opciones (el embed no es ambiguo)", async () => {
    // ═══ POR QUE ESTE CASO Y NO SOLO EL SQL DE ARRIBA ═══
    //
    // `survey_instrument_items` tiene DOS claves ajenas hacia `survey_questions` (`question_id` y
    // `filtro_question_id`), y eso vuelve AMBIGUO el embed de PostgREST: es el hazard que CLAUDE.md
    // describe con nombre propio, el mismo que rompio tres consultas el 2026-08-12 al agregar un FK a
    // una tabla ya referenciada. El lector lo desambigua con el hint del nombre del constraint, y un
    // hint equivocado NO lo ve tsc: falla en runtime, al abrir la encuesta un paciente.
    //
    // Asi que aqui se llama al LECTOR, no a una consulta parecida.
    const { getActiveSurvey } = await import("@/modules/evaluations/data/survey-reader");
    const encuesta = await getActiveSurvey();
    expect(encuesta, "el lector no devolvio la encuesta").not.toBeNull();
    const version = await porLaVersion();
    expect(
      encuesta?.questions.map((q) => q.id),
      "el lector trae otras preguntas que la version de la linea base",
    ).toEqual(version.map((q) => q.id));
    expect(encuesta?.instrumento.codigo).toBe("CNV v2.0");
    // Y CON SUS OPCIONES: un embed que trae la pregunta y pierde las opciones deja la encuesta con
    // enunciados y sin nada que pulsar, y el texto saldria igual en cualquier `toContain`.
    const conOpciones = (encuesta?.questions ?? []).filter((q) => q.options.length > 0);
    expect(conOpciones.length, "ninguna pregunta trajo opciones").toBeGreaterThan(50);
    // En la linea base ningun item cambia de seccion: la de la pregunta manda.
    expect([...new Set((encuesta?.questions ?? []).map((q) => q.comportamiento))]).toEqual(["repetir"]);
  });

  it("y el lector de la CNV-S trae el Modulo S DELANTE de la encuesta", async () => {
    // El orden de presentacion sale del item y no del `order_index` de la pregunta: sin eso, el Modulo S
    // caeria al final (sus preguntas se crearon despues) y su anexo A dice lo contrario.
    const { getActiveSurvey } = await import("@/modules/evaluations/data/survey-reader");
    const cnvs = await getActiveSurvey("CNV-S 1.0");
    expect(cnvs, "no existe el instrumento de seguimiento").not.toBeNull();
    const secciones = [...new Set((cnvs?.questions ?? []).map((q) => q.section))];
    // LOS ROTULOS CAMBIARON CON LA 0246 (ver el caso de mas abajo): aqui solo se comprueba el ORDEN,
    // que es lo que este caso vigila.
    expect(secciones.slice(0, 2), "el orden de su anexo A se perdio").toEqual([
      "Seguimiento",
      "Confirmación",
    ]);
    expect(secciones[secciones.length - 1]).toBe("Cierre");
    // Y LA VERSION QUE SE SELLA ES LA DEL CUESTIONARIO, no la del Modulo S: es la que el motor congelado
    // usa para resolver sus `field_key` y la que gatea una correccion.
    const base = await porLaVersion();
    const { getActiveSurvey: g2 } = await import("@/modules/evaluations/data/survey-reader");
    const linea = await g2();
    expect(cnvs?.surveyVersionId, "la CNV-S sellaria la version del Módulo S").toBe(
      linea?.surveyVersionId,
    );
    expect(base.length).toBeGreaterThan(50);
  });


  it("LAS RESPUESTAS DEL MODULO S SE VEN: sus preguntas NO son de la version sellada", async () => {
    // ══════════════════════════════════════════════════════════════════════════════════════════════
    // EL ULTIMO CABLE DE LA CNV-S, Y EL DEFECTO QUE ESTE CASO MIDE  ·  2026-11-08
    //
    // La respuesta sella la version del CUESTIONARIO (el caso de arriba), y la vista del profesional
    // pedia las preguntas DE ESA VERSION. Las del Modulo S viven en OTRA version, asi que las siete
    // respuestas quedaban guardadas y **invisibles**: el paciente las contesta, la base las tiene, y la
    // pestaña Evaluacion no mostraba ni la adherencia ni los eventos del S4. En el smoke se habria leido
    // como "el Modulo S no se guardo", que es falso y manda a buscar el defecto donde no esta.
    //
    // Este caso mide el HECHO que lo causa: las dos versiones son distintas, y por eso la vista tiene
    // que ensamblarse por el INSTRUMENTO y no por la version. Si algun dia el Modulo S pasara a la
    // version del cuestionario, este caso cae y hay que revisar si ese otro camino sigue haciendo falta.
    // ══════════════════════════════════════════════════════════════════════════════════════════════
    const { db } = await import("@/db");
    const { getActiveSurvey } = await import("@/modules/evaluations/data/survey-reader");
    const cnvs = await getActiveSurvey("CNV-S 1.0");
    // SE RECONOCEN POR SU CLAVE Y NO POR EL ROTULO de la seccion: el rotulo es texto para el paciente y
    // cambio el 2026-11-09 ("Módulo S" pasó a "Seguimiento", 0246), con lo que este caso se quedo
    // buscando una seccion que ya no existe y fallo diciendo que el Modulo S no tenia preguntas. La
    // clave es del instrumento y no cambia porque alguien ajuste una etiqueta.
    const propias = (cnvs?.questions ?? []).filter((q) => q.fieldKey?.startsWith("cnvs"));
    expect(propias.length, "el Modulo S se quedo sin preguntas").toBeGreaterThan(0);

    const versiones = new Set<string>();
    for (const q of propias) {
      const [fila] = (await db.execute(sql`
        select survey_version_id as v from survey_questions where id = ${q.id}::uuid`)) as unknown as { v: string }[];
      versiones.add(fila.v);
    }
    expect(versiones.size, "las preguntas del Modulo S se repartieron en varias versiones").toBe(1);
    expect(
      [...versiones][0],
      "el Modulo S paso a la version del cuestionario: revisar si el ensamblado por instrumento sigue haciendo falta",
    ).not.toBe(cnvs?.surveyVersionId);
  });


  it("UNO DE LOS CUATRO `retirar` ALIMENTA EL DIAGNOSTICO: por eso hay que heredarlos", async () => {
    // ══════════════════════════════════════════════════════════════════════════════════════════════
    // LA MEDICION QUE OBLIGA AL CABLE DE LA HERENCIA  ·  2026-11-08
    //
    // Los cuatro `retirar` no se vuelven a preguntar (su tabla 3). Si ademas no se heredan, la consulta
    // CNV-S nace sin ellos, y `d5_38` (familiares cercanos con estas enfermedades) tiene
    // `used_in_diagnosis = true`: la encuesta sale incompleta y el gate frena la emision. Lo que este
    // caso fija es el HECHO, no la opinion: cuantos de los retirados son del diagnostico.
    //
    // Si algun dia su tabla 3 cambia y ningun retirado alimenta el diagnostico, este caso cae y
    // entonces hay que decidir si la herencia sigue haciendo falta (seguiria haciendo falta para la
    // historia clinica, pero ya no frenaria nada).
    // ══════════════════════════════════════════════════════════════════════════════════════════════
    const retirados = (await db.execute(sql`
      select q.field_key, q.used_in_diagnosis
        from survey_instrument_items i
        join survey_instruments ins on ins.id = i.instrument_id
        join survey_questions q on q.id = i.question_id
       where ins.codigo = 'CNV-S 1.0' and i.comportamiento = 'retirar'
       order by i.order_index`)) as unknown as {
      field_key: string | null;
      used_in_diagnosis: boolean;
    }[];
    expect(retirados.length, "su tabla 3 retira cuatro items").toBe(4);
    const delDiagnostico = retirados.filter((r) => r.used_in_diagnosis).map((r) => r.field_key);
    expect(delDiagnostico, "cambio que retirados alimentan el diagnostico: revisar la herencia").toEqual(
      ["d5_38"],
    );
  });

  it("EL SELLO: un seguimiento de un paciente DE PRUEBA recibe la CNV-S; uno REAL, no", async () => {
    // ═══ LA PROPIEDAD DE SEGURIDAD DEL MODO PRUEBAS (2026-11-08) ═══
    //
    // Santiago quiere hacer el smoke EN PRODUCCION, asi que la CNV-S se aplica solo a pacientes de
    // prueba. Lo que no puede pasar es que alcance a una persona real: perderia los cuatro items
    // retirados (no se le preguntan y no hay linea base previa que conserve su valor) y recibiria un
    // cuestionario que Gildardo no ha aprobado.
    //
    // SE MIDE CONTRA LA BASE y no sobre la funcion pura, porque lo que decide es una columna DERIVADA
    // (`cuenta_como_de_prueba`, que incluye a todo paciente de un profesional marcado de prueba): la
    // funcion sola no dice nada sobre si esa derivacion llega hasta aqui.
    const { instrumentoDeUnSeguimiento } = await import(
      "@/modules/evaluations/data/instrumento-de-la-consulta"
    );
    const [dePrueba] = (await db.execute(
      sql`select id from patients where cuenta_como_de_prueba order by id limit 1`,
    )) as unknown as { id: string }[];
    const [real] = (await db.execute(
      sql`select id from patients where not cuenta_como_de_prueba and deleted_at is null order by id limit 1`,
    )) as unknown as { id: string }[];
    expect(dePrueba, "la base no tiene ningun paciente de prueba: el caso no mide nada").toBeDefined();
    expect(real, "la base no tiene ningun paciente real: el caso no mide nada").toBeDefined();

    const [cnvs] = (await db.execute(
      sql`select id from survey_instruments where codigo = 'CNV-S 1.0'`,
    )) as unknown as { id: string }[];
    expect(
      await instrumentoDeUnSeguimiento(dePrueba.id),
      "un paciente de prueba no recibe la CNV-S: el smoke en la nube no funcionaria",
    ).toBe(cnvs.id);
    expect(
      await instrumentoDeUnSeguimiento(real.id),
      "UN PACIENTE REAL RECIBIRIA LA CNV-S sin aprobacion de Gildardo",
    ).toBeNull();
  });

  it("y el enlace GENERICO del consultorio nunca sella la CNV-S, aunque acabe en seguimiento", async () => {
    // Con el enlace generico la cedula se escribe DESPUES de pintar la pagina, que trajo la encuesta
    // completa. Si el sello mirara el tipo de la CONSULTA que sale, la respuesta quedaria etiquetada con
    // un instrumento que nunca se mostro. Mira el tipo del ENLACE, que es lo que la pantalla sabia.
    const { instrumentoDelEnlace } = await import(
      "@/modules/evaluations/data/instrumento-de-la-consulta"
    );
    const [dePrueba] = (await db.execute(
      sql`select id from patients where cuenta_como_de_prueba order by id limit 1`,
    )) as unknown as { id: string }[];
    expect(
      await instrumentoDelEnlace({ type: "inicial", patientId: null }),
      "el enlace generico sello un instrumento que la pagina no pinto",
    ).toBeNull();
    // Y el enlace de SEGUIMIENTO del mismo paciente si, porque ahi la pagina si lo sabia.
    expect(await instrumentoDelEnlace({ type: "seguimiento", patientId: dePrueba.id })).not.toBeNull();
  });

  it("y todo instrumento tiene items: uno vacio deja la encuesta del paciente en blanco", async () => {
    const vacios = (await db.execute(sql`
      select s.codigo
        from survey_instruments s
       where not exists (select 1 from survey_instrument_items i where i.instrument_id = s.id)
    `)) as unknown as { codigo: string }[];
    expect(vacios.map((v) => v.codigo)).toEqual([]);
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // EL S1 PREGUNTA POR **TODOS** LOS PRODUCTOS INDICADOS  ·  defecto del smoke, 2026-11-09
  //
  // ═══ EL CASO ═══
  //
  // Santiago hizo el smoke y el S1 solo trajo MULTI-CELL BASE, cuando la consulta anterior tenia DOS
  // nutraceuticos indicados en el mismo tratamiento (el otro era OMEGA COMPLEX). La causa: el lector
  // filtraba el tratamiento vigente con `f.treatmentCreatedAt === masReciente`, y `===` entre dos `Date`
  // compara LA REFERENCIA. Dos filas del mismo tratamiento traen dos objetos `Date` distintos que valen
  // lo mismo, asi que solo pasaba la fila 0.
  //
  // ═══ POR QUE ESTE CASO Y NO UNA CIFRA ═══
  //
  // No se afirma "son dos": se comprueba la INVARIANCIA contra la base, consulta por consulta. El lector
  // tiene que devolver tantos productos como filas DISTINTAS tenga el tratamiento vigente de esa
  // consulta. Una cifra absoluta envejece y acaba fallando por otra razon; esta propiedad vale con los
  // datos de hoy y con los de dentro de un año.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("el S1 trae TODOS los nutraceuticos del tratamiento vigente, no solo el primero", async () => {
    const { nutraceuticosIndicadosEn } = await import(
      "@/modules/followups/data/nutraceuticos-de-la-anterior-reader"
    );
    // El tratamiento VIGENTE de cada consulta diagnosticada (el ultimo, que es la regla de la casa) y
    // cuantos productos DISTINTOS lleva.
    const casos = (await db.execute(sql`
      with vigente as (
        select d.evaluation_id,
               (select t.id from treatments t where t.diagnosis_id = d.id
                 order by t.created_at desc, t.id desc limit 1) as treatment_id
          from diagnoses d
      )
      select v.evaluation_id, count(distinct tn.nutraceutical_id)::int as productos
        from vigente v
        join treatment_nutraceuticals tn on tn.treatment_id = v.treatment_id
       group by v.evaluation_id
       order by count(distinct tn.nutraceutical_id) desc, v.evaluation_id
       limit 20
    `)) as unknown as { evaluation_id: string; productos: number }[];

    expect(casos.length, "la base no tiene ninguna consulta con nutraceuticos indicados").toBeGreaterThan(0);
    // Y QUE HAYA AL MENOS UNA CON DOS O MAS, o el caso pasaria sin ejercer el defecto. Si algun dia no la
    // hay, este caso cae y hay que sembrarla, no borrarlo: es el unico que mira la pluralidad.
    expect(casos[0].productos, "ninguna consulta indica dos productos: el caso no prueba nada").toBeGreaterThan(1);

    for (const caso of casos) {
      const leidos = await nutraceuticosIndicadosEn(caso.evaluation_id);
      expect(
        leidos.length,
        `la consulta ${caso.evaluation_id} indica ${caso.productos} productos y el S1 presentaria ${leidos.length}`,
      ).toBe(caso.productos);
      // Y SIN REPETIDOS: dos filas con la misma clave se pisarian al guardar la respuesta.
      expect(new Set(leidos.map((l) => l.id)).size).toBe(leidos.length);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // LOS DOS ROTULOS QUE EL PACIENTE LEE (0246, Santiago 2026-11-09)
  //
  // *"«Modulo S» pasa a «Seguimiento» y «Confirmación». Solo el rotulo: los field_key y el instrumento no
  // cambian."* Las dos mitades se comprueban: la que cambia Y la que NO. Un cambio de rotulo que se lleve
  // por delante un `field_key` rompe el diagnostico en silencio, porque el motor resuelve por clave.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("las secciones de la CNV-S se llaman como las lee el paciente, y las claves no se movieron", async () => {
    const { getActiveSurvey } = await import("@/modules/evaluations/data/survey-reader");
    const cnvs = await getActiveSurvey("CNV-S 1.0");
    const secciones = [...new Set((cnvs?.questions ?? []).map((q) => q.section))];
    expect(secciones.slice(0, 2), "el orden de su anexo A se perdio").toEqual([
      "Seguimiento",
      "Confirmación",
    ]);
    expect(secciones[secciones.length - 1]).toBe("Cierre");
    expect(secciones, "quedo un rotulo interno en la pantalla del paciente").not.toContain("Módulo S");
    expect(secciones).not.toContain("Confirmar");
    // LAS CLAVES, INTACTAS: son las que resuelven el Modulo S en todos los lectores.
    const claves = (cnvs?.questions ?? []).map((q) => q.fieldKey).filter((k) => k?.startsWith("cnvs"));
    expect(claves.sort()).toEqual([
      "cnvs_gi_filtro",
      "cnvs_s1",
      "cnvs_s2",
      "cnvs_s3",
      "cnvs_s4",
      "cnvs_s5",
      "cnvs_s6",
    ]);
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // Y NINGUNA DE LAS SIETE DEL MODULO S ALIMENTA EL DIAGNOSTICO  ·  lo que Santiago pidio verificar
  //
  // Su 3e: *"confirma que las respuestas del modulo de seguimiento NO alimentan el DFI (solo la tarjeta
  // de respuesta, la no comparabilidad y la investigacion)"*.
  //
  // SON DOS CANDADOS EN UNO, y el segundo es el que de verdad cierra: aunque alguien marcara una de las
  // siete como `used_in_diagnosis`, el motor no la veria, porque `expectedFieldKeys` sale de las
  // preguntas de la VERSION SELLADA en la respuesta, que es la del cuestionario, y el Modulo S vive en su
  // propia version. Asi que se comprueba la bandera Y la separacion de versiones.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("ninguna pregunta del Modulo S alimenta el diagnostico, ni por bandera ni por version", async () => {
    const filas = (await db.execute(sql`
      select q.field_key, q.used_in_diagnosis, q.survey_version_id
        from survey_questions q
       where q.field_key like 'cnvs%'
    `)) as unknown as { field_key: string; used_in_diagnosis: boolean; survey_version_id: string }[];
    expect(filas.length, "no estan las siete del Modulo S").toBe(7);
    expect(
      filas.filter((f) => f.used_in_diagnosis).map((f) => f.field_key),
      "una pregunta del Modulo S entro al diagnostico",
    ).toEqual([]);

    // Y VIVEN TODAS EN SU PROPIA VERSION, que es la que la respuesta NO sella.
    const versiones = [...new Set(filas.map((f) => f.survey_version_id))];
    expect(versiones.length, "el Modulo S se repartio entre dos versiones").toBe(1);
    const { getActiveSurvey } = await import("@/modules/evaluations/data/survey-reader");
    const cnvs = await getActiveSurvey("CNV-S 1.0");
    expect(
      cnvs?.surveyVersionId,
      "la CNV-S sellaria la version del Modulo S: el diagnostico creeria que la encuesta tiene siete campos",
    ).not.toBe(versiones[0]);
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // "LA ANTERIOR" ES ANTERIOR EN EL TIEMPO  ·  medido el 2026-11-09
  //
  // El lector de los insumos de la CNV-S elegia "la ultima consulta vigente del paciente que no sea
  // esta". Mientras solo lo llamaba la creacion del shell daba lo correcto (entonces la de hoy ES la
  // ultima), pero ahora lo llaman tambien las pantallas del profesional sobre una consulta ya guardada,
  // para resolver el nombre de los productos del S1. Medido en la nube: la consulta de las 10:43 tenia
  // como "anterior" la de las 11:54 del dia siguiente.
  //
  // ESTE CASO LO COMPRUEBA SOBRE TODOS LOS PACIENTES CON DOS O MAS CONSULTAS VIGENTES, y lo hace por la
  // propiedad y no por un caso: para cada consulta, la que el lector elige tiene que ser mas vieja. Es
  // la misma regla que `corte-de-la-serie` aplica a los graficos.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("la consulta anterior de los insumos de la CNV-S nunca es posterior", async () => {
    const { consultaAnteriorVigente } = await import(
      "@/modules/evaluations/data/insumos-de-la-cnvs"
    );
    const pares = (await db.execute(sql`
      select e.id, e.patient_id, e.created_at
        from evaluations e
       where e.superseded_at is null and e.retirada_at is null
         and e.patient_id in (
           select patient_id from evaluations
            where superseded_at is null and retirada_at is null
            group by patient_id having count(*) > 1
         )
       order by e.patient_id, e.created_at
       limit 60
    `)) as unknown as { id: string; patient_id: string; created_at: string }[];
    expect(pares.length, "la base no tiene ningun paciente con dos consultas vigentes").toBeGreaterThan(1);

    for (const ev of pares) {
      const anterior = await consultaAnteriorVigente({
        patientId: ev.patient_id,
        excluyendo: ev.id,
      });
      if (!anterior) continue; // la primera del paciente: no hay anterior, y eso es correcto
      const [fila] = (await db.execute(sql`
        select created_at from evaluations where id = ${anterior.id}::uuid`)) as unknown as {
        created_at: string;
      }[];
      expect(
        new Date(fila.created_at).getTime(),
        `la consulta ${ev.id} tiene como anterior una POSTERIOR (${anterior.id})`,
      ).toBeLessThan(new Date(ev.created_at).getTime());
    }
  });
});
