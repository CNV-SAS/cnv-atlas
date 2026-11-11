import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS DIAGNOSTICOS DE UNA CONSULTA, POR SU COLUMNA INDEXADA  ·  EL APAGON DEL 2026-11-10
//
// ═══ QUE PASO ═══
//
// `GET /ani-bis-e/[id]` se cayo con pacientes reales: 25 eventos NO MANEJADOS de
// *"treatment-reader: treatments: canceling statement due to statement timeout"* y 9 mas del lector del
// protocolo sellado. Es exactamente la forma que quedo nombrada y medida el 9 de noviembre, cuando el
// mismo apagon vino de `survey_answers`:
//
//   NUEVE consultas pedian `treatments` (o `diagnosis_notes`) filtrando SOLO por una columna de su
//   embebido: `.eq("diagnoses.evaluation_id", …)`. Sobre la tabla propia no habia ningun filtro.
//
// Postgres entonces RECORRE `treatments` ENTERA y en cada fila evalua la politica de RLS, que es un
// `exists` que salta a `diagnoses`, de ahi a `evaluations` y de ahi llama a `is_patient_professional`.
// Y aqui el coste por fila es peor que en `survey_answers`, porque el `select` de `getTreatmentProtocol`
// pide seis columnas JSONB (`protocol_suggested`, `menu_semanal`, `intercambio_porciones`, `tiempos`,
// `tiempos_activos`, `restricciones`): cada fila recorrida se materializa con todo eso dentro.
//
// El 9 de noviembre lo medimos y dijimos que no era un incidente TODAVIA: `treatments` tenia 389 filas y
// la consulta tardaba 154 ms con sesion de profesional. Un dia y medio despues reventó. **La cifra que
// importaba no era el tiempo de ese dia, era que el coste crece con la TABLA y no con el resultado.**
//
// ═══ LA RECETA, LA MISMA DEL 9 DE NOVIEMBRE ═══
//
//   1. los ids de los diagnosticos de esa consulta, por `diagnoses.evaluation_id` (indice
//      `diagnoses_eval_idx`);
//   2. la tabla que se queria, filtrada por SU PROPIA columna indexada: `diagnosis_id in (...)`
//      (indice `treatments_diagnosis_idx`, creado en la 0236 por este mismo motivo).
//
// Los dos indices ya existen, asi que NO HACE FALTA MIGRACION. Y el `in` lleva como mucho un puñado de
// ids: son los diagnosticos de UNA consulta.
//
// ═══ POR QUE DEVUELVE EL ERROR EN VEZ DE LANZAR ═══
//
// Porque los nueve llamadores no tienen la misma politica, y esa diferencia es deliberada en cada uno:
// `hayProtocoloSellado` LANZA (su nota lo dice: *"un `false` por error afirmaria que no hay plan"*),
// mientras la proxima cita de la historia clinica se lee sin mirar el error, porque una cita que falta no
// puede frenar un documento. Si este ayudante lanzara, cambiaria en silencio la politica de los que hoy
// no lanzan, y empezarian a tumbar la pagina: justo lo contrario de lo que este arreglo busca.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type DiagnosticosDeLaConsulta = {
  /** Los ids, del mas reciente al mas viejo. Vacio = esa consulta no tiene diagnostico. */
  ids: string[];
  /** El mensaje de la base, o `null`. Con error, `ids` esta vacio POR EL ERROR. */
  error: string | null;
};

export async function idsDeLosDiagnosticos(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  evaluationId: string,
): Promise<DiagnosticosDeLaConsulta> {
  const { data, error } = await supabase
    .from("diagnoses")
    .select("id")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false });
  if (error) return { ids: [], error: error.message };
  return { ids: (data ?? []).map((d) => d.id as string), error: null };
}
