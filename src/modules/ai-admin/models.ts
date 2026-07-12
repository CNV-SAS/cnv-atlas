import "server-only";

import type { AiProviderId } from "./validations";

// Modelos validos por proveedor: SOLO el modelo configurado en el entorno (GROQ_MODEL /
// GEMINI_MODEL). Es el unico que esta garantizado de existir y funcionar contra la API de ese
// proveedor en este despliegue. No se usa un catalogo hardcodeado: se pudre con el tiempo
// (modelos que se retiran del endpoint) y aceptaria combinaciones que la API rechaza con 404,
// disparando el fallback en silencio. El admin elige el PROVEEDOR; el modelo lo fija el
// entorno. La misma fuente valida en el servidor y alimenta las opciones que ve el admin.

function envModel(provider: AiProviderId): string | undefined {
  return provider === "groq" ? process.env.GROQ_MODEL : process.env.GEMINI_MODEL;
}

export function modelsForProvider(provider: AiProviderId): string[] {
  const env = envModel(provider);
  return env ? [env] : [];
}
