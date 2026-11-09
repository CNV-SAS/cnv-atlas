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
  // ESTAS TRES ESTAN AQUI POR AHORA, Y NO DEBERIAN (2026-11-09)
  //
  // Son un aviso, unas pistas y una tarjeta: por el criterio de arriba les toca `catch`, como a la
  // serie. Lo que falta no es el `catch`, es decidir QUE DICE la pantalla cuando no se pueden leer, y
  // eso no se improvisa el dia de un incidente: un `null` silencioso convierte "no se pudo leer" en
  // "no hay proximo control", que es una afirmacion sobre el paciente. Queda declarado aqui y no en un
  // comentario que nadie lee: es la lista por la que se pregunta.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  "getTrajectoryNotice",
  "getPendingReferralHints",
  "getProximoControl",
]);

/** Los que HOY estan envueltos y tienen que seguir estandolo: son avisos, paneles o visuales. */
const LECTORES_CON_CATCH = [
  "huellaRepetidaDeLaConsulta",
  "edadDiscordanteDeLaConsulta",
  "qcBiologicoDeLaConsulta",
  "motivoDeNoRecalcularLaConsulta",
  "lasDosLecturasDeEnvejecimiento",
  "getSerieSeguimiento",
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
// LO MEDIDO HOY, para no afirmar de mas: los otros siete sitios con esta forma pegan todos contra
// `treatments` (389 filas) o `diagnosis_notes` (7), y con sesion de profesional tardan 154 ms y 15 ms.
// No son un incidente HOY. Pero el coste crece con la tabla, no con el resultado: a 0,4 ms por fila,
// `treatments` llega al limite de 8 s sobre las 20.000 filas. Son el siguiente apagon, y hoy quedan
// MEDIDOS Y NOMBRADOS en vez de descubiertos.
//
// NO SE BARREN EN ESTE COMMIT a proposito: el commit es el de un incidente, y reescribir siete lectores
// de tratamiento y de documentos probatorios el mismo dia es como se mete el segundo defecto.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const FILTROS = ["eq", "neq", "in", "gt", "gte", "lt", "lte", "like", "ilike", "is", "contains", "overlaps"];

/** Los sitios con esta forma el 2026-11-09, ya medidos. Uno nuevo hay que medirlo antes de anadirlo. */
const FILTRO_SOLO_EMBEBIDO_CONOCIDOS = new Set([
  "src/modules/diagnoses/data/diagnosis-notes-reader.ts",
  "src/modules/followups/data/proximo-control-reader.ts",
  "src/modules/reports/data/hc-header-reader.ts",
  "src/modules/reports/data/informe-paciente-reader.ts",
  "src/modules/reports/data/reports-repository.ts",
  "src/modules/treatment/data/treatment-reader.ts",
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

  it("la consulta del Modulo S ya no tiene esa forma", () => {
    const s = readFileSync("src/modules/followups/data/serie-reader.ts", "utf8");
    expect(s).not.toContain('.in("survey_questions.field_key"');
    expect(s).not.toContain('.in("survey_responses.evaluation_id"');
    // Y no lanza: el fallo se reporta y se dice.
    expect(s).not.toContain("throw new Error(`serie-reader: modulo S");
    expect(s).toContain('reportServerError("seguimiento.modulo-s"');
  });
});
