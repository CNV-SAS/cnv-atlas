import { sql as dsql } from "drizzle-orm";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS PRODUCTOS DE PRUEBA SE BORRAN AL TERMINAR  ·  2026-11-15
//
// ═══ LO QUE COSTO NO LIMPIARLOS, MEDIDO ═══
//
// En la base local habia **20.302 filas en `nutraceuticals`** contra unos 11 productos reales. Cada
// corrida de la suite de BD dejaba una por caso, y llevaba meses. Los seis fixtures que las dejan, con su
// cuenta del 15 de noviembre:
//
//   TEST ANULAR      12.334  (venta-anulacion-y-revision-db)
//   TEST VENTA        6.525  (venta-inventario)
//   CATALOGO PRUEBA     652  (catalogo-prescribible-db)
//   CATALOGO REAL       326  (catalogo-prescribible-db; OJO: a proposito NO llevan `is_test`)
//   TABLERO PRUEBA      331  (tablero-direccion-inventario-db)
//   BODEGA PRUEBA       119  (tablero-direccion-inventario-db)
//
// ═══ Y EL DAÑO APARECIA EN OTRO SITIO, QUE ES LO QUE LO HIZO CARO ═══
//
// `getOwnInventory` armaba el catalogo con un `id.in.(...)` sin tope, y con veinte mil ids la URL de
// PostgREST se pasaba de largo: `URI too long`. Asi que `saldo-por-lote-db` salia ROJO por una razon que
// no tiene nada que ver con lo que prueba. Un rojo cuyo origen esta en otro archivo y en datos acumulados
// se diagnostica mal (parece un defecto del cambio que uno acaba de hacer) y encima TAPABA el defecto
// real, que era de produccion. El `.in()` ya va por tandas; esto cierra la otra mitad.
//
// ═══ POR QUE UN HELPER Y NO UN `afterAll` EN CADA ARCHIVO ═══
//
// Porque son once archivos los que insertan en `nutraceuticals`, y una limpieza copiada once veces se
// desincroniza en cuanto aparezca una tabla nueva que cuelgue del producto. Aqui el orden de borrado vive
// en UN sitio, con su razon.
//
// ═══ EL BORRADO NECESITA APAGAR LOS TRIGGERS, Y ESO ES DELIBERADO ═══
//
// Los movimientos de inventario son append-only por trigger (registro de custodia) y una venta que movio
// inventario no se puede borrar (FK RESTRICT). Las dos cosas son correctas, y son la razon por la que
// estas filas se quedaron. Asi que el borrado va dentro de UNA transaccion con
// `set local session_replication_role = replica`, que apaga triggers y FK **solo ahi dentro**.
//
// `set local` ES LA PARTE QUE IMPORTA: el pool reparte cada `execute` por una conexion distinta, asi que
// un `set` suelto se lo lleva otra conexion y los deletes correrian con los triggers puestos.
//
// Y NO DEBILITA LO QUE EL TRIGGER PROTEGE: lo que se apaga es la custodia de un movimiento REAL. Aqui se
// borra un fixture propio, por su id, despues de que los casos ya comprobaron el comportamiento del
// trigger.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Los productos que la corrida creo, en orden. Se vacia al limpiar. */
const creados: string[] = [];

/** Se llama justo despues de insertar el producto de prueba. */
export function registrarFixtureDeNutraceutico(nutraceuticalId: string): void {
  creados.push(nutraceuticalId);
}

/**
 * Borra todo lo que cuelga de los productos registrados, y los productos. Idempotente: si no hay nada
 * registrado, no toca la base.
 *
 * Se llama desde un `afterAll` **de nivel de archivo**, no dentro de un `describe`: cuando varios bloques
 * comparten el fixture, un `afterAll` por bloque borraria lo del siguiente a mitad de camino.
 */
export async function limpiarFixturesDeNutraceuticos(): Promise<void> {
  if (creados.length === 0) return;
  const ids = creados.splice(0, creados.length);
  const { db } = await import("@/db");
  // LA LISTA SE ARMA CON `dsql.join`, no interpolando el arreglo: `${ids}` en una plantilla de Drizzle
  // produce una TUPLA (`($1, $2, ...)`), y Postgres responde `cannot cast type record to uuid[]`. Con el
  // join cada id va como su propio parametro, que es lo que un `in (...)` espera.
  const lista = dsql.join(
    ids.map((id) => dsql`${id}`),
    dsql`, `,
  );
  await db.transaction(async (tx) => {
    await tx.execute(dsql`set local session_replication_role = replica`);
    // De lo que cuelga hacia el producto, aunque con las FK apagadas no haga falta el orden: si alguna vez
    // hay que correr esto con los triggers puestos, ya es el bueno.
    await tx.execute(
      dsql`delete from nutraceutical_stock_movements where nutraceutical_id in (${lista})`,
    );
    await tx.execute(
      dsql`delete from nutraceutical_inventory where nutraceutical_id in (${lista})`,
    );
    await tx.execute(
      dsql`delete from transaction_items where nutraceutical_id in (${lista})`,
    );
    // LAS VENTAS QUE QUEDARON SIN ITEMS eran solo de estos productos. Una con items de otros se conserva,
    // que es lo correcto: no es de esta corrida.
    await tx.execute(dsql`
      delete from transactions t
       where not exists (select 1 from transaction_items ti where ti.transaction_id = t.id)
         and t.created_at > now() - interval '2 hours'`);
    await tx.execute(dsql`delete from lots where nutraceutical_id in (${lista})`);
    await tx.execute(dsql`delete from nutraceuticals where id in (${lista})`);
  });
}
