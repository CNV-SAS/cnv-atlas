import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { TransactionWithItems } from "../types";

// Lecturas de pagos para la UI autenticada (ARCHITECTURE regla 1). Cliente Supabase
// anon + RLS: la policy transactions_select de B1 filtra (admin/direccion ven todo,
// el profesional solo sus transacciones). Drizzle se saltaria RLS, no se usa aqui.
// Las ESCRITURAS financieras viven en payments-writer.ts (Drizzle, server-side).

function fail(context: string, message: string | undefined): never {
  throw new Error(`payments-repository: ${context}: ${message ?? "error desconocido"}`);
}

export async function listTransactions(): Promise<TransactionWithItems[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, transaction_items(*, nutraceuticals(name))")
    .order("created_at", { ascending: false });
  if (error) fail("listTransactions", error.message);
  // El embed (items + nombre del nutraceutico) lo garantiza la forma del query;
  // se castea a la vista de dominio que consume la UI.
  return (data ?? []) as unknown as TransactionWithItems[];
}

// professional_profiles.id del usuario actual (si es profesional). RLS:
// professional_profiles_select deja al profesional leer su propia fila.
export async function getProfessionalProfileIdByUser(userId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("professional_profiles")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  if (error) fail("getProfessionalProfileIdByUser", error.message);
  return data?.id ?? null;
}

// professional_profiles.id del profesional asignado a un paciente (via ppr). RLS:
// ppr_select deja a admin/soporte leerlo. Sirve para sellar la comision cuando el
// checkout lo crea un admin (no un profesional).
export async function getProfessionalIdForPatient(patientId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patient_professional_relationships")
    .select("professional_id")
    .eq("patient_id", patientId)
    .limit(1);
  if (error) fail("getProfessionalIdForPatient", error.message);
  return data?.[0]?.professional_id ?? null;
}

export type SelectablePatient = { id: string; label: string };

// Pacientes seleccionables para el form de checkout. RLS patients_select filtra
// (el profesional ve los suyos, admin/soporte todos). Lectura minima y temporal
// hasta que aterrice el modulo de pacientes (bloque posterior); solo expone el id
// y una etiqueta por documento para identificarlos en el selector.
export async function listSelectablePatients(): Promise<SelectablePatient[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patients")
    .select("id, document_type, document_number")
    .order("document_number", { ascending: true });
  if (error) fail("listSelectablePatients", error.message);
  return (data ?? []).map((p) => ({
    id: p.id,
    label: `${p.document_type} ${p.document_number}`,
  }));
}
