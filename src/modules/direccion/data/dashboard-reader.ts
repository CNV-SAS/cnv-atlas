import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { desdeElArranque, fechaDeArranque } from "@/modules/payments/data/fecha-de-arranque";
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
  /**
   * Desde cuando cuentan las cifras de dinero, o null si se cuenta todo. La pantalla lo DICE: una cifra sin
   * su ventana se lee como "todo el historico", y el dia del arranque eso seria falso.
   */
  desdeElArranque: string | null;
};

function sum(rows: { v: string | number | null }[]): number {
  return rows.reduce((acc, r) => acc + (Number(r.v) || 0), 0);
}

export async function getDireccionDashboard(): Promise<DireccionDashboard> {
  const supabase = await createSupabaseServerClient();

  // ── DESDE EL ARRANQUE (0198), Y EL MISMO CORTE PARA TODAS LAS CIFRAS DE ESTA PANTALLA ──
  //
  // Aplicar el corte a unas y a otras no seria peor que no aplicarlo: seria PEOR, porque un bruto recortado
  // sobre unas comisiones sin recortar hace que las dos cifras midan ventanas distintas y la resta entre
  // ellas deje de significar nada. Es el mismo defecto del "0 de 18" de los insights, en dinero.
  //
  // El inventario NO lleva corte, a proposito: es un saldo, no un flujo. Ver `fecha-de-arranque.ts`.
  const arranque = await fechaDeArranque();
  const desde = desdeElArranque(arranque);

  // ── Y FUERA EL PROFESIONAL DE DEMOSTRACION (0199) ──
  //
  // La fecha limpia el pasado; esto limpia el futuro, porque Demo sigue operando despues del arranque.
  //
  // SE FILTRA EN MEMORIA Y NO CON UN EMBED `!inner`, y no es pereza: una venta puede no tener profesional
  // (las registra admin), y un `!inner` la dejaria fuera EN SILENCIO. El bruto bajaria por una razon que
  // nadie escribio. Son pocos ids y la lista es diminuta.
  const { data: filasDePrueba } = await supabase
    .from("professional_profiles")
    .select("id")
    .eq("is_test", true);
  const dePrueba = new Set((filasDePrueba ?? []).map((p) => p.id));
  const noEsDePrueba = (id: string | null | undefined) => id == null || !dePrueba.has(id);
  const desdeElCorte = <T extends { gte: (c: string, v: string) => T }>(q: T, columna: string): T =>
    desde == null ? q : q.gte(columna, desde);

  const [paid, cnv, perdidas, devueltas, commissions, inventory] = await Promise.all([
    // Sin las ventas en revision: su dinero es un pasivo hasta resolverse (contabilidad, 2026-09-14).
    desdeElCorte(
      supabase.from("transactions").select("id, amount, professional_id").eq("status", "paid").or(FILTRO_FUERA_DE_REVISION).is(COLUMNA_EFECTIVO_NO_RECIBIDO, null),
      "created_at",
    ),
    desdeElCorte(supabase.from("cnv_revenue").select("amount, transactions!inner(professional_id)"), "created_at"),
    // LAS DISPUTAS PERDIDAS SALEN DEL BRUTO (smoke del 3b, 2026-09-17). El ingreso de CNV y la comision ya bajaban
    // solas, porque se suman de filas de ingreso y la reversa agrega las negativas; el bruto no, porque suma las
    // VENTAS. Una venta cuyo contracargo se perdio es plata que CNV devolvio: contarla en el bruto diria que se
    // facturo algo que ya no existe. Mismo trato que el efectivo no recibido y que lo que esta en revision.
    supabase.from("sale_reversals").select("transaction_id").eq("state", ESTADO_DISPUTA_PERDIDA),
    // LO DEVUELTO POR EL PACIENTE TAMBIEN SALE DEL BRUTO (smoke del 2026-09-29). La disputa perdida ya salia;
    // la devolucion se construyo despues y tiene otro estado, asi que se quedo contando una venta que ya
    // no existe. Se resta `debited_amount` y no la venta entera: una devolucion es por UNIDADES de una
    // linea, y quien devolvio una de cuatro sigue habiendo comprado tres.
    //
    // Y ACOTADA AL MISMO CORTE QUE LAS VENTAS, por la fecha de LA VENTA y no la de la devolucion: restar
    // una devolucion de una venta anterior al arranque bajaria un bruto que nunca subio, y la cifra
    // quedaria mal por el lado contrario. Es la leccion que ya estaba escrita en la tarjeta del mes.
    desdeElCorte(
      supabase
        .from("sale_reversals")
        .select("debited_amount, transactions!inner(created_at, professional_id)")
        .eq("state", ESTADO_DEVUELTA),
      "transactions.created_at",
    ),
    desdeElCorte(supabase.from("professional_revenue").select("commission_amount, professional_id"), "created_at"),
    // SIN PRODUCTOS DE PRUEBA (smoke del Bloque 3, 2026-09-14): los "PRUEBA SMOKE BLOQUE 3" de cada smoke dejan
    // saldo que no se puede borrar (movimientos inmutables), y sumaban 18 unidades a la vitrina real.
    supabase
      .from("nutraceutical_inventory")
      .select(`stock_quantity, nutraceutical_id, location_id, ${EMBED_PRODUCTO_NO_DE_PRUEBA}`)
      .eq(COLUMNA_PRODUCTO_DE_PRUEBA, false),
  ]);

  // ── LAS CUATRO CIFRAS DE DINERO SE FILTRAN IGUAL, y tiene que ser igual ──
  //
  // Un bruto sin Demo sobre unas comisiones con Demo hace que la resta entre ellas deje de significar nada.
  // Es la misma razon por la que el corte de fecha va a todas a la vez.
  const uno = <T,>(e: T | T[] | null | undefined): T | undefined =>
    Array.isArray(e) ? e[0] : (e ?? undefined);
  const deLaVenta = (fila: { transactions?: unknown }): string | null =>
    uno(fila.transactions as { professional_id: string | null } | null)?.professional_id ?? null;

  const pagadas = (paid.data ?? []).filter((r) => noEsDePrueba(r.professional_id));
  const paidRows = pagadas.filter(
    (r) => !new Set((perdidas.data ?? []).map((x) => x.transaction_id)).has(r.id),
  );
  const cnvRows = (cnv.data ?? []).filter((r) => noEsDePrueba(deLaVenta(r)));
  const commissionRows = (commissions.data ?? []).filter((r) => noEsDePrueba(r.professional_id));
  const devueltasRows = (devueltas.data ?? []).filter((r) => noEsDePrueba(deLaVenta(r)));
  // EL INVENTARIO NO SE FILTRA POR PROFESIONAL, a proposito: las unidades de Demo son reales y estan en su
  // bodega. Sacarlas daria un numero que no cuadra con ningun conteo fisico. Ver `professionals/de-prueba`.
  const inventoryRows = inventory.data ?? [];

  return {
    paidCount: paidRows.length,
    // LA CUENTA LA HACE EL MODULO NEUTRO, que es el mismo que usa Inicio: es lo unico que impide que las dos
    // pantallas vuelvan a decir cifras distintas del mismo hecho.
    grossPaid: brutoReconocido({
      pagadas,
      disputasPerdidas: (perdidas.data ?? []).map((r) => r.transaction_id),
      devoluciones: devueltasRows.map((r) => r.debited_amount),
    }),
    cnvRevenue: sum(cnvRows.map((r) => ({ v: r.amount }))),
    professionalCommissions: sum(commissionRows.map((r) => ({ v: r.commission_amount }))),
    inventoryUnits: sum(inventoryRows.map((r) => ({ v: r.stock_quantity }))),
    // "45 REFERENCIAS" ERAN 45 FILAS DE SALDO (una por ubicacion, producto y lote), y se leia como 45 productos
    // cuando el catalogo tiene 11 y hay saldo de 5. Ahora son productos y ubicaciones, que es lo que se pregunta.
    inventoryProducts: new Set(inventoryRows.filter((r) => Number(r.stock_quantity) > 0).map((r) => r.nutraceutical_id)).size,
    inventoryLocations: new Set(inventoryRows.filter((r) => Number(r.stock_quantity) > 0).map((r) => r.location_id)).size,
    desdeElArranque: arranque,
  };
}
