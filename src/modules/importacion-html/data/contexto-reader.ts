import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveSurvey } from "@/modules/evaluations/data/survey-reader";

import type { ContextoDeRevision } from "../services/revisar-lote";

// Lo que Atlas sabe para revisar un lote: sus pacientes (para el cruce por documento) y la encuesta (para
// decir que respuestas no calzan). SOLO LEE. Cliente con sesion + RLS: `patients_select` deja ver todos a
// admin, que es el unico que llega aqui (policy `canImportFromHtml`).
//
// LAS OPCIONES DE TODAS LAS VERSIONES, no solo la vigente (2026-09-22). Un paciente del HTML respondio con el
// texto de la version que tenia su HTML: "Gluten" es el de v2 a v5, antes de que se le añadiera "(trigo, pan,
// pasta)" en la v6 (el mismo hueco que cerro la 0125 para los alergenos). Comparar solo con la vigente lo
// daria por "no calza", y el profesional corregiria algo que esta bien.
export async function leerContextoDeRevision(): Promise<ContextoDeRevision> {
  const supabase = await createSupabaseServerClient();
  const [{ data: pacientes, error }, encuesta, { data: todas, error: e2 }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, document_number, patient_profiles(first_name, last_name, birth_date)")
      .is("deleted_at", null),
    getActiveSurvey(),
    supabase.from("survey_questions").select("field_key, survey_options(option_text)").not("field_key", "is", null),
  ]);
  if (error) throw new Error(`contexto-reader: pacientes: ${error.message}`);
  if (e2) throw new Error(`contexto-reader: versiones de la encuesta: ${e2.message}`);

  const historicas = new Map<string, Set<string>>();
  for (const q of todas ?? []) {
    if (!q.field_key) continue;
    const s = historicas.get(q.field_key) ?? new Set<string>();
    for (const o of q.survey_options ?? []) s.add(o.option_text);
    historicas.set(q.field_key, s);
  }

  type Perfil = { first_name: string; last_name: string; birth_date: string | null };
  return {
    pacientesAtlas: (pacientes ?? []).map((p) => {
      const perfil = (Array.isArray(p.patient_profiles) ? p.patient_profiles[0] : p.patient_profiles) as Perfil | null;
      return {
        id: p.id,
        documento: p.document_number,
        nombre: perfil ? `${perfil.first_name} ${perfil.last_name}`.trim() : "",
        fechaNacimiento: perfil?.birth_date ?? null,
      };
    }),
    preguntas: (encuesta?.questions ?? [])
      .filter((q) => q.fieldKey)
      .map((q) => {
        const vigentes = q.options.map((o) => o.text);
        return {
          clave: q.fieldKey as string,
          tipo: q.type,
          opciones: vigentes,
          opcionesAnteriores: [...(historicas.get(q.fieldKey as string) ?? [])].filter((o) => !vigentes.includes(o)),
        };
      }),
  };
}
