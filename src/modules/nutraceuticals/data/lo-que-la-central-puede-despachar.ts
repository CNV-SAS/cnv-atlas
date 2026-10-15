import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";

import type { DisponibleEnCentral } from "../remesa-types";

// ═══ LO QUE LA BODEGA CENTRAL PUEDE DESPACHAR DE VERDAD (Santiago, 2026-10-15) ═══
//
// Su decision, textual: *"no deberia dejar cargar nutraceuticos que no esten en central"*. Es la mitad barata
// de la remesa que descuenta de la central: no mueve saldos ni toca la RLS, solo se niega a declarar un envio
// de unidades que la bodega no tiene.
//
// ── POR QUE EL SALDO DE LA CENTRAL NO SIRVE SOLO, Y HAY QUE RESTAR ──────────────────────────────
//
// El saldo de una ubicacion es la SUMA de sus movimientos (trigger `nutra_movement_apply`) EXCLUYENDO los de
// tipo `remesa`. Y una remesa se declara sobre la ubicacion del INTEGRANTE, no sobre la central. O sea que
// cuando salen cien unidades de la bodega, el saldo de la bodega no se mueve ni un gramo: la remesa es un
// anuncio, no un traslado. Por eso "lo que la central puede despachar" no es su saldo.
//
// ── LA PREGUNTA DE SANTIAGO, QUE CORRIGIO ESTE ARCHIVO ──────────────────────────────────────────
//
// Yo habia dicho "el saldo MENOS LO YA DECLARADO SIN CONFIRMAR", y el pregunto: *"como hoy la confirmacion NO
// descuenta de central, confirma que la resta NO SE SUELTA cuando el Integrante confirma. Si se suelta, la
// misma unidad vuelve a estar disponible para una segunda remesa y la comprobacion solo tapa el caso de las
// remesas simultaneas."*
//
// TIENE RAZON Y ESTABA MAL. Con "sin confirmar", al confirmar la remesa sale del conjunto restado y la central
// vuelve a ofrecer unas unidades que ya se fueron. Asi que se restan TODAS las remesas de ese (producto,
// lote), confirmadas o no. Nada se suelta nunca, porque la confirmacion no devuelve nada a la bodega.
// Su candado es el tercer caso de `la-central-no-despacha-lo-que-no-tiene-db.test.ts`.
//
// ── POR QUE NO HACE FALTA NINGUNA FECHA DE CORTE ────────────────────────────────────────────────
//
// Restar TODAS las remesas seria doble resta si alguna ya estuviera descontada del saldo. MEDIDO en la nube el
// 2026-10-15, y la condicion que importa es esta: NINGUNA remesa de la historia salio de un lote que la central
// tuviera. Las 14 que existen son de ADAPTO-STRESS (129 unidades, un producto del catalogo que todavia no
// existe fisicamente) y de PRUEBA SMOKE, y la central nunca cargo ninguno de esos lotes. De los cinco
// productos de bodega (MULTI-CELL, OMEGA, CURCUMIN, D3-K2 y LUVIA) no hay una sola remesa: las 525 unidades de
// las siete vitrinas entraron antes de que existiera el mecanismo, y la carga de la central del 2026-09-11 ya
// se hizo con el remanente (*"saldo en bodega central tras la primera entrega a Integrantes"*).
//
// O sea que para cada (producto, lote) con saldo POSITIVO en la central, la suma de remesas es CERO hoy, y el
// disponible coincide con el saldo. No hay nada que indultar, y por eso esto no necesita una constante de
// corte como `REMESA_LAUNCH_ISO`.
//
// EL UNICO RESIDUO es ADAPTO-STRESS lote `aaaaa`, con saldo 0 y 2 declaradas: da disponible -2. No es doble
// resta (la central nunca tuvo esas dos), y el efecto es el correcto: no se puede volver a despachar de un
// lote que la bodega no tiene.
//
// ── Y LA RESTA SE MANTIENE SOLA DESPUES ─────────────────────────────────────────────────────────
//
// Una devolucion del Integrante entra a la central como `devolucion` (+N en su saldo) y la resta de remesas no
// cambia: el disponible sube N, que es lo correcto porque las unidades volvieron. Una venta a domicilio baja
// el saldo y baja el disponible. Una conciliacion lo cuadra contra el conteo. Nada pide mantenimiento.
//
// LO QUE ESTO NO ARREGLA es que el total del sistema crezca con cada recepcion (el hueco de la seccion 2 del
// smoke). Eso pide que la remesa mueva saldo de verdad, con una ubicacion de transito, y es el modulo grande.
//
// ── POR QUE DRIZZLE CON EL OWNER Y NO EL CLIENTE DE SUPABASE ────────────────────────────────────
//
// La primera version leia por PostgREST y sumaba las remesas en memoria, filtrando por `in(lotes)`. CONTRA LA
// BASE REAL REVENTO: la central tiene cientos de filas de saldo, la URL paso del limite del servidor y la
// respuesta llego con "URI too long". El error venia en `error`, no como excepcion, asi que la suma quedaba en
// CERO Y EL FRENO DEJABA PASAR TODO. Lo atrapo el candado nuevo, no tsc.
//
// La suma correcta es un `group by` del lado del servidor, que PostgREST no hace. Asi que esto va con Drizzle,
// como `facturacion-repository`. Sin RLS: las dos puertas que llegan aqui ya estan cerradas por policy
// (`canDeclararRemesa` y `canSeeRemesasCnv`) y por la propia RLS de insercion, que solo deja declarar una
// remesa a admin o soporte. Lo que se lee son conteos de bodega, sin un dato de paciente.

