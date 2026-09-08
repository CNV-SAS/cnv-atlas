import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// EL TOKEN DE REANUDACION DE UNA EVALUACION PENDIENTE, para la pantalla del profesional.
//
// QUIEN PUEDE VERLO, que es la pregunta que hay que contestar antes de exponerlo: se lee POR RLS (cliente
// de sesion, no service role). Si la RLS no le deja ver la evaluacion, aqui no sale nada. No hay una
// segunda definicion de "es mia".
//
// Y POR QUE EXPONERLO NO AMPLIA NADA. El token abre UNA evaluacion, y solo mientras sigue en
// 'awaiting_survey': es MAS ESTRECHO que lo que el profesional ya puede hacer con esa misma evaluacion
// por su sesion. Se filtra por estado a proposito: un token de una evaluacion ya respondida no abre nada,
// y devolverlo solo serviria para que alguien lo guardara.
export async function getPendingResumeToken(evaluationId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluations")
    .select("resume_token")
    .eq("id", evaluationId)
    .eq("status", "awaiting_survey")
    .is("superseded_at", null)
    .maybeSingle();
  if (error) throw new Error(`pending-resume-reader: ${error.message}`);
  return (data?.resume_token as string | null) ?? null;
}
