import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Lee la profesion configurada del actor (professional_profiles.profession por profile_id).
// RLS professional_profiles_select deja al profesional leer su propia fila. Devuelve null si
// no tiene profesion configurada. HOY todo profesional real nace null: el onboarding no la
// captura (ver BACKLOG, captura de profesion al invitar). Sirve al guard interino de ambito
// de practica de las escrituras de tratamiento (requireConfiguredProfession).
export async function getActorProfession(userId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("professional_profiles")
    .select("profession")
    .eq("profile_id", userId)
    .maybeSingle();
  if (error) throw new Error(`actor-profession-reader: ${error.message}`);
  return data?.profession ?? null;
}
