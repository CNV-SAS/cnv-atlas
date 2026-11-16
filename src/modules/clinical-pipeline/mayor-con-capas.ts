// ══════════════════════════════════════════════════════════════════════════════════════════════════
// DESDE QUE VERSION DEL MOTOR UN INFORME TIENE QUE TRAER SUS TRES CAPAS  ·  MODULO NEUTRO
//
// ═══ POR QUE VIVE APARTE (2026-11-16) ═══
//
// La regla estaba escrita DOS VECES, con la misma forma y el mismo defecto: `motor like '3.%'` en el
// lector de la pantalla y `startsWith("3.")` en el servicio que escribe. Era correcta el 7 de noviembre,
// cuando el 3.x era el motor del dia. El recalculo del 16 llevo la cohorte entera a 4.0.0, y con eso las
// dos comparaciones pasaron a mirar un conjunto VACIO: **el mismo defecto, en la misma operacion, se
// habria vuelto invisible**, y ninguna de las dos habria fallado.
//
// Es la version de la fecha escrita a mano. Lo que no envejece es el UMBRAL con su razon: las tres capas
// (`rutasContent`, `efrContent`, `validityCaveats`) existen desde el mayor 3, asi que todo informe
// sellado con 3 o mas tiene que traerlas, y ninguno anterior. Un informe de una era previa nacio sin
// ellas porque no existian, y reescribir el pasado es lo que la regla 7 prohibe.
//
// Y EL MAYOR SE EXTRAE CON UNA EXPRESION, no partiendo por el punto: en produccion conviven dos grafias
// (`1.0.0` y `anibise-1.4.0`), y partir la segunda da "anibise-1", que ni siquiera es un numero.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El MAYOR del motor a partir del cual un informe TIENE que traer las tres capas congeladas. */
export const MAYOR_DESDE_EL_QUE_HAY_CAPAS = 3;

/** El MAYOR de una version del motor, con las dos grafias de produccion. `null` si no se puede leer. */
export function mayorDelMotor(version: string | null | undefined): number | null {
  const m = /(\d+)\.\d+/.exec(String(version ?? ""));
  return m ? Number(m[1]) : null;
}

/**
 * Si un informe sellado con esa version del motor TIENE que traer las tres capas.
 *
 * Sin version legible devuelve `false`: no se repara lo que no se puede fechar.
 */
export function tieneQueTraerLasCapas(version: string | null | undefined): boolean {
  const mayor = mayorDelMotor(version);
  return mayor != null && mayor >= MAYOR_DESDE_EL_QUE_HAY_CAPAS;
}
