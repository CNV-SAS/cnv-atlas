import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Tablero consolidado de direccion (B14). Solo agregados financieros e inventario, leidos por
// RLS (direccion/admin): transacciones, ingreso CNV, comisiones e inventario. Sin PII: se
// leen montos y cantidades, nunca identificadores del paciente. Los montos numeric llegan
// como texto; se suman en memoria (volumen bajo en el MVP).

export type DireccionDashboard = {
  paidCount: number;
  grossPaid: number; // suma de transactions.amount con status paid
  cnvRevenue: number; // suma de cnv_revenue.amount
  professionalCommissions: number; // suma de professional_revenue.commission_amount
  inventoryUnits: number; // suma de stock_quantity
  inventoryItems: number; // filas de inventario
};

function sum(rows: { v: string | number | null }[]): number {
  return rows.reduce((acc, r) => acc + (Number(r.v) || 0), 0);
}

export async function getDireccionDashboard(): Promise<DireccionDashboard> {
  const supabase = await createSupabaseServerClient();

  const [paid, cnv, commissions, inventory] = await Promise.all([
    supabase.from("transactions").select("amount").eq("status", "paid"),
    supabase.from("cnv_revenue").select("amount"),
    supabase.from("professional_revenue").select("commission_amount"),
    supabase.from("nutraceutical_inventory").select("stock_quantity"),
  ]);

  const paidRows = paid.data ?? [];
  const inventoryRows = inventory.data ?? [];

  return {
    paidCount: paidRows.length,
    grossPaid: sum(paidRows.map((r) => ({ v: r.amount }))),
    cnvRevenue: sum((cnv.data ?? []).map((r) => ({ v: r.amount }))),
    professionalCommissions: sum(
      (commissions.data ?? []).map((r) => ({ v: r.commission_amount })),
    ),
    inventoryUnits: sum(inventoryRows.map((r) => ({ v: r.stock_quantity }))),
    inventoryItems: inventoryRows.length,
  };
}
