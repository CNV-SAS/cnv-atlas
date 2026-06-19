import { createSupabaseServerClient } from "@/lib/supabase/server";

import type {
  Nutraceutical,
  NutraceuticalInsert,
  NutraceuticalInventory,
  NutraceuticalUsage,
} from "../types";

// Repositorio de nutraceuticos (ARCHITECTURE regla 1). Cliente Supabase anon +
// RLS: catalogo lo escribe admin; inventario admin/soporte; uso solo el
// profesional del paciente (lo enforce la RLS). Drizzle se saltaria RLS, no se usa.
// Lanza en error; el service lo envuelve en Result.

function fail(context: string, message: string | undefined): never {
  throw new Error(`nutraceuticals-repository: ${context}: ${message ?? "error desconocido"}`);
}

// ----- Catalogo -----

export async function listNutraceuticals(): Promise<Nutraceutical[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("nutraceuticals")
    .select("*")
    .order("name", { ascending: true });
  if (error) fail("listNutraceuticals", error.message);
  return data ?? [];
}

export async function getNutraceuticalById(id: string): Promise<Nutraceutical | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("nutraceuticals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("getNutraceuticalById", error.message);
  return data;
}

export async function createNutraceutical(
  values: Omit<NutraceuticalInsert, "organization_id">,
  organizationId: string,
): Promise<Nutraceutical> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("nutraceuticals")
    .insert({ ...values, organization_id: organizationId })
    .select("*")
    .single();
  if (error) fail("createNutraceutical", error.message);
  return data!;
}

export async function updateNutraceutical(
  id: string,
  patch: { name: string; description: string | null; unit: string | null; unit_price: number | null },
): Promise<Nutraceutical> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("nutraceuticals")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) fail("updateNutraceutical", error.message);
  return data!;
}

// ----- Inventario -----

export async function listInventory(): Promise<NutraceuticalInventory[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("nutraceutical_inventory").select("*");
  if (error) fail("listInventory", error.message);
  return data ?? [];
}

export async function getInventory(
  nutraceuticalId: string,
): Promise<NutraceuticalInventory | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("nutraceutical_inventory")
    .select("*")
    .eq("nutraceutical_id", nutraceuticalId)
    .maybeSingle();
  if (error) fail("getInventory", error.message);
  return data;
}

export async function createInventory(
  nutraceuticalId: string,
  stockQuantity = 0,
): Promise<NutraceuticalInventory> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("nutraceutical_inventory")
    .insert({ nutraceutical_id: nutraceuticalId, stock_quantity: stockQuantity })
    .select("*")
    .single();
  if (error) fail("createInventory", error.message);
  return data!;
}

export async function setStock(
  nutraceuticalId: string,
  stockQuantity: number,
): Promise<NutraceuticalInventory> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("nutraceutical_inventory")
    .update({ stock_quantity: stockQuantity, last_updated: new Date().toISOString() })
    .eq("nutraceutical_id", nutraceuticalId)
    .select("*")
    .single();
  if (error) fail("setStock", error.message);
  return data!;
}

// ----- Uso (vinculado a un tratamiento) -----

export async function createUsage(
  treatmentId: string,
  nutraceuticalId: string,
  quantity: number,
): Promise<NutraceuticalUsage> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("nutraceutical_usage")
    .insert({ treatment_id: treatmentId, nutraceutical_id: nutraceuticalId, quantity })
    .select("*")
    .single();
  if (error) fail("createUsage", error.message);
  return data!;
}

export async function listUsageByTreatment(treatmentId: string): Promise<NutraceuticalUsage[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("nutraceutical_usage")
    .select("*")
    .eq("treatment_id", treatmentId);
  if (error) fail("listUsageByTreatment", error.message);
  return data ?? [];
}
