import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { PromptView } from "./ai-prompt-types";

// Estado de un prompt versionado para el panel admin. Lectura por RLS (ai_prompts es
// admin-only, regla dura 3): la version activa (contenido editable) y el historial de
// versiones. El contenido es SOLO el bloque de instrucciones de sistema.

// Los tipos viven en ai-prompt-types (modulo neutro) para que el form cliente los importe sin el reader.
export type { PromptVersionRow, PromptView } from "./ai-prompt-types";

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
