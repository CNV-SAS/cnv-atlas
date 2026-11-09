import "server-only";

import { BIODY_COLUMNS } from "@/clinical-engine/edge/biody-columns";
import { normalizeHeader } from "@/modules/bis/services/header-map";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportServerError } from "@/lib/observability/report-error";

import { capRef, clasificarCapacitancia } from "@/clinical-engine/capacitancia";
import { corteDeLaSerie, dentroDelCorte } from "../corte-de-la-serie";
import { edadEnFecha } from "@/lib/format/edad";

import {
  SERIE_MAX,
  type ModuloSDelPunto,
  type PuntoSerie,
  type RefCapacitancia,
  type SerieSeguimiento,
} from "./serie-types";
import { CLAVES_DEL_MODULO_S } from "../modulo-s";
import { parsePorProducto, valoresDeLaRespuesta } from "@/modules/evaluations/respuesta-en-texto";
import { insumosDeLaCnvsDeLaConsulta } from "@/modules/evaluations/data/insumos-de-la-cnvs";

export { SERIE_MAX };
export type { PuntoSerie, SerieSeguimiento };

// SERIE de seguimiento: las evaluaciones VIGENTES del paciente con su medición y su snapshot, en orden
// cronológico, HASTA la evaluación desde la que se mira. Alimenta los gráficos de tendencia y el radar.
//
// EL TECHO NO ES UN DETALLE (Santiago, 2026-09-20): sin él, abrir la evaluación inicial mostraba el mismo
// radar que la de seguimiento, porque pintaba consultas que ese día no habían ocurrido. Ver
// `corte-de-la-serie.ts`.
//
type Fila = {
  id: string;
  snapshot: unknown;
  evaluations: {
    superseded_at: string | null;
    /** El instrumento SELLADO en esa consulta. `null` = la linea base (ver el gate del Modulo S). */
    survey_instrument_id: string | null;
    bis_measurements: { measurement_date: string | null }[];
  } | null;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function getSerieSeguimiento(evaluationId: string): Promise<SerieSeguimiento> {
  const supabase = await createSupabaseServerClient();
  // El paciente sale de la propia evaluacion: la pagina no tiene que cargarlo aparte, y la RLS ya limita
  // el alcance (si la evaluacion no es del profesional, no hay fila y la serie sale vacia).
  const { data: ev } = await supabase
    .from("evaluations")
    .select("patient_id, created_at, bis_measurements(measurement_date)")
    .eq("id", evaluationId)
    .maybeSingle();
  const patientId = ev?.patient_id as string | undefined;
  if (!patientId) return { puntos: [], omitidas: 0, refC: null, serieIlegible: false, moduloSIlegible: false };
  // HASTA DONDE LLEGA ESTA EVALUACION. Sin este techo, la pestaña Seguimiento de una evaluacion vieja
  // pintaba las consultas POSTERIORES, que el dia que se selló no existían. Ver `corte-de-la-serie.ts`.
  const corte = corteDeLaSerie(
    ((ev as { bis_measurements?: { measurement_date: string | null }[] }).bis_measurements ?? []).map(
      (m) => m.measurement_date,
    ),
    (ev as { created_at: string }).created_at,
  );
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, evaluation_id, created_at, snapshot, evaluations!inner(superseded_at, survey_instrument_id, bis_measurements(measurement_date))",
    )
    .eq("patient_id", patientId)
    .eq("type", "paciente")
    // Mas reciente primero: de cada evaluacion se queda el PRIMERO que se vea (ver el dedupe abajo).
    .order("created_at", { ascending: false });
  if (error) throw new Error(`serie-reader: ${error.message}`);

  const puntos: PuntoSerie[] = [];
  // ═══ UN PUNTO POR EVALUACION, NO POR REPORTE (2026-09-19) ═══
  //
  // EL DEFECTO QUE CIERRA, reportado por Santiago: en las tres graficas salian TRES puntos el mismo dia
  // donde solo habia UNA evaluacion. La serie recorria los REPORTES, y una evaluacion puede tener varios:
  // regenerar el diagnostico crea otro, y desde el 2026-09-19 tambien lo hace emitir una version nueva del
  // informe. Cada uno se convertia en un punto de la trayectoria, en la misma fecha.
  //
  // NO ES COSMETICO: la trayectoria es lo que el profesional lee para decidir si el paciente mejora, y una
  // grafica que pinta tres veces la misma medicion sugiere tres controles que no existieron.
  //
  // SE QUEDA EL MAS RECIENTE de cada evaluacion, que es el documento vigente (el mismo criterio que usan
  // la tarjeta del informe y el lector del tratamiento).
  const vistas = new Set<string>();
  // QUE CONSULTAS SELLARON UN INSTRUMENTO, para el gate del Modulo S de mas abajo. Sale de la fila que
  // ya se pidio: no cuesta una consulta mas.
  const conInstrumento = new Set<string>();
  for (const row of (data ?? []) as unknown as (Fila & { evaluation_id: string })[]) {
    if (vistas.has(row.evaluation_id)) continue;
    vistas.add(row.evaluation_id);
    const ev = row.evaluations;
    // Una evaluacion REEMPLAZADA por una correccion no es un punto de la trayectoria: comparariamos
    // contra el yo pre-correccion del paciente (misma regla que ya aplica comparison-chronology).
    if (!ev || ev.superseded_at != null) continue;
    if (ev.survey_instrument_id != null) conInstrumento.add(row.evaluation_id);
    const fechas = (ev.bis_measurements ?? []).map((m) => m.measurement_date).filter((d): d is string => d != null);
    if (fechas.length === 0) continue; // sin medicion no hay punto en el tiempo
    const fecha = fechas.reduce((max, d) => (d > max ? d : max), fechas[0]);
    // Lo posterior a esta evaluacion no es parte de SU trayectoria.
    if (!dentroDelCorte(fecha, corte)) continue;
    const snap = row.snapshot as {
      indicators?: Record<string, unknown>;
      dfi?: { domains?: unknown; riesgo?: { score?: unknown } | null };
      ebBis?: { estado?: string; eb?: unknown; iae?: unknown } | null;
      versions?: { engine?: unknown } | null;
    } | null;
    const ind = snap?.indicators ?? {};
    const dom = snap?.dfi?.domains;
    // LA EB-BIS SOLO SI EL SELLO LA TRAE EN ESTADO "ok", por la misma razon por la que el informe la
    // gatea asi: un sello anterior al 2026-10-29 lleva la v5 en `indicators.eb`, y esa es justo la cifra
    // que la decision de agosto no queria que el paciente viera. Tomarla "porque el campo trae un
    // numero" publicaria la cifra retirada y restaria entre dos escalas.
    const ebSellada =
      snap?.ebBis?.estado === "ok" && num(snap.ebBis.eb) !== null && num(snap.ebBis.iae) !== null
        ? { eb: num(snap.ebBis.eb) as number, iae: num(snap.ebBis.iae) as number }
        : null;
    const engineVersion = typeof snap?.versions?.engine === "string" ? snap.versions.engine : null;
    puntos.push({
      evaluationId: row.evaluation_id,
      fecha,
      // La capacitancia vive en el BIS CRUDO (no es salida del motor); se resuelve abajo.
      c: null,
      pabu: num(ind["pabu"]),
      icaBis: num(ind["icaBis"]),
      dominios: Array.isArray(dom)
        ? (dom as { id?: string; nombre?: string; sev?: number }[]).map((d) => ({
            id: String(d.id ?? ""),
            nombre: String(d.nombre ?? ""),
            sev: Number(d.sev ?? 0),
          }))
        : null,
      eb: ebSellada,
      // EL RIESGO INTEGRADO, del sello. Se lee con el mismo `num` que el resto: un campo ausente da null
      // y la tarjeta no compara, en vez de restar contra un cero que nadie midio.
      riesgoScore: num(snap?.dfi?.riesgo?.score),
      engineVersion,
      // Se resuelve despues, en una sola consulta para todos los puntos.
      moduloS: null,
    });
  }

  // Capacitancia de membrana: es el parametro de seguimiento del protocolo y NO es salida del motor, asi
  // que sale del crudo del equipo por su header de contrato.
  if (puntos.length > 0) {
    const headerC = normalizeHeader(BIODY_COLUMNS.C.header);
    const { data: crudos } = await supabase
      .from("bis_raw_values")
      .select("value, bis_measurements!inner(evaluation_id)")
      .eq("variable_name", headerC)
      .in(
        "bis_measurements.evaluation_id",
        puntos.map((p2) => p2.evaluationId),
      );
    const porEval = new Map<string, number>();
    for (const r of (crudos ?? []) as unknown as {
      value: string | number | null;
      bis_measurements: { evaluation_id: string } | { evaluation_id: string }[];
    }[]) {
      const m = Array.isArray(r.bis_measurements) ? r.bis_measurements[0] : r.bis_measurements;
      const v = Number(r.value);
      if (m?.evaluation_id && Number.isFinite(v)) porEval.set(m.evaluation_id, v);
    }
    for (const pt of puntos) pt.c = porEval.get(pt.evaluationId) ?? null;
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // EL MODULO S DE CADA PUNTO (su §3): es el segundo eje de la tabla 6 de la tarjeta de respuesta.
  //
  // ═══ SOLO SI ALGUNA CONSULTA SELLO UN INSTRUMENTO  ·  2026-11-09, tras el incidente ═══
  //
  // La CNV-S hoy solo se le aplica a pacientes de prueba, asi que en la inmensa mayoria de las
  // pantallas estas consultas no pueden encontrar nada. No preguntar es mejor que preguntar rapido.
  //
  // Y LA COMPROBACION NO CUESTA OTRA VUELTA A LA BASE: `survey_instrument_id` viaja en la misma fila
  // que la serie ya pide. La columna es NULL para la linea base POR CONSTRUCCION (ver
  // `idDelInstrumento`: devuelve null para `CNV v2.0`, porque el nulo dice la verdad, que nadie eligio
  // instrumento), asi que hoy 'no nula' y 'CNV-S 1.0' son el mismo conjunto.
  //
  // SE COMPARA CONTRA NULL Y NO CONTRA EL ID DE LA CNV-S a proposito: resolver ese id pediria la
  // consulta que este gate existe para evitar, y el peor caso de equivocarse es el bueno. Si algun dia
  // hay un tercer instrumento, lo que pasa es que la lectura SE HACE (lo de hoy), nunca que el Modulo S
  // se pierda.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  let moduloSIlegible = false;
  const conCnvs = puntos.filter((p2) => conInstrumento.has(p2.evaluationId));
  if (conCnvs.length > 0) {
    const { porEval, ilegible } = await moduloSPorConsulta(
      supabase,
      conCnvs.map((p2) => p2.evaluationId),
    );
    moduloSIlegible = ilegible;
    for (const pt of puntos) {
      const m = porEval.get(pt.evaluationId);
      if (m) pt.moduloS = { ...m, nombresDeProductos: {} };
    }
  }

  puntos.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const omitidas = Math.max(0, puntos.length - SERIE_MAX);
  const enPantalla = puntos.slice(-SERIE_MAX);

  // LA REFERENCIA DE CAPACITANCIA (porte del 2026-08-26 §9.1, cableado el 2026-09-01). El modulo estaba
  // portado con sus doce filas verbatim y su candado, y la tarjeta lo decia: "la referencia de su grupo
  // aun no se muestra aqui". Era una pieza terminada a la que le faltaba el ultimo cable.
  //
  // SE RESUELVE CON LA ULTIMA MEDICION, no con la primera: la decada de edad puede cambiar a lo largo del
  // seguimiento, y la comparacion que le importa al profesional es la de hoy.
  // LOS NOMBRES DE LOS PRODUCTOS, SOLO DEL ULTIMO PUNTO: es el unico cuyo S1 escribe la tarjeta, y
  // resolverlos para los ocho seria una vuelta a la base por consulta para texto que nadie lee.
  //
  // Y CON `catch`, POR LO MISMO QUE EL LECTOR DEL MODULO S: esto es TEXTO (el nombre comercial que va al
  // lado de la respuesta). Sin el, el S1 sale con el id del producto, que se lee mal pero se lee. Que un
  // rotulo tumbe la pantalla donde se trabaja no es una opcion.
  const conModuloS = enPantalla[enPantalla.length - 1];
  if (conModuloS?.moduloS) {
    const productos = await insumosDeLaCnvsDeLaConsulta(conModuloS.evaluationId)
      .then((i) => i.productos)
      .catch((e: unknown) => {
        reportServerError("seguimiento.nombres-de-productos", e);
        return [] as { id: string; nombre: string }[];
      });
    conModuloS.moduloS = {
      ...conModuloS.moduloS,
      nombresDeProductos: Object.fromEntries(productos.map((p2) => [p2.id, p2.nombre])),
    };
  }

  const ultimo = enPantalla[enPantalla.length - 1];
  let refC: RefCapacitancia | null = null;
  if (ultimo) {
    // El sexo y la fecha de nacimiento son PII y viven en `patient_profiles`, no en `patients`.
    const { data: pac } = await supabase
      .from("patient_profiles")
      .select("sex, birth_date")
      .eq("patient_id", patientId)
      .maybeSingle();
    const sexo = (pac?.sex as string | null) ?? null;
    const edad = edadEnFecha((pac?.birth_date as string | null) ?? null, ultimo.fecha);
    const r = capRef(sexo, edad);
    if (r) {
      const cl = clasificarCapacitancia(ultimo.c, sexo, edad);
      refC = {
        mediana: r.p50,
        p25: r.p25,
        p75: r.p75,
        n: r.n,
        valor: Number(ultimo.c),
        etiqueta: cl.l,
        banda: cl.banda,
        grupo: `${r.sexo === "M" ? "Hombres" : "Mujeres"} ${r.d[0]}-${r.d[1]}`,
      };
    }
  }

  return { puntos: enPantalla, omitidas, refC, serieIlegible: false, moduloSIlegible };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL MODULO S DE CADA PUNTO  ·  el segundo eje de su tabla 6
//
// ═══ EL INCIDENTE DEL 2026-11-09: ESTA FUNCION TUMBO /ani-bis-e ENTERA ═══
//
// Diez eventos en Sentry, escalando, no manejados: *"canceling statement due to statement timeout"*.
// Ninguna consulta de ningun paciente abria, en ninguna pestana, porque la serie se lee en el
// `Promise.all` de la pagina y un rechazo ahi tumba la pagina entera.
//
// ═══ POR QUE ERA LENTA: LA RLS, NO EL TAMANO ═══
//
// La consulta pedia `survey_answers` filtrando SOLO por columnas de sus dos embebidos
// (`survey_questions.field_key` y `survey_responses.evaluation_id`). Sobre la tabla propia no habia
// ningun filtro, asi que Postgres tenia que recorrerla entera y evaluar en CADA fila la politica de RLS
// de `survey_answers`, que no es un `true`: es un `exists` que salta a `survey_responses`, de ahi a
// `evaluations` y de ahi llama a `is_patient_professional`.
//
// MEDIDO, no deducido (2026-11-09):
//   · la forma vieja CON RLS, con una sesion de profesional de verdad: TIMEOUT A LOS 8.092 ms, con el
//     mismo mensaje que Sentry. La nueva, 24 ms (10 + 6 + 8). Es el defecto reproducido.
//   · la forma vieja con el service_role, o sea SIN RLS: 408 ms. La forma no cuesta; la RLS por fila si.
//
// Y DE AHI SALE POR QUE LAS PRUEBAS NO LO VIERON, que no es que la base local sea chica: tiene 176.724
// respuestas contra las 41.858 de la nube, cuatro veces mas. Es que LA SUITE SE CONECTA COMO DUENO DE LA
// BASE (`DATABASE_URL`) Y LA RLS NO SE LE APLICA, asi que la politica que cuesta el tiempo nunca corre.
// Lo mismo vale para cualquier medicion que se haga con el service_role.
//
// ═══ TRES CONSULTAS CORTAS EN VEZ DE UNA LARGA ═══
//
//   1. las `survey_responses` de esas consultas, por `evaluation_id` (indice `survey_responses_eval_idx`);
//   2. los ids de las SIETE preguntas del modulo, una vez (`survey_questions` es chica y su RLS es `true`);
//   3. las `survey_answers` por `response_id` + `question_id`, las dos columnas PROPIAS de la tabla y las
//      dos indexadas (`survey_answers_response_idx` y el unico `(response_id, question_id)`).
//
// Los tres indices ya existian, asi que no hace falta migracion.
//
// EL PASO 1 TAMBIEN RECORTA EL 3: la respuesta VIGENTE de cada consulta se resuelve antes de pedir una
// sola respuesta, asi que el `in` del paso 3 lleva como mucho ocho ids, uno por punto de la serie. Es la
// regla de la casa (una correccion escribe un `survey_responses` nuevo, y leer el viejo mostraria el dato
// PRE-correccion) y ademas mantiene la URL corta, que es otro fallo que ya nos costo.
//
// ═══ Y NO LANZA, PASE LO QUE PASE ═══
//
// El Modulo S es un dato SECUNDARIO de la serie: sin el, la tarjeta no puede decir la adherencia ni el
// escenario de la tabla 6, y todo lo demas de la pantalla sigue en pie. Un dato secundario que al fallar
// deja sin consulta a todos los pacientes no es un dato secundario, es un freno. Asi que el fallo se
// reporta a Sentry, se devuelve vacio y SE DICE (`moduloSIlegible`). Lo unico que no se puede hacer es
// callarlo y dejar que la pantalla afirme que no hubo encuesta de seguimiento.
//
// Y SI UNA CONSULTA NO TIENE NINGUNA de las siete, su `moduloS` queda en `null`, que es lo que significa
// "esta consulta no aplico la CNV-S". No es lo mismo que un Modulo S con todo en blanco: con null la
// tarjeta no habla de adherencia; con el objeto vacio diria que la adherencia no se puede calcular, que
// es una afirmacion sobre una encuesta que nunca existio.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
type ModuloSLeido = {
  porEval: Map<string, Omit<ModuloSDelPunto, "nombresDeProductos">>;
  /** La lectura fallo. `porEval` esta vacio por el fallo, no porque no hubiera nada. */
  ilegible: boolean;
};

async function moduloSPorConsulta(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  evaluationIds: string[],
): Promise<ModuloSLeido> {
  const porEval = new Map<string, Omit<ModuloSDelPunto, "nombresDeProductos">>();
  const vacio: ModuloSLeido = { porEval, ilegible: false };
  // Un area sola para los tres pasos, con el paso en el mensaje: en Sentry interesa agrupar por
  // "el Modulo S no se pudo leer" y poder ver dentro cual de las tres consultas fallo.
  const falla = (paso: string, mensaje: string): ModuloSLeido => {
    reportServerError("seguimiento.modulo-s", new Error(`serie-reader: modulo S: ${paso}: ${mensaje}`));
    return { porEval: new Map(), ilegible: true };
  };
  if (evaluationIds.length === 0) return vacio;

  // ── 1 · LAS RESPUESTAS DE ESAS CONSULTAS, y la VIGENTE de cada una ──────────────────────────────
  const { data: respuestas, error: eResp } = await supabase
    .from("survey_responses")
    .select("id, evaluation_id, created_at")
    .in("evaluation_id", evaluationIds);
  if (eResp) return falla("respuestas", eResp.message);
  const vigentePorEval = new Map<string, { id: string; createdAt: string }>();
  for (const r of (respuestas ?? []) as unknown as {
    id: string;
    evaluation_id: string;
    created_at: string;
  }[]) {
    const actual = vigentePorEval.get(r.evaluation_id);
    if (!actual || r.created_at > actual.createdAt) {
      vigentePorEval.set(r.evaluation_id, { id: r.id, createdAt: r.created_at });
    }
  }
  // El camino de vuelta: de la respuesta a su consulta. El paso 3 ya no trae el `evaluation_id`.
  const evalPorRespuesta = new Map<string, string>();
  for (const [evaluationId, v] of vigentePorEval) evalPorRespuesta.set(v.id, evaluationId);
  if (evalPorRespuesta.size === 0) return vacio;

  // ── 2 · LOS IDS DE LAS SIETE PREGUNTAS DEL MODULO ───────────────────────────────────────────────
  const { data: preguntas, error: ePreg } = await supabase
    .from("survey_questions")
    .select("id, field_key")
    .in("field_key", [...CLAVES_DEL_MODULO_S]);
  if (ePreg) return falla("preguntas", ePreg.message);
  const clavePorPregunta = new Map<string, string>();
  for (const q of (preguntas ?? []) as unknown as { id: string; field_key: string | null }[]) {
    if (q.field_key) clavePorPregunta.set(q.id, q.field_key);
  }
  // Una base sin las preguntas de la CNV-S no es un fallo: es una base anterior a 0240.
  if (clavePorPregunta.size === 0) return vacio;

  // ── 3 · LAS RESPUESTAS, POR LAS DOS COLUMNAS PROPIAS E INDEXADAS ────────────────────────────────
  const { data: filas, error: eAns } = await supabase
    .from("survey_answers")
    .select("response_id, question_id, answer_value")
    .in("response_id", [...evalPorRespuesta.keys()])
    .in("question_id", [...clavePorPregunta.keys()]);
  if (eAns) return falla("respuestas del modulo", eAns.message);

  for (const fila of (filas ?? []) as unknown as {
    response_id: string;
    question_id: string;
    answer_value: string | null;
  }[]) {
    const evaluationId = evalPorRespuesta.get(fila.response_id);
    const clave = clavePorPregunta.get(fila.question_id);
    if (!evaluationId || !clave) continue;
    const previo = porEval.get(evaluationId) ?? {
      s1: null,
      s2: null,
      s3: null,
      s4: null,
      s5: null,
      s6: null,
    };
    if (clave === "cnvs_s1") previo.s1 = parsePorProducto(fila.answer_value);
    else if (clave === "cnvs_s2") previo.s2 = parsePorProducto(fila.answer_value);
    else if (clave === "cnvs_s3") previo.s3 = fila.answer_value;
    else if (clave === "cnvs_s4") previo.s4 = valoresDeLaRespuesta(fila.answer_value);
    else if (clave === "cnvs_s5") previo.s5 = fila.answer_value;
    else if (clave === "cnvs_s6") previo.s6 = fila.answer_value;
    porEval.set(evaluationId, previo);
  }
  return { porEval, ilegible: false };
}
