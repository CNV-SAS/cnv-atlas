import "server-only";

import { BIODY_COLUMNS } from "@/clinical-engine/edge/biody-columns";
import { normalizeHeader } from "@/modules/bis/services/header-map";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  evaluations: { superseded_at: string | null; bis_measurements: { measurement_date: string | null }[] } | null;
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
  if (!patientId) return { puntos: [], omitidas: 0, refC: null };
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
      "id, evaluation_id, created_at, snapshot, evaluations!inner(superseded_at, bis_measurements(measurement_date))",
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
  for (const row of (data ?? []) as unknown as (Fila & { evaluation_id: string })[]) {
    if (vistas.has(row.evaluation_id)) continue;
    vistas.add(row.evaluation_id);
    const ev = row.evaluations;
    // Una evaluacion REEMPLAZADA por una correccion no es un punto de la trayectoria: comparariamos
    // contra el yo pre-correccion del paciente (misma regla que ya aplica comparison-chronology).
    if (!ev || ev.superseded_at != null) continue;
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

  // EL MODULO S DE CADA PUNTO (su §3): es el segundo eje de la tabla 6 de la tarjeta de respuesta.
  if (puntos.length > 0) {
    const porEval = await moduloSPorConsulta(
      supabase,
      puntos.map((p2) => p2.evaluationId),
    );
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
  const conModuloS = enPantalla[enPantalla.length - 1];
  if (conModuloS?.moduloS) {
    const { productos } = await insumosDeLaCnvsDeLaConsulta(conModuloS.evaluationId);
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

  return { puntos: enPantalla, omitidas, refC };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL MODULO S DE CADA PUNTO  ·  el segundo eje de su tabla 6  ·  2026-11-09
//
// SE LEE EN UNA SOLA CONSULTA para los (como mucho) ocho puntos de la serie, y se filtra por las SIETE
// claves del Modulo S: traer la encuesta entera de ocho consultas para calcular una adherencia seria
// pedirle a la base medio millar de filas por pantalla.
//
// LA RESPUESTA VIGENTE DE CADA CONSULTA ES LA ULTIMA, que es la regla de la casa: una correccion escribe
// un `survey_responses` nuevo, y leer el viejo mostraria el dato PRE-correccion.
//
// Y SI UNA CONSULTA NO TIENE NINGUNA de las siete, su `moduloS` queda en `null`, que es lo que significa
// "esta consulta no aplico la CNV-S". No es lo mismo que un Modulo S con todo en blanco: con null la
// tarjeta no habla de adherencia; con el objeto vacio diria que la adherencia no se puede calcular, que
// es una afirmacion sobre una encuesta que nunca existio.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
async function moduloSPorConsulta(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  evaluationIds: string[],
): Promise<Map<string, Omit<ModuloSDelPunto, "nombresDeProductos">>> {
  const salida = new Map<string, Omit<ModuloSDelPunto, "nombresDeProductos">>();
  if (evaluationIds.length === 0) return salida;
  const { data, error } = await supabase
    .from("survey_answers")
    .select(
      "answer_value, survey_questions!inner(field_key), survey_responses!inner(id, evaluation_id, created_at)",
    )
    .in("survey_responses.evaluation_id", evaluationIds)
    .in("survey_questions.field_key", [...CLAVES_DEL_MODULO_S]);
  if (error) throw new Error(`serie-reader: modulo S: ${error.message}`);

  type Fila = {
    answer_value: string | null;
    survey_questions: { field_key: string | null } | { field_key: string | null }[];
    survey_responses:
      | { id: string; evaluation_id: string; created_at: string }
      | { id: string; evaluation_id: string; created_at: string }[];
  };
  // LA RESPUESTA VIGENTE DE CADA CONSULTA, primero: sin este paso una consulta corregida mezclaria las
  // respuestas de las dos versiones y la adherencia saldria de una mitad de cada una.
  const vigentePorEval = new Map<string, { id: string; created_at: string }>();
  const filas = ((data ?? []) as unknown as Fila[]).map((f) => ({
    valor: f.answer_value,
    clave: (Array.isArray(f.survey_questions) ? f.survey_questions[0] : f.survey_questions)?.field_key ?? null,
    resp: Array.isArray(f.survey_responses) ? f.survey_responses[0] : f.survey_responses,
  }));
  for (const f of filas) {
    if (!f.resp) continue;
    const actual = vigentePorEval.get(f.resp.evaluation_id);
    if (!actual || f.resp.created_at > actual.created_at) {
      vigentePorEval.set(f.resp.evaluation_id, { id: f.resp.id, created_at: f.resp.created_at });
    }
  }
  for (const f of filas) {
    if (!f.resp || !f.clave) continue;
    if (vigentePorEval.get(f.resp.evaluation_id)?.id !== f.resp.id) continue;
    const previo = salida.get(f.resp.evaluation_id) ?? {
      s1: null,
      s2: null,
      s3: null,
      s4: null,
      s5: null,
      s6: null,
    };
    if (f.clave === "cnvs_s1") previo.s1 = parsePorProducto(f.valor);
    else if (f.clave === "cnvs_s2") previo.s2 = parsePorProducto(f.valor);
    else if (f.clave === "cnvs_s3") previo.s3 = f.valor;
    else if (f.clave === "cnvs_s4") previo.s4 = valoresDeLaRespuesta(f.valor);
    else if (f.clave === "cnvs_s5") previo.s5 = f.valor;
    else if (f.clave === "cnvs_s6") previo.s6 = f.valor;
    salida.set(f.resp.evaluation_id, previo);
  }
  return salida;
}
