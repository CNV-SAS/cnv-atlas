// ═══ EL SALDO DE UN PRODUCTO ES LA SUMA DE SUS LOTES ═══
//
// Modulo PURO y NEUTRO. Lo usan los tres lectores de saldo del profesional.
//
// ── EL DEFECTO QUE CIERRA (2026-09-13, dormido desde la migracion 0121) ─────────────────────────
//
// La 0121 paso el saldo de (profesional, producto) a (ubicacion, producto, LOTE): un producto con dos lotes
// son DOS filas. Tres lectores siguieron leyendo como si fuera una:
//
//   · `getOwnInventory` y `getOwnStockByIds` armaban un mapa por producto, y el ultimo lote PISABA al
//     anterior: con 30 unidades en un lote y 5 en otro, "Mi inventario" podia decir 5.
//   · `recordDespacho` releia el saldo con `.maybeSingle()`, que con dos filas FALLA; el saldo caia al valor
//     de respaldo (menos la cantidad entregada) y la pantalla avisaba de un negativo que no existia.
//
// Dormido porque la carga inicial creo un solo lote por producto. Despierta con la primera remesa de un
// lote nuevo, y despierto no se ve como error: se ve como un saldo creible y equivocado.

export type FilaDeSaldo = { nutraceutical_id: string; stock_quantity: number };

/** Saldo por producto, SUMANDO todos sus lotes. */
export function saldoPorProducto(filas: readonly FilaDeSaldo[]): Map<string, number> {
  const saldo = new Map<string, number>();
  for (const f of filas) {
    saldo.set(f.nutraceutical_id, (saldo.get(f.nutraceutical_id) ?? 0) + Number(f.stock_quantity));
  }
  return saldo;
}
