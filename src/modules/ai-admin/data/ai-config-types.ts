import type { AI_PROVIDERS } from "../validations";

// Tipos NEUTROS (sin server-only) del estado de la config de IA para el panel admin. Viven aparte del
// reader server-only para que el form cliente los importe sin arrastrar el reader al boundary de cliente
// (hazard RSC latente; ver client-import-server-only-rompe-prod). El reader los reexporta para el server.
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
