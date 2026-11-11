import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// NINGUN LECTOR SECUNDARIO TUMBA /ani-bis-e  ·  EL CANDADO DEL INCIDENTE DEL 2026-11-09
//
// ═══ QUE PASO ═══
//
// La pagina de la consulta dejo de abrir PARA TODOS LOS PACIENTES, en todas las pestanas. Diez eventos
// en Sentry, escalando, no manejados: *"serie-reader: modulo S: canceling statement due to statement
// timeout"*. La causa inmediata era una consulta lenta (ver `serie-reader.ts`, que la cuenta entera);
// la causa de que un dato secundario pudiera dejar sin consulta a una clinica es ESTA: el lector estaba
// en el `Promise.all` de la pagina a pelo, y un rechazo ahi tumba la pagina completa.
//
// LA DISTINCION QUE ESTE CANDADO FIJA: un lector de CONTENIDO puede lanzar (sin el no hay nada que
// ensenar, y un relleno silencioso afirmaria sobre un paciente algo que nadie midio); un lector
// SECUNDARIO (un aviso, un panel de calidad, una visual de una pestana) no puede, porque convierte su
// propio fallo en un freno sobre todos los pacientes. La pagina ya tenia cinco `catch` escritos con ese
// criterio; lo que no habia era nada que lo exigiera al añadir el sexto.
//
// ═══ POR QUE LA SUITE NO LO VIO, QUE NO ES QUE LA BASE LOCAL SEA CHICA ═══
//
// La base local tiene 176.724 `survey_answers` contra las 41.858 de la nube: CUATRO VECES MAS. Lo que
// no tiene es RLS: **la suite se conecta como dueno de la base (`DATABASE_URL`), y a ese rol las
// politicas no se le aplican**. El tiempo lo gastaba la politica de `survey_answers`, que por cada fila
// salta a `survey_responses`, de ahi a `evaluations` y de ahi llama a `is_patient_professional`. Con el
// dueno, o con el service_role, esa politica NO CORRE: la misma consulta que en produccion se pasaba
// del limite tardaba 408 ms.
//
// Y SE PUDO REPRODUCIR, que es como se midio el arreglo: iniciando sesion como un profesional de verdad
// contra la base local, la forma vieja da **timeout a los 8.092 ms, con el mensaje exacto de Sentry**, y
// la nueva 24 ms. La leccion para la proxima medicion: **medir con sesion, no con service_role**, o se
// esta midiendo otra consulta.
//
// POR ESO ESTE CANDADO ES ESTATICO y no una prueba contra la base: lo que hay que fijar no es el tiempo
// (que depende de los datos y del rol), es la FORMA. Un lector secundario sin `catch` es el defecto,
// con base rapida o lenta.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const PAGINA = "src/app/(app)/ani-bis-e/[id]/page.tsx";

/**
 * LOS LECTORES QUE PUEDEN LANZAR, uno por uno y por decision.
 *
 * Que esten aqui NO es un permiso general: es la afirmacion de que esa lectura ES el contenido de la
 * pagina, asi que sin ella no hay consulta que ensenar y un valor de reemplazo seria peor que el error
 * (diria "no hay diagnostico", "no hay tratamiento", "no se vendio nada" sobre un paciente del que no
 * se pudo leer nada). Si falla una de estas, la pagina cae CON SU ERROR, que es lo correcto.
 *
 * QUIEN AÑADA UN LECTOR A LA PAGINA lo encuentra fuera de esta lista y esta prueba falla. Entonces hay
 * dos caminos, y los dos son explicitos: envolverlo en `catch` (si es un aviso, un panel o una visual)
 * o escribirlo aqui diciendo por que es contenido.
 */
