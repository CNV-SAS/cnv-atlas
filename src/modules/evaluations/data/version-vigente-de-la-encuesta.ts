import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { CODIGO_LINEA_BASE } from "../instrumento";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CUAL ES LA VERSION VIGENTE DE LA ENCUESTA  ·  UN SOLO SITIO  ·  2026-11-07
//
// ═══ EL DEFECTO QUE CIERRA, Y QUE ESTABA LATENTE DESDE EL PRINCIPIO ═══
//
// Cuatro lectores y catorce candados resolvian "la encuesta vigente" asi:
//
//     select id from survey_versions order by published_at desc limit 1
//
// SIN FILTRAR POR PLANTILLA. Funciono mientras hubo una sola plantilla, y era correcto por casualidad:
// la consulta no dice "la version mas reciente DE LA ENCUESTA", dice "la fila mas reciente de la tabla".
//
// El 2026-11-07, al sembrar el Modulo S en su propia version, esa consulta paso a devolver SIETE
// preguntas de adherencia. La encuesta del paciente, el gate del diagnostico y el flujo de correccion
// habrian resuelto sus `field_key` contra un cuestionario que no es el suyo. Lo atrapo la suite de BD
// (veintiocho casos en rojo a la vez), y ningun test de tipos podia verlo.
//
// ═══ LA DEFINICION, QUE ES LO QUE FALTABA ═══
//
// La version vigente de la encuesta es LA QUE APLICA EL INSTRUMENTO DE LINEA BASE. No "la mas reciente",
// que es una correlacion: es una propiedad del instrumento, que es quien sabe que cuestionario se usa.
//
// Y se toma del primer item que NO sea `propio`, por la misma razon que en el lector: `propio` significa
// "esta pregunta es del instrumento" (el Modulo S), y su version no es la del cuestionario.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** La version vigente del cuestionario, o `null` si no hay instrumento sembrado (la 0240 sin aplicar). */
export async function versionVigenteDeLaEncuesta(): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("survey_instrument_items")
    .select(
      "order_index, comportamiento, survey_questions!survey_instrument_items_question_id_fkey(survey_version_id), survey_instruments!inner(codigo)",
    )
    .eq("survey_instruments.codigo", CODIGO_LINEA_BASE)
    .neq("comportamiento", "propio")
    .order("order_index", { ascending: true })
    .limit(1);
  if (error) throw new Error(`version-vigente: ${error.message}`);
  const fila = (data ?? [])[0] as unknown as
    | { survey_questions: { survey_version_id: string } | null }
    | undefined;
  return fila?.survey_questions?.survey_version_id ?? null;
}

/**
 * LA MISMA DEFINICION, EN SQL, para los sitios que no pasan por el cliente de Supabase.
 *
 * Vive en un modulo NEUTRO (`../version-vigente-sql`) y se reexporta aqui: los candados de BD solo
 * quieren la cadena, y obligarlos a importar este reader los ataria al cliente de servicio.
 */
export { SQL_VERSION_VIGENTE } from "../version-vigente-sql";
