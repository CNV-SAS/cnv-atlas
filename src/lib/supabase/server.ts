import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { missingEnvMessage } from "@/lib/env/missing-env";
import type { Database } from "@/types/database.generated";

// Cliente de Supabase para Server Components, server actions y route handlers.
// Usa la anon key + RLS (el 99% de los casos). La sesion vive en cookies.
// Tipado con la Database generada: los repos obtienen columnas y filas tipadas.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missing = missingEnvMessage({
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  });
  if (missing) throw new Error(missing);
  // missingEnvMessage ya lanzo si faltaba alguna; el `!` es para el narrowing (TS no lo infiere del helper).
  return createServerClient<Database>(url!, anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // setAll desde un Server Component falla: lo cubre el refresco de
          // sesion en proxy.ts. Aqui se ignora a proposito.
        }
      },
    },
  });
}
