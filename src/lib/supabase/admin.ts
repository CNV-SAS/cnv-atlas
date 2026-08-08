import "server-only";
import { createClient } from "@supabase/supabase-js";

import { missingEnvMessage } from "@/lib/env/missing-env";

// Cliente con service role: BYPASSA RLS. Es la llave maestra (SECURITY.md).
// Reglas duras: nunca se expone al cliente, nunca se importa fuera de este
// archivo, y cada uso se justifica en comentario. Solo en server actions y
// route handlers, para casos legitimos (trigger de perfil, intake del paciente,
// verificacion de webhooks, audit desde rutas sin sesion).
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = missingEnvMessage({
    NEXT_PUBLIC_SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  });
  if (missing) throw new Error(missing);
  return createClient(url!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
