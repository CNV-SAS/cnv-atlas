import { createSupabaseServerClient } from "@/lib/supabase/server";

import { CHECKOUT_TTL_MS } from "./checkout-reader";
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

// Busca un checkout DUPLICADO VIVO para avisar antes de crear otro: mismo paciente + el mismo producto,
// con la transaccion aun 'pending' y dentro de las 24h (un pending mas viejo tiene el link muerto, ver
// checkout-reader, asi que no cuenta). Bajo RLS: el profesional ve sus propios pendientes de ese paciente
// (cubre el caso reportado: el olvido o la pestana vieja del mismo profesional). Devuelve el primero.
export async function findLivePendingDuplicate(
  patientId: string,
  nutraceuticalIds: string[],
): Promise<{ product: string; hoursAgo: number } | null> {
  if (nutraceuticalIds.length === 0) return null;
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - CHECKOUT_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from("transactions")
    .select("created_at, transaction_items!inner(nutraceutical_id, nutraceuticals(name))")
    .eq("patient_id", patientId)
    .eq("status", "pending")
    .gte("created_at", since)
    .in("transaction_items.nutraceutical_id", nutraceuticalIds)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) fail("findLivePendingDuplicate", error.message);
  const row = data?.[0];
  if (!row) return null;
  const item = Array.isArray(row.transaction_items) ? row.transaction_items[0] : row.transaction_items;
  const nutra = item?.nutraceuticals;
  const product = (Array.isArray(nutra) ? nutra[0]?.name : nutra?.name) ?? "un producto";
  const hoursAgo = Math.floor((Date.now() - new Date(row.created_at).getTime()) / (60 * 60 * 1000));
  return { product, hoursAgo };
}

// Ventana para avisar de una venta en EFECTIVO duplicada RECIENTE. Corta a proposito: dos ventas
// identicas al mismo paciente en minutos son casi seguro un doble-registro; dos el mismo dia (mañana y
// tarde) pueden ser legitimas y no deben molestar. El aviso NO bloquea (el profesional confirma).
const CASH_DUP_WINDOW_MS = 10 * 60 * 1000;

// Busca una venta en efectivo IDENTICA reciente (mismo paciente + mismo producto, pagada, en la ventana)
// para avisar antes de registrar otra. A diferencia del checkout (pending, 24h), aqui la venta ya esta
// PAGADA: por eso el aviso importa mas (un cobro duplicado en efectivo se revierte con nota credito, no
// con un clic). Bajo RLS: el profesional ve sus propias ventas de ese paciente.
export async function findRecentCashSaleDuplicate(
  patientId: string,
  nutraceuticalIds: string[],
): Promise<{ product: string; minutesAgo: number } | null> {
  if (nutraceuticalIds.length === 0) return null;
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - CASH_DUP_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("transactions")
    .select("created_at, transaction_items!inner(nutraceutical_id, nutraceuticals(name))")
    .eq("patient_id", patientId)
    .eq("status", "paid")
    .eq("payment_method", "efectivo")
    .gte("created_at", since)
    .in("transaction_items.nutraceutical_id", nutraceuticalIds)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) fail("findRecentCashSaleDuplicate", error.message);
  const row = data?.[0];
  if (!row) return null;
  const item = Array.isArray(row.transaction_items) ? row.transaction_items[0] : row.transaction_items;
  const nutra = item?.nutraceuticals;
  const product = (Array.isArray(nutra) ? nutra[0]?.name : nutra?.name) ?? "un producto";
  const minutesAgo = Math.floor((Date.now() - new Date(row.created_at).getTime()) / (60 * 1000));
  return { product, minutesAgo };
}
