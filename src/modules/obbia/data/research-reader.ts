import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Lectura del panel de obbia (B14): datasets de investigacion gobernados. Todo por RLS: la
// unica tabla que obbia puede leer es research_datasets (data agregada/anonimizada, sin PII).
// La infraestructura para generar datasets ricos es post-MVP (BACKLOG); hoy la vista lista lo
// que exista y, si no hay, muestra el estado vacio. Se seleccionan solo columnas de gobierno
// (scope, nivel de anonimizacion, estado), nunca identificadores del paciente.

export type ResearchDataset = {
  id: string;
  scope: string;
  anonymizationLevel: string;
  status: string;
  createdAt: string;
};

export async function getResearchDatasets(): Promise<ResearchDataset[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("research_datasets")
    .select("id, scope, anonymization_level, status, created_at")
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    scope: r.scope,
    anonymizationLevel: r.anonymization_level,
    status: r.status,
    createdAt: r.created_at,
  }));
}
