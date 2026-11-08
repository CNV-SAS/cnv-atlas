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
    expect(secciones.slice(0, 2), "el orden de su anexo A se perdio").toEqual([
      "Módulo S",
      "Confirmar",
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
    const propias = (cnvs?.questions ?? []).filter((q) => q.section === "Módulo S");
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
});
