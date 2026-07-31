import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActorProfession = {
  // Tiene fila en professional_profiles (es profesional). Distingue al profesional del actor sin
  // perfil profesional (p. ej. admin), que NO cae bajo el guard de ambito de practica: su permiso
  // lo gobierna la policy de la action, y la gobernanza admin-vs-clinico es un item aparte (BACKLOG).
  isProfessional: boolean;
  // Profesion configurada (null si el profesional aun no la tiene; HOY todo profesional real nace
  // null porque el onboarding no la captura, ver BACKLOG).
  profession: string | null;
};

// Lee el perfil profesional del actor (professional_profiles.profession por profile_id). RLS
// professional_profiles_select deja al profesional leer su propia fila. Devuelve isProfessional
// = false cuando NO hay fila (no es profesional). Sirve al guard interino de ambito de practica
// de las escrituras de tratamiento (requireNutricionista), que solo aplica al profesional.
export async function getActorProfession(userId: string): Promise<ActorProfession> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("professional_profiles")
    .select("profession")
    .eq("profile_id", userId)
    .maybeSingle();
  if (error) throw new Error(`actor-profession-reader: ${error.message}`);
  if (!data) return { isProfessional: false, profession: null };
  return { isProfessional: true, profession: data.profession ?? null };
}