/** La bodega central. Hay UNA, garantizada por indice unico parcial (`loc_una_central`, migracion 0120). */
const LA_CENTRAL = sql`(select id from inventory_locations where kind = 'central' and is_active limit 1)`;

/**
 * TODO lo que se ha declarado en remesas de ese (producto, lote), CONFIRMADO O NO.
 *
 * UNA SOLA DEFINICION para el cuadro de la pantalla y para el freno, por la misma razon que los predicados de
 * la cola de facturacion: dos copias de la misma resta divergen la primera vez que la resta cambie, y la
 * pantalla diria un numero que el freno no respeta.
 */
const yaDeclarado = (nutraceutical: SQL, lote: SQL): SQL => sql`
  coalesce((select sum(m.delta) from nutraceutical_stock_movements m
             where m.type = 'remesa'
               and m.nutraceutical_id = ${nutraceutical}
               and m.lot_id = ${lote}), 0)::int`;

/**
 * TODO lo que la central puede despachar, por (producto, lote). Para que la pantalla lo DIGA antes de que
 * alguien teclee una cantidad: un freno que aparece al enviar, sobre un numero que no estaba a la vista, se
 * siente como un defecto y no como una regla.
 */
export async function loQueLaCentralPuedeDespachar(): Promise<DisponibleEnCentral[]> {
  const filas = await db.execute<{
    nutraceutical_id: string;
    nombre: string;
    es_de_prueba: boolean;
    lot_id: string;
    lote: string;
    saldo: number;
    ya_declarado: number;
  }>(sql`
    select i.nutraceutical_id,
           n.name as nombre,
           n.is_test as es_de_prueba,
           i.lot_id,
           l.code as lote,
           i.stock_quantity::int as saldo,
           ${yaDeclarado(sql`i.nutraceutical_id`, sql`i.lot_id`)} as ya_declarado
      from nutraceutical_inventory i
      join nutraceuticals n on n.id = i.nutraceutical_id
      join lots l on l.id = i.lot_id
     where i.location_id = ${LA_CENTRAL}
     order by n.is_test, n.name, l.code`);

  return filas.map((f) => ({
    nutraceuticalId: String(f.nutraceutical_id),
    nombre: String(f.nombre),
    esDePrueba: Boolean(f.es_de_prueba),
    lotId: String(f.lot_id),
    lote: String(f.lote),
    saldo: Number(f.saldo),
    yaDeclarado: Number(f.ya_declarado),
    disponible: Number(f.saldo) - Number(f.ya_declarado),
  }));
}

