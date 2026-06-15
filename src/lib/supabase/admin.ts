import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con service role: BYPASSA RLS. Es la llave maestra (SECURITY.md).
// Reglas duras: nunca se expone al cliente, nunca se importa fuera de este
// archivo, y cada uso se justifica en comentario. Solo en server actions y
// route handlers, para casos legitimos (trigger de perfil, intake del paciente,
// verificacion de webhooks, audit desde rutas sin sesion).
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
