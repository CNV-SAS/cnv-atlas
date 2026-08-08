import { createBrowserClient } from "@supabase/ssr";

import { missingEnvMessage } from "@/lib/env/missing-env";

// Cliente de Supabase para componentes de navegador. Usa la anon key + RLS.
// Nada sensible: la anon key es publica por diseno.
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missing = missingEnvMessage({
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  });
  if (missing) throw new Error(missing);
  return createBrowserClient(url!, anonKey!);
}