const LECTORES_QUE_PUEDEN_LANZAR = new Set([
  // ── La sesion y la identidad de la consulta: sin esto no hay pagina, literalmente ──
  "requireUser",
  "getEvaluationResults",
  "getEvaluationHeaderForSession",
  "getSupersessionStatus",
  "getCorrectionAvailability",
  "elQueMiraEsProfesionalDePrueba",
  // ── El diagnostico y su insumo clinico ──
  "getCompositionForEvaluation",
  "getDiagnosisCriterion",
  "getEfrStatesForModel",
  "getReportCardForEvaluation",
  "getFollowupComparison",
  "getBisImportEvaluationForId",
  "getBisIntakeForEvaluation",
  "getBisConditionsReadonly",
  "getActiveBisConditionCatalog",
  "getEvaluationPatientSex",
  // ── La encuesta, el consentimiento y la caracterizacion (las tres son dato del paciente) ──
  "getSurveyAnswersForEvaluation",
  "getConsentStatusForEvaluation",
  "getPatientConsents",
  "getEvaluationCharacterization",
  "getPatientProfileHasCharacterization",
  // ── El tratamiento, la prescripcion y lo que se le vendio ──
  "getTreatmentProtocol",
  "getPrescripcionNutricional",
  "getProtKgPrescrito",
  "getAsesoriaMacros",
  "getPlanPaciente",
  "listVentasDeTratamiento",
  "listReferralsForTreatment",
  "disponibleParaVender",
  "disponibleEnCentral",
  // ── Los documentos (HC, informe, emisiones): son probatorios, no se rellenan ──
  "getHcHeaderForEvaluation",
  "getInformeDelPaciente",
  "getUltimaEntregaHc",
  "listEmisiones",
  "getResumenProfesionForEvaluation",
  "getActorProfession",
  // ── La identidad dudosa: callar un duplicado es justo lo que la pantalla existe para evitar ──
  "getPendingIdentityCheck",
  "findDuplicatesForPatient",
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // LAS TRES QUE ESTABAN AQUI YA NO ESTAN (2026-11-11), y el motivo es el apagon del dia 10.
  //
  // El 9 de noviembre quedaron declaradas con su razon: les tocaba `catch`, pero faltaba decidir que
  // dice la pantalla al fallar, *"y eso no se improvisa el dia de un incidente"*. Al dia siguiente hubo
  // el incidente: 25 eventos no manejados tumbando la consulta de pacientes reales, y una de las tres
  // (`getProximoControl`) era uno de los nueve lectores con la forma lenta.
  //
  // La decision quedo al reves de como se planteo: la pregunta no era "que dice la pantalla si falla",
  // era "que pasa con todos los pacientes mientras lo decidimos". Las tres van con `catch`. Lo que
  // sigue abierto, y esta en PENDIENTES, es que fallan EN SILENCIO: sin bandera en pantalla como la
  // que si tiene la serie de seguimiento.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
]);

/** Los que HOY estan envueltos y tienen que seguir estandolo: son avisos, paneles o visuales. */
const LECTORES_CON_CATCH = [
  "contextoDeLaCnvsDeLaConsulta",
  "huellaRepetidaDeLaConsulta",
  "edadDiscordanteDeLaConsulta",
  "qcBiologicoDeLaConsulta",
  "motivoDeNoRecalcularLaConsulta",
  "lasDosLecturasDeEnvejecimiento",
  "getSerieSeguimiento",
  // Las tres del apagon del 2026-11-10 (ver la nota de arriba).
  "getTrajectoryNotice",
  "getPendingReferralHints",
  "getProximoControl",
];

