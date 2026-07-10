import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Estado de un prompt versionado para el panel admin. Lectura por RLS (ai_prompts es
// admin-only, regla dura 3): la version activa (contenido editable) y el historial de
// versiones. El contenido es SOLO el bloque de instrucciones de sistema.

export type PromptVersionRow = {
  version: number;
  status: string; // active, retired
  createdAt: string;
};

export type PromptView = {
  promptKey: string;
  activeContent: string | null;
  activeVersion: number | null;
  versions: PromptVersionRow[];
};

export async function getPromptView(promptKey: string): Promise<PromptView> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ai_prompts")
    .select("version, content, status, created_at")
    .eq("prompt_key", promptKey)
    .order("version", { ascending: false });

  const rows = data ?? [];
  const active = rows.find((r) => r.status === "active") ?? null;

  return {
    promptKey,
    activeContent: active?.content ?? null,
    activeVersion: active?.version ?? null,
    versions: rows.map((r) => ({
      version: r.version,
      status: r.status,
      createdAt: r.created_at,
    })),
  };
}