/**
 * EL FRENO: devuelve el motivo si la central no tiene esas unidades, o `null` si el envio cabe.
 *
 * SE LLAMA ANTES DE RESOLVER EL LOTE, a proposito: `resolverLoteDeRecepcion` CREA el lote cuando no existe, y
 * crearlo para despues rechazar la remesa dejaria un lote provisional huerfano por cada intento.
 *
 * EL PRODUCTO DE PRUEBA QUEDA EXENTO, y no es una grieta: un producto de prueba NO TIENE BODEGA FISICA que
 * proteger, y sus unidades existen solo para poder volver a probar. Con el tope puesto se cerraria el unico
 * camino para recargar una vitrina de prueba dentro de produccion, que existe a proposito (Santiago,
 * 2026-10-01).
 */
export async function motivoSiLaCentralNoTieneEsasUnidades(input: {
  nutraceuticalId: string;
  lote: string | null;
  quantity: number;
}): Promise<string | null> {
  const code = (input.lote ?? "").trim();
  // Sin lote no decide esta regla: quien llama ya lo exige, con un mensaje escrito para su pantalla.
  if (!code) return null;

  // UNA SOLA CONSULTA, y devuelve fila AUNQUE EL LOTE NO EXISTA (los dos `left join`): si no la devolviera,
  // el caso "la central no conoce ese lote" se confundiria con "no existe el producto".
  const [fila] = await db.execute<{
    nombre: string;
    es_de_prueba: boolean;
    centrales: number;
    lot_id: string | null;
    saldo: number;
    ya_declarado: number;
  }>(sql`
    select n.name as nombre,
           n.is_test as es_de_prueba,
           (select count(*)::int from inventory_locations where kind = 'central' and is_active) as centrales,
           lo.id as lot_id,
           coalesce(inv.stock_quantity, 0)::int as saldo,
           ${yaDeclarado(sql`n.id`, sql`lo.id`)} as ya_declarado
      from nutraceuticals n
      left join lots lo on lo.nutraceutical_id = n.id and lo.code = ${code}
      left join nutraceutical_inventory inv
             on inv.nutraceutical_id = n.id
            and inv.lot_id = lo.id
            and inv.location_id = ${LA_CENTRAL}
     where n.id = ${input.nutraceuticalId}`);

  if (!fila) return "No se encontró ese producto.";
  if (fila.es_de_prueba) return null;
  if (Number(fila.centrales) !== 1) {
    // NO SE DEJA PASAR: declarar a ciegas es justo lo que esta comprobacion existe para evitar.
    return "No se pudo identificar la bodega central, así que no se puede verificar el saldo. Avisa a soporte.";
  }
  if (!fila.lot_id) {
    return `La bodega central no tiene registrado el lote "${code}" de ${fila.nombre}. Hay que registrar su entrada a la bodega antes de despacharlo.`;
  }

  const saldo = Number(fila.saldo);
  const declarado = Number(fila.ya_declarado);
  const disponible = saldo - declarado;
  if (input.quantity <= disponible) return null;

  const quedan = Math.max(0, disponible);
  const cabeza = `La bodega central tiene ${quedan} ${
    quedan === 1 ? "unidad" : "unidades"
  } disponibles del lote "${code}" de ${fila.nombre}, y esta remesa pide ${input.quantity}.`;
  // LA SEGUNDA FRASE EXPLICA LA DIFERENCIA con el saldo que se ve en otras pantallas. Sin ella, el numero de
  // aqui contradice al de /nutraceuticos y se lee como un error del sistema.
  return declarado > 0
    ? `${cabeza} Su saldo es ${saldo} y ya se declararon ${declarado} en remesas de ese lote, que todavía no lo descuentan.`
    : cabeza;
}
