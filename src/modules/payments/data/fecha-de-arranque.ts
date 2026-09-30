import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { desdeElArranque, elMasTardio } from "../arranque";

// ═══ DESDE CUANDO CUENTAN LAS CIFRAS DE RESUMEN (0198) ═══
//
// UNA SOLA FUENTE, y esa es la razon de que este modulo exista en vez de un `select` en cada lector. Dos
// pantallas que leen la misma fecha por caminos distintos terminan diciendo cifras distintas del mismo
// hecho, y eso ya paso dos veces este mes: las 1.903 unidades contra las 1.820, y la venta devuelta que
// salia del bruto de Direccion y no del de Inicio. La regla que quedo de aquello es esta: la cuenta y sus
// insumos se comparten, no se reescriben al lado.
//
// ── LO QUE ESTA FECHA SI HACE Y LO QUE NO ──
//
// SI: recorta las CIFRAS DE RESUMEN de las pantallas (el bruto, el ingreso de CNV, las comisiones del
// periodo, los insights). Responden "¿como va la operacion?", y lo de antes del arranque es de otra cosa.
//
// NO: recortar lo que se le DEBE a alguien. Una comision anterior al arranque sigue siendo plata que hay
// que pagarle al Integrante, y la liquidacion, su cuenta y su comision pendiente la tienen que seguir
// viendo entera. Son dos preguntas distintas y la linea entre ellas es lo que el candado protege.
//
// NO: recortar el INVENTARIO. Un saldo no es un flujo: las unidades que hay hoy estan hoy, las comprara
// quien las comprara. Recortarlo por fecha daria un numero que no es el de ninguna bodega.

/**
 * El dia desde el que se cuenta, o `null` si todavia no se fijo (y entonces se cuenta todo).
 *
 * Se lee en cada peticion a proposito: es un valor que cambia UNA vez en la vida del sistema, y cachearlo
 * costaria mas explicaciones que el `select`.
 */
export async function fechaDeArranque(): Promise<string | null> {
  const [f] = await db.execute<{ fecha: string | null }>(
    sql`select fecha_de_arranque::text as fecha from commercial_config limit 1`,
  );
  return f?.fecha ?? null;
}


// Se reexportan para que quien lee la fecha no tenga que saber que la aritmetica vive en otro archivo.
export { desdeElArranque, elMasTardio };
