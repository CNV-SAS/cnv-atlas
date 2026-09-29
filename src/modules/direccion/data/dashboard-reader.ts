import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  brutoReconocido,
  COLUMNA_EFECTIVO_NO_RECIBIDO,
  COLUMNA_PRODUCTO_DE_PRUEBA,
  EMBED_PRODUCTO_NO_DE_PRUEBA,
  ESTADO_DEVUELTA,
  ESTADO_DISPUTA_PERDIDA,
  FILTRO_FUERA_DE_REVISION,
} from "@/modules/payments/cobro-reconocido";

// Tablero consolidado de direccion (B14). Solo agregados financieros e inventario, leidos por
// RLS (direccion/admin): transacciones, ingreso CNV, comisiones e inventario. Sin PII: se
// leen montos y cantidades, nunca identificadores del paciente. Los montos numeric llegan
// como texto; se suman en memoria (volumen bajo en el MVP).

export type DireccionDashboard = {
  paidCount: number;
  grossPaid: number; // suma de transactions.amount con status paid
  cnvRevenue: number; // suma de cnv_revenue.amount
  professionalCommissions: number; // suma de professional_revenue.commission_amount
  inventoryUnits: number; // suma de stock_quantity, sin productos de prueba
  inventoryProducts: number; // productos distintos con saldo
  inventoryLocations: number; // ubicaciones con saldo
};

function sum(rows: { v: string | number | null }[]): number {
  return rows.reduce((acc, r) => acc + (Number(r.v) || 0), 0);
}

export async function getDireccionDashboard(): Promise<DireccionDashboard> {
  const supabase = await createSupabaseServerClient();

  const [paid, cnv, perdidas, devueltas, commissions, inventory] = await Promise.all([
    // Sin las ventas en revision: su dinero es un pasivo hasta resolverse (contabilidad, 2026-09-14).
    supabase.from("transactions").select("id, amount").eq("status", "paid").or(FILTRO_FUERA_DE_REVISION).is(COLUMNA_EFECTIVO_NO_RECIBIDO, null),
    supabase.from("cnv_revenue").select("amount"),
    // LAS DISPUTAS PERDIDAS SALEN DEL BRUTO (smoke del 3b, 2026-09-17). El ingreso de CNV y la comision ya bajaban
    // solas, porque se suman de filas de ingreso y la reversa agrega las negativas; el bruto no, porque suma las
    // VENTAS. Una venta cuyo contracargo se perdio es plata que CNV devolvio: contarla en el bruto diria que se
    // facturo algo que ya no existe. Mismo trato que el efectivo no recibido y que lo que esta en revision.
    supabase.from("sale_reversals").select("transaction_id").eq("state", ESTADO_DISPUTA_PERDIDA),
    // LO DEVUELTO POR EL PACIENTE TAMBIEN SALE DEL BRUTO (smoke del 2026-09-29). La disputa perdida ya salia;
    // la devolucion se construyo despues y tiene otro estado, asi que se quedo contando una venta que ya
    // no existe. Se resta `debited_amount` y no la venta entera: una devolucion es por UNIDADES de una
    // linea, y quien devolvio una de cuatro sigue habiendo comprado tres.
    supabase.from("sale_reversals").select("debited_amount").eq("state", ESTADO_DEVUELTA),
    supabase.from("professional_revenue").select("commission_amount"),
    // SIN PRODUCTOS DE PRUEBA (smoke del Bloque 3, 2026-09-14): los "PRUEBA SMOKE BLOQUE 3" de cada smoke dejan
    // saldo que no se puede borrar (movimientos inmutables), y sumaban 18 unidades a la vitrina real.
    supabase
      .from("nutraceutical_inventory")
      .select(`stock_quantity, nutraceutical_id, location_id, ${EMBED_PRODUCTO_NO_DE_PRUEBA}`)
      .eq(COLUMNA_PRODUCTO_DE_PRUEBA, false),
  ]);

  const paidRows = (paid.data ?? []).filter(
    (r) => !new Set((perdidas.data ?? []).map((x) => x.transaction_id)).has(r.id),
  );
  const inventoryRows = inventory.data ?? [];

  return {
    paidCount: paidRows.length,
    // LA CUENTA LA HACE EL MODULO NEUTRO, que es el mismo que usa Inicio: es lo unico que impide que las dos
    // pantallas vuelvan a decir cifras distintas del mismo hecho.
    grossPaid: brutoReconocido({
      pagadas: paid.data ?? [],
      disputasPerdidas: (perdidas.data ?? []).map((r) => r.transaction_id),
      devoluciones: (devueltas.data ?? []).map((r) => r.debited_amount),
    }),
    cnvRevenue: sum((cnv.data ?? []).map((r) => ({ v: r.amount }))),
    professionalCommissions: sum(
      (commissions.data ?? []).map((r) => ({ v: r.commission_amount })),
    ),
    inventoryUnits: sum(inventoryRows.map((r) => ({ v: r.stock_quantity }))),
    // "45 REFERENCIAS" ERAN 45 FILAS DE SALDO (una por ubicacion, producto y lote), y se leia como 45 productos
    // cuando el catalogo tiene 11 y hay saldo de 5. Ahora son productos y ubicaciones, que es lo que se pregunta.
    inventoryProducts: new Set(inventoryRows.filter((r) => Number(r.stock_quantity) > 0).map((r) => r.nutraceutical_id)).size,
    inventoryLocations: new Set(inventoryRows.filter((r) => Number(r.stock_quantity) > 0).map((r) => r.location_id)).size,
  };
}
