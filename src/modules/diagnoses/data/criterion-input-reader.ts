import { alertasDeLaConsulta } from "@/clinical-engine/alertas-de-la-consulta";
import "server-only";

import { isEngineOutput, type EngineOutput } from "@/clinical-engine";
import { dfiNarrativeFromOutput } from "@/clinical-engine/dfi-narrative";
import { edadEnFecha } from "@/lib/format/edad";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CriterionPromptInput,
  RespuestaEncuesta,
} from "@/modules/diagnoses/ai/prompts/criterion.v2";

import { composicionClasificada } from "./composition-clasificada";
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
async function leerEncuesta(evaluationId: string): Promise<{ legible: RespuestaEncuesta[]; cruda: RespuestaEncuesta[] }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("survey_responses")
    .select("id, survey_answers(answer_value, survey_questions(field_key, question_text, order_index))")
    .eq("evaluation_id", evaluationId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`criterion-input-reader: encuesta: ${error.message}`);
  if (!data) return { legible: [], cruda: [] };

  type Fila = {
    answer_value: string | null;
    survey_questions: { field_key: string | null; question_text: string; order_index: number } | null;
  };
  const filas = ((data as unknown as { survey_answers: Fila[] }).survey_answers ?? [])
    .filter((f) => f.survey_questions != null)
    .sort((a, b) => (a.survey_questions!.order_index ?? 0) - (b.survey_questions!.order_index ?? 0));

  const cruda = filas.map((f) => ({
    fieldKey: f.survey_questions!.field_key,
    pregunta: f.survey_questions!.question_text,
    valor: f.answer_value,
  }));
  return {
    // Las de opcion multiple viajan como JSON: se despliegan a texto legible, que es lo que el modelo
    // tiene que leer. Un `["Metformina"]` crudo le ensena nuestra serializacion, no la respuesta.
    legible: cruda.map((r) => ({ ...r, valor: legible(r.valor) })),
    // Y LAS ALERTAS SE CALCULAN SOBRE LA CRUDA, como en el SOAP (2026-09-22). Sus reglas leen la opcion
    // multiple como lista (`Array.isArray`); con el texto ya desplegado, la del TCA (metodos para cambiar el
    // peso) no disparaba y el resumen la omitia mientras el SOAP de la misma evaluacion si la traia.
    cruda,
  };
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

const PHI = 1.618;

/** "por debajo de φ (1,202)", "por encima de φ (2,362)" o "en φ". null sin PABU. */
/**
 * La clasificacion del indicador CON SU LECTURA cuando la escala se lee al reves de lo que sugiere la palabra.
 * El ICEC es el LE8 (0-100) y en su escala mas alto es mejor (bajo <50 · ideal ≥80, sus cortes): "Bajo" es
 * carga ALTA. Groq escribio "ICEC 33, carga epigenetica baja" (2026-09-22).
 */
export function lecturaDelIndicador(code: string, clasificacion: string): string {
  // EL IEHH GRADUA LA HIDRO-HOMEOSTASIS (su cIEHH, v9 L4029: Óptimo, Leve, Moderado, Severo), no la
  // deshidratacion. Gemini escribio "IEHH 0,81 (Leve), lo que sugiere una leve deshidratacion" (2026-09-22).
  if (code === "IEHH") {
    return `${clasificacion}; gradúa el equilibrio hídrico del organismo (hidro-homeostasis), no la deshidratación`;
  }
  if (code === "ICEC") {
    return `${clasificacion}; en la escala LE8 más alto es mejor (ideal 80 o más), así que un puntaje bajo es carga epigenético-contextual alta`;
  }
  return clasificacion;
}

export function direccionDeLaPabu(pabu: number | null | undefined): string | null {
  if (typeof pabu !== "number" || !Number.isFinite(pabu)) return null;
  const cifra = pabu.toFixed(3).replace(".", ",");
  if (Math.abs(pabu - PHI) < 0.0005) return `en φ (${cifra})`;
  // CON SU LECTURA (v9): Gemini leyo "por debajo" y aun asi escribio "deficit estructural" junto a "por
  // exceso". La lectura es la de su prompt (por encima, deficit estructural; por debajo, exceso de adiposidad).
  return pabu < PHI
    ? `la PABU (${cifra}) está por debajo de φ = 1,618, lo que se lee como exceso de adiposidad`
    : `la PABU (${cifra}) está por encima de φ = 1,618, lo que se lee como déficit estructural`;
}

