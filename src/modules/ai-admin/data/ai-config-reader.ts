import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { modelsForProvider } from "../models";
import { AI_PROVIDERS } from "../validations";

// Estado de la config de IA para el panel admin. La fila de ai_config se lee por RLS
// (admin-only, regla dura 3). El estado de cada proveedor se deriva del entorno: las keys
// nunca se exponen, solo se informa si estan presentes, para que el admin sepa que puede
// activar sin dejar la IA rota.

export type AiProviderStatus = {
  id: (typeof AI_PROVIDERS)[number];
  hasKey: boolean; // la API key existe en el entorno
  envModel: string | null; // modelo por defecto configurado en el entorno
  models: string[]; // modelos validos para este proveedor (catalogo + entorno)
};

export type AiConfigView = {
  current: { activeProvider: string; activeModel: string; updatedAt: string } | null;
  providers: AiProviderStatus[];
};

export async function getAiConfigView(): Promise<AiConfigView> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ai_config")
    .select("active_provider, active_model, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const providers: AiProviderStatus[] = [
    {
      id: "groq",
      hasKey: Boolean(process.env.GROQ_API_KEY),
      envModel: process.env.GROQ_MODEL ?? null,
      models: modelsForProvider("groq"),
    },
    {
      id: "gemini",
      hasKey: Boolean(process.env.GEMINI_API_KEY),
      envModel: process.env.GEMINI_MODEL ?? null,
      models: modelsForProvider("gemini"),
    },
  ];

  return {
    current: data
      ? {
          activeProvider: data.active_provider,
          activeModel: data.active_model,
          updatedAt: data.updated_at,
        }
      : null,
    providers,
  };
}
