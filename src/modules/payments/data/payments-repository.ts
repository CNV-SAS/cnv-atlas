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
