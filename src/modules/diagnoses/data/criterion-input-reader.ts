import "server-only";

import { isEngineOutput, type EngineOutput } from "@/clinical-engine";
import { edadEnFecha } from "@/lib/format/edad";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CriterionPromptInput,
  RespuestaEncuesta,
} from "@/modules/diagnoses/ai/prompts/criterion.v2";

import { getCompositionForEvaluation } from "./composition-reader";
import { decimalesDe, indicatorBands } from "./indicator-ranges";

// ENSAMBLA EL INSUMO DEL BORRADOR DE CRITERIO desde las TRES fuentes que hacen falta para portar su paso
// 4 (punto 8 de su cotejo): el snapshot sellado, las respuestas de la encuesta y la composicion corporal.
//
// POR QUE HACEN FALTA TRES. El `EngineOutput` sellado NO lleva las respuestas de la encuesta ni los
// crudos de composicion: lleva indicadores, fenotipos y el DFI. Su prompt manda las tres cosas, asi que
// el porte tiene que leerlas donde viven.
//
// LA BARRERA PII NO ESTA AQUI, y es deliberado: este reader trae la encuesta ENTERA y el builder
// (`criterion.v2.ts`) lee solo las claves de su lista blanca. Si la barrera viviera aqui, habria que
// auditar dos sitios; asi el unico sitio donde se decide que viaja es el builder, en una lista que se lee
// de un vistazo.
//
// LO QUE ESTE READER NO PIDE: nombre, documento, correo, telefono, fecha de nacimiento, etnia ni
// ascendencia. No se leen y luego se filtran: no se leen.

/** Respuestas de la encuesta de una evaluacion, con el TEXTO DE LA PREGUNTA (no un rotulo nuestro). */
async function leerEncuesta(evaluationId: string): Promise<RespuestaEncuesta[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("survey_responses")
    .select("id, survey_answers(answer_value, survey_questions(field_key, question_text, order_index))")
    .eq("evaluation_id", evaluationId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`criterion-input-reader: encuesta: ${error.message}`);
  if (!data) return [];

  type Fila = {
    answer_value: string | null;
    survey_questions: { field_key: string | null; question_text: string; order_index: number } | null;
  };
  const filas = ((data as unknown as { survey_answers: Fila[] }).survey_answers ?? [])
    .filter((f) => f.survey_questions != null)
    .sort((a, b) => (a.survey_questions!.order_index ?? 0) - (b.survey_questions!.order_index ?? 0));

  return filas.map((f) => ({
    fieldKey: f.survey_questions!.field_key,
    pregunta: f.survey_questions!.question_text,
    // Las de opcion multiple viajan como JSON: se despliegan a texto legible, que es lo que el modelo
    // tiene que leer. Un `["Metformina"]` crudo le ensena nuestra serializacion, no la respuesta.
    valor: legible(f.answer_value),
  }));
}

function legible(v: string | null): string | null {
  if (v == null) return null;
  if (!v.startsWith("[")) return v;
  try {
    const arr: unknown = JSON.parse(v);
    return Array.isArray(arr) ? (arr.length ? arr.map(String).join(", ") : "Ninguno") : v;
  } catch {
    return v;
  }
}

/**
 * Sociodemograficos y la EDAD. Sin identificacion.
 *
 * LA EDAD SE CALCULA A LA FECHA DE LA CONSULTA, no a hoy: el borrador describe una evaluacion concreta y
 * releerlo un ano despues no puede cambiar la edad del paciente en ese acto. Misma regla que el resumen
 * de dieta.
 *
 * Y VIAJA LA EDAD, NUNCA LA FECHA DE NACIMIENTO: la edad es la variable clinica (el IAE se lee contra
 * ella); la fecha es identificacion. Por eso se resuelve aqui y la fecha no sale de esta funcion.
 */
async function leerContexto(evaluationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluations")
    .select(
      "created_at, occupation, marital_status, socioeconomic_stratum, patients!inner(patient_profiles!inner(birth_date))",
    )
    .eq("id", evaluationId)
    .maybeSingle();
  if (error) throw new Error(`criterion-input-reader: contexto: ${error.message}`);
  const one = <T,>(e: T | T[] | null | undefined): T | undefined =>
    Array.isArray(e) ? e[0] : (e ?? undefined);
  const perfil = one(
    one(data?.patients as { patient_profiles: unknown } | { patient_profiles: unknown }[] | null)
      ?.patient_profiles as { birth_date: string | null } | { birth_date: string | null }[] | null,
  );
  const edad =
    data?.created_at && perfil?.birth_date
      ? edadEnFecha(perfil.birth_date, data.created_at as string)
      : null;
  return {
    edad: edad != null && edad > 0 ? edad : null,
    ocupacion: (data?.occupation as string | null) ?? null,
    estadoCivil: (data?.marital_status as string | null) ?? null,
    estrato: data?.socioeconomic_stratum != null ? String(data.socioeconomic_stratum) : null,
  };
}

