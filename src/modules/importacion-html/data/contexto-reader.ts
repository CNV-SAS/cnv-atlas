import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveSurvey } from "@/modules/evaluations/data/survey-reader";

import type { ContextoDeRevision } from "../services/revisar-lote";

// Lo que Atlas sabe para revisar un lote: sus pacientes (para el cruce por documento) y la encuesta vigente
// (para decir que respuestas no calzan). SOLO LEE. Cliente con sesion + RLS: `patients_select` deja ver todos
// a admin, que es el unico que llega aqui (policy `canImportFromHtml`).
export async function leerContextoDeRevision(): Promise<ContextoDeRevision> {
  const supabase = await createSupabaseServerClient();
  const [{ data: pacientes, error }, encuesta] = await Promise.all([
    supabase
      .from("patients")
      .select("id, document_number, patient_profiles(first_name, last_name, birth_date)")
      .is("deleted_at", null),
    getActiveSurvey(),
  ]);
  if (error) throw new Error(`contexto-reader: pacientes: ${error.message}`);

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
      .map((q) => ({ clave: q.fieldKey as string, tipo: q.type, opciones: q.options.map((o) => o.text) })),
  };
}