export async function buildCriterionInput(
  evaluationId: string,
  snapshot: unknown,
  indicatorNames: Record<string, string>,
  efr: { mechanism: string | null; risks: string | null; diagnosisName: string | null } | null,
): Promise<CriterionPromptInput | null> {
  if (!isEngineOutput(snapshot)) return null;
  const snap: EngineOutput = snapshot;

  const [{ legible: encuesta, cruda: encuestaCruda }, contexto, composicion] = await Promise.all([
    leerEncuesta(evaluationId),
    leerContexto(evaluationId),
    getCompositionForEvaluation(evaluationId),
  ]);

  // LA COMPOSICION VA CLASIFICADA, como en la historia clinica (2026-09-22): la misma funcion
  // (`composicionClasificada`), con su valor formateado, su unidad y el veredicto de su clasificador. Antes
  // viajaba la cifra cruda ("IMC 25.663") sin veredicto, y el modelo escribio que un IMC de 25,7 "roza el
  // sobrepeso": la lectura tiene que llegarle hecha, no deducirla.
  const filasComposicion = composicionClasificada(composicion, snap.sexo === "M")
    .filter((f) => f.valor !== "")
    .map((f) => ({ etiqueta: f.etiqueta, valor: f.valor, clasificacion: f.clasificacion }));

  const indicadores = Object.entries(snap.classifications)
    .filter((e): e is [string, NonNullable<(typeof e)[1]>] => e[1] != null)
    .map(([code, c]) => {
      const v = (snap.indicators as unknown as Record<string, number | null>)[code.toLowerCase()];
      const dec = decimalesDe(code);
      return {
        nombre: indicatorNames[code] ?? code,
        valor: typeof v === "number" && Number.isFinite(v) ? v.toFixed(dec) : "-",
        clasificacion: lecturaDelIndicador(code, c.label),
      };
    });

  const consulta = alertasDeLaConsulta(encuestaCruda);

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
    // LAS MISMAS QUE VE EL PROFESIONAL EN PANTALLA, por la misma funcion y sobre las mismas respuestas.
    // Si aqui se filtrara o se calculara distinto, el resumen hablaria de alertas que la pantalla no
    // muestra (o al reves), que es la peor forma de perder la confianza en las dos.
    // v5: UNA SOLA FUENTE para la IA y el SOAP (`alertasDeLaConsulta`): sus reglas vivas y las respuestas
    // en rojo que no repiten a una regla. Si cada superficie armara su lista, el resumen podria nombrar lo
    // que la historia no tiene.
    alertas: consulta.reglas.map((a) => ({ nivel: a.niv, titulo: a.t, dominio: a.dom })),
    respuestasEnRojo: consulta.respuestasEnRojo.map((r) => ({
      dominio: r.dominio,
      pregunta: r.pregunta,
      respuesta: r.respuesta,
    })),
    composicion: filasComposicion,
    estadoEfr: efr?.diagnosisName ?? snap.efrPhenotype.diagnostico,
    fenotipoEstructural: snap.structural.nombre,
    fenotipoMccb: snap.fenotipoMCCB?.nombre ?? null,
    sectorFuncional: snap.frSector.nombre,
    mecanismo: efr?.mechanism ?? null,
    riesgos: efr?.risks ?? null,
    indicadores,
    cortes: cortesDelSexo(snap.sexo === "M"),
    // LA DIRECCION DE LA PABU, resuelta de la cifra sellada: es aritmetica (mayor o menor que phi), no
    // clinica. El modelo leyo el "+" de "desviación de φ +0,42" como "por encima" con la PABU en 1,20.
    direccionPabu: direccionDeLaPabu(snap.indicators.pabu),
    // EL CIERRE LO ESCRIBE ATLAS (v10): las rutas con su prioridad salen de la MISMA narrativa del DFI que
    // cierra la A del SOAP. Sin DFI completo no hay narrativa, y entonces no se escribe cierre.
    rutasActivadas: snap.dfi.complete ? dfiNarrativeFromOutput(snap).rutasActivadas : null,
  };
}