const SEV = ["Óptimo", "Vigilancia", "Moderado", "Crítico"];

/**
 * Los cortes POR SEXO, DERIVADOS de `indicatorBands`, que es la fuente unica de esas cadenas en la app.
 *
 * SU PROMPT LOS EXIGE Y PROHIBE LOS HISTORICOS: *"te los entrego ya resueltos para el sexo de este
 * paciente: cita esos y solo esos. Esta prohibido usar los cortes historicos unicos (IFC 3,5/6,0 · IRC
 * 2,0/3,4 · PABU con k=0,9)"*.
 *
 * Y POR ESO NO SE ESCRIBEN AQUI. En el primer intento los puse a mano y salieron MAL: escribi el umbral
 * de IFC en mujeres como 3,36 cuando el motor congelado dice 2,08 / 3,28. Habriamos alimentado al modelo
 * con cortes inventados, que es exactamente la clase de error contra la que su regla existe. Derivandolos,
 * el dia que el cambie un corte cambia aqui solo.
 */
function cortesDelSexo(sexoM: boolean): string[] {
  const out: string[] = [];
  for (const code of ["IFC", "IRC", "PABU", "ISCM", "IEHH", "IAE"]) {
    const bandas = indicatorBands(code, sexoM);
    if (bandas) out.push(`${code}: ${bandas}`);
  }
  return out;
}

export async function buildCriterionInput(
  evaluationId: string,
  snapshot: unknown,
  indicatorNames: Record<string, string>,
  efr: { mechanism: string | null; risks: string | null; diagnosisName: string | null } | null,
): Promise<CriterionPromptInput | null> {
  if (!isEngineOutput(snapshot)) return null;
  const snap: EngineOutput = snapshot;

  const [encuesta, contexto, composicion] = await Promise.all([
    leerEncuesta(evaluationId),
    leerContexto(evaluationId),
    getCompositionForEvaluation(evaluationId),
  ]);

  // La composicion se manda TAL COMO SE VE EN PANTALLA (etiqueta, valor formateado con su unidad y sus
  // decimales). Es la misma capa de display que el profesional lee, asi que el borrador y la pantalla no
  // pueden decir cifras distintas del mismo dato.
  const filasComposicion = composicion
    ? [...composicion.eval, ...composicion.diag]
        .flatMap((n) => n.rows)
        .filter((r) => r.value != null)
        .map((r) => ({
          etiqueta: r.label + (r.unit ? ` (${r.unit})` : ""),
          valor: String(r.value),
        }))
    : [];

  const indicadores = Object.entries(snap.classifications)
    .filter((e): e is [string, NonNullable<(typeof e)[1]>] => e[1] != null)
    .map(([code, c]) => {
      const v = (snap.indicators as unknown as Record<string, number | null>)[code.toLowerCase()];
      const dec = decimalesDe(code);
      return {
        nombre: indicatorNames[code] ?? code,
        valor: typeof v === "number" && Number.isFinite(v) ? v.toFixed(dec) : "—",
        clasificacion: c.label,
      };
    });

  return {
    sexo: snap.sexo === "M" ? "Masculino" : "Femenino",
    ...contexto,
    peso: null,
    talla: null,
    cintura: null,
    cadera: null,
    riesgoIntegrado: snap.dfi.riesgo.nivel,
    riesgoScore: snap.dfi.riesgo.score ?? null,
    riesgoDescripcion: null,
    dominios: snap.dfi.domains.map((d) => ({
      nombre: d.nombre,
      severidad: d.sev == null ? "sin dato" : (SEV[d.sev] ?? "sin dato"),
      clasif: d.clasif,
      lectura: d.lectura,
      items: d.items ?? [],
    })),
    veto: snap.dfi.veto === true,
    rutas: snap.dfi.rutas ?? [],
    encuesta,
    composicion: filasComposicion,
    estadoEfr: efr?.diagnosisName ?? snap.efrPhenotype.diagnostico,
    fenotipoEstructural: snap.structural.nombre,
    fenotipoMccb: snap.fenotipoMCCB?.nombre ?? null,
    sectorFuncional: snap.frSector.nombre,
    mecanismo: efr?.mechanism ?? null,
    riesgos: efr?.risks ?? null,
    indicadores,
    cortes: cortesDelSexo(snap.sexo === "M"),
  };
}
