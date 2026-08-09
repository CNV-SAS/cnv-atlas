// Tipos NEUTROS (sin server-only) del estado de un prompt versionado para el panel admin. Viven aparte
// del reader server-only para que el form cliente los importe sin arrastrar el reader al boundary de
// cliente (hazard RSC latente; ver client-import-server-only-rompe-prod). El reader los reexporta.
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
