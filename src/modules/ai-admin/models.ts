import "server-only";

import { AI_MODEL_CATALOG, type AiProviderId } from "./validations";

// Modelos validos por proveedor: el catalogo curado mas el modelo configurado en el entorno.
// Incluir el modelo del entorno garantiza que el que esta desplegado siempre sea seleccionable
// y valido, aunque el catalogo curado no lo liste. La validacion server-side y las opciones que
// ve el admin usan esta misma fuente, para que no haya combinacion proveedor/modelo inconsistente.

function envModel(provider: AiProviderId): string | undefined {
  return provider === "groq" ? process.env.GROQ_MODEL : process.env.GEMINI_MODEL;
}

export function modelsForProvider(provider: AiProviderId): string[] {
  const list = [...AI_MODEL_CATALOG[provider]];
  const env = envModel(provider);
  if (env && !list.includes(env)) list.unshift(env);
  return list;
}