/** Quita comentarios para que un ejemplo escrito en una nota no cuente como codigo. */
function sinComentarios(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * Las lecturas de la pagina: toda llamada `await x(...)` y todo elemento de un `Promise.all([...])`,
 * con si la llamada lleva `.catch(` pegado.
 *
 * SE MIRAN LAS DOS FORMAS porque la pagina usa las dos, y el incidente vino de la segunda: dentro de un
 * `Promise.all` la llamada no lleva `await` delante, asi que buscar solo `await` la habria dejado pasar.
 */
function lecturasDeLaPagina(fuente: string): Map<string, boolean> {
  const s = sinComentarios(fuente);
  const salida = new Map<string, boolean>();
  const anota = (nombre: string, conCatch: boolean) => {
    // Un lector llamado en dos sitios solo esta a salvo si lo esta en TODOS.
    salida.set(nombre, (salida.get(nombre) ?? true) && conCatch);
  };

  const re = /\b([a-zA-Z_$][\w$]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (!/await\s*$/.test(s.slice(Math.max(0, m.index - 7), m.index))) continue;
    let i = re.lastIndex;
    let prof = 1;
    while (i < s.length && prof > 0) {
      const c = s[i];
      if (c === "(") prof++;
      else if (c === ")") prof--;
      i++;
    }
    anota(m[1], /^\s*\.catch\b/.test(s.slice(i, i + 12)));
  }

  for (const bloque of s.matchAll(/await Promise\.all\(\[/g)) {
    let i = (bloque.index ?? 0) + bloque[0].length;
    const ini = i;
    let prof = 1;
    while (i < s.length && prof > 0) {
      const c = s[i];
      if (c === "[") prof++;
      else if (c === "]") prof--;
      i++;
    }
    const cuerpo = s.slice(ini, i - 1);
    let nivel = 0;
    let parte = "";
    const partes: string[] = [];
    for (const c of cuerpo) {
      if ("([{".includes(c)) nivel++;
      if (")]}".includes(c)) nivel--;
      if (c === "," && nivel === 0) {
        partes.push(parte);
        parte = "";
      } else parte += c;
    }
    partes.push(parte);
    for (const p of partes) {
      const t = p.trim();
      const mm = /\b([a-zA-Z_$][\w$]*)\s*\(/.exec(t);
      if (!t || !mm) continue;
      anota(mm[1], /\.catch\s*\(/.test(t));
    }
  }
  return salida;
}

describe("ningun lector secundario tumba la pagina de la consulta", () => {
  const fuente = readFileSync(PAGINA, "utf8");

  it("la pagina se puede leer y tiene lecturas que mirar", () => {
    const lecturas = lecturasDeLaPagina(fuente);
    // Si el escaneo deja de encontrar lecturas (porque la pagina se reescribio de otra forma), esta
    // prueba pasaria vacia y seria peor que no tenerla.
    expect(lecturas.size, "el escaneo no encontro ninguna lectura: la prueba quedaria vacia").toBeGreaterThan(30);
  });

  it("todo lector sin `catch` esta en la lista de los que pueden lanzar", () => {
    const sinRed: string[] = [];
    for (const [nombre, conCatch] of lecturasDeLaPagina(fuente)) {
      if (!conCatch && !LECTORES_QUE_PUEDEN_LANZAR.has(nombre)) sinRed.push(nombre);
    }
    expect(
      sinRed,
      "estos lectores lanzan ante un error de base y tumbarian /ani-bis-e entera. Envuelvelos en " +
        "`.catch(` (si son un aviso, un panel o una visual) o anadelos a LECTORES_QUE_PUEDEN_LANZAR " +
        "diciendo por que son contenido de la pagina",
    ).toEqual([]);
  });

  it("los seis lectores secundarios de hoy siguen envueltos", () => {
    const lecturas = lecturasDeLaPagina(fuente);
    for (const nombre of LECTORES_CON_CATCH) {
      expect(lecturas.has(nombre), `${nombre} ya no se lee en la pagina: revisa esta lista`).toBe(true);
      expect(lecturas.get(nombre), `${nombre} perdio su \`catch\` y volveria a tumbar la consulta`).toBe(true);
    }
  });

  it("la lista no acumula nombres que ya nadie llama", () => {
    const lecturas = lecturasDeLaPagina(fuente);
    const sobrantes = [...LECTORES_QUE_PUEDEN_LANZAR].filter((n) => !lecturas.has(n));
    expect(sobrantes, "estan en la lista y la pagina ya no los llama: la lista es la que se audita").toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// Y LA FORMA QUE LO CAUSO: UNA CONSULTA FILTRADA **SOLO** POR COLUMNAS DE UN EMBEBIDO
//
// `.in("survey_responses.evaluation_id", ...)` y `.in("survey_questions.field_key", ...)` filtran los
// EMBEBIDOS, no la tabla pedida. Sin ningun filtro sobre sus propias columnas, Postgres recorre la tabla
// entera y evalua en CADA fila la politica de RLS, que en las tablas clinicas es un `exists` con dos
// saltos. Es la forma la que no escala: con `survey_answers` reventó a las 41.858 filas.
//
// ═══ Y EL 10 DE NOVIEMBRE PASO, UN DIA Y MEDIO DESPUES ═══
//
// El 9 de noviembre esta nota decia que los otros sitios con esta forma pegaban contra `treatments`
// (389 filas, 154 ms con sesion de profesional) y que **no eran un incidente TODAVIA**, pero que el
// coste crece con la TABLA y no con el resultado. Al dia siguiente `GET /ani-bis-e/[id]` se cayo con
// pacientes reales: 25 eventos NO MANEJADOS de `treatment-reader: treatments: canceling statement due
// to statement timeout`, mas 9 del lector del protocolo sellado.
//
// LA LECCION, QUE ES LA QUE VALE: una forma que no escala no se deja medida y nombrada, se arregla. La
// cifra del dia (154 ms) invitaba a esperar; la propiedad (O(tabla) en cada carga de pagina) decia que
// no habia que esperar. **Cuando las dos no dicen lo mismo, manda la propiedad.**
//
// LOS NUEVE SITIOS QUEDARON ARREGLADOS con la receta del 9 de noviembre (primero los ids por la columna
// indexada, despues la tabla por SU propia columna indexada: ver `diagnosticos-de-la-consulta`). Medido
// con sesion de profesional sobre 391 tratamientos: la forma vieja 182 ms y 171 ms, la nueva 42 ms y 27
// ms, y lo que importa es que la nueva lee UNA fila en vez de recorrer la tabla.
//
// ASI QUE LA LISTA DE ABAJO QUEDO VACIA DE CODIGO DE PRODUCCION, y eso es el candado: cualquier sitio
// nuevo con esta forma hace fallar la prueba.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const FILTROS = ["eq", "neq", "in", "gt", "gte", "lt", "lte", "like", "ilike", "is", "contains", "overlaps"];

/**
 * LO QUE QUEDA CON ESTA FORMA: un solo test, y a proposito.
 *
 * `las-columnas-de-las-consultas-existen` comprueba que las COLUMNAS que piden los lectores existen en
 * la base, asi que tiene que pedirlas como las pedia el lector. No es una consulta de produccion y no
 * corre en ninguna carga de pagina.
 *
 * NADA MAS ENTRA AQUI SIN MEDIRLO **CON SESION DE PROFESIONAL** (no con service_role, que no aplica la
 * RLS y por eso no ve el coste), y sin la propiedad escrita: cuantas filas lee la consulta cuando la
 * tabla crece.
 */
const FILTRO_SOLO_EMBEBIDO_CONOCIDOS = new Set([
  "src/tests/las-columnas-de-las-consultas-existen.test.ts",
]);

function fuentes(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) fuentes(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p.split("\\").join("/"));
  }
  return out;
}

describe("ninguna consulta nueva se filtra solo por un embebido", () => {
  it("los sitios con esa forma son los ya medidos, y ninguno mas", () => {
    const nuevos: string[] = [];
    for (const f of fuentes("src")) {
      const s = sinComentarios(readFileSync(f, "utf8"));
      for (const desde of s.matchAll(/\.from\(\s*"([a-z_]+)"\s*\)/g)) {
        const fin = s.indexOf(";", desde.index ?? 0);
        if (fin < 0) continue;
        const cadena = s.slice(desde.index ?? 0, fin);
        const claves: string[] = [];
        for (const op of FILTROS) {
          for (const m of cadena.matchAll(new RegExp("\\." + op + '\\(\\s*"([^"]+)"', "g"))) claves.push(m[1]);
        }
        if (claves.length === 0) continue;
        if (!claves.every((k) => k.includes("."))) continue;
        if (FILTRO_SOLO_EMBEBIDO_CONOCIDOS.has(f)) continue;
        nuevos.push(`${f} · ${desde[1]} · filtros: ${claves.join(", ")}`);
      }
    }
    expect(
      nuevos,
      "esta consulta filtra SOLO columnas de un embebido, que es la forma que tumbo /ani-bis-e el " +
        "2026-11-09: la RLS se evalua sobre la tabla entera. Filtra tambien por una columna propia e " +
        "indexada, o mide el tiempo CON SESION DE PROFESIONAL (no con service_role) y anadela a la lista",
    ).toEqual([]);
  });

  // Los nueve del apagon del 10 de noviembre: ninguno vuelve a pedir la tabla por el embebido, y todos
  // pasan por la unica definicion de "los diagnosticos de esta consulta".
  it("los nueve lectores del tratamiento pasan por la columna indexada", () => {
    const FUENTES = [
      "src/modules/treatment/data/treatment-reader.ts",
      "src/modules/diagnoses/data/diagnosis-notes-reader.ts",
      "src/modules/followups/data/proximo-control-reader.ts",
      "src/modules/reports/data/hc-header-reader.ts",
      "src/modules/reports/data/informe-paciente-reader.ts",
      "src/modules/reports/data/reports-repository.ts",
    ];
    for (const ruta of FUENTES) {
      const src = sinComentarios(readFileSync(ruta, "utf8"));
      expect(src, `${ruta} ya no resuelve los diagnosticos por la unica definicion`).toContain(
        "idsDeLosDiagnosticos(supabase,",
      );
      expect(src, `${ruta} volvio a filtrar por el embebido`).not.toContain(
        '.eq("diagnoses.evaluation_id"',
      );
      expect(src, `${ruta} volvio a traer el embebido que obliga al recorrido`).not.toContain(
        "diagnoses!inner(evaluation_id)",
      );
    }
  });

  it("la consulta del Modulo S ya no tiene esa forma", () => {
    const s = readFileSync("src/modules/followups/data/serie-reader.ts", "utf8");
    expect(s).not.toContain('.in("survey_questions.field_key"');
    expect(s).not.toContain('.in("survey_responses.evaluation_id"');
    // Y no lanza: el fallo se reporta y se dice.
    expect(s).not.toContain("throw new Error(`serie-reader: modulo S");
    expect(s).toContain('reportServerError("seguimiento.modulo-s"');
  });
});
