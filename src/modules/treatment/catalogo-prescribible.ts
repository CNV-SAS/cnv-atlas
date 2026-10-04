// EL FILTRO DEL CATALOGO QUE SE OFRECE AL PRESCRIBIR Y AL COBRAR. Modulo NEUTRO: lo usan el lector del
// tratamiento, la pantalla de pagos y su test contra la base, que asi prueba el mismo texto que corre y no una
// copia.
//
// ═══ UN PRODUCTO DE PRUEBA SOLO SE LE OFRECE A QUIEN ESTA MARCADO DE PRUEBA (Santiago, 2026-10-04) ═══
//
// EL HALLAZGO: "PRUEBA SMOKE BLOQUE 3" se ofrecia para checkout, venta en efectivo y prescripcion a CUALQUIER
// profesional. O sea que un Integrante real podia venderle a un paciente un producto que no existe.
//
// NO ERA UN DEFECTO DEL CODIGO: que un producto de prueba `en_consultorio` se vendiera fue una decision del
// 2026-10-02 (dejar el producto del smoke usable). LO QUE CAMBIO ES SU RAZON: el smoke pasó a correr con
// ADAPTO-STRESS, que es real, asi que la excepcion dejo de comprar nada y solo dejaba la puerta abierta.
//
// ── POR QUE EL SALDO NO ABRE LA PUERTA, que fue la unica parte que se descarto de la propuesta ──
//
// Se penso tambien "si tiene saldo, que lo vea y lo pueda vender: si lo recibio, la unidad existe". Vale para
// un producto REAL en la vitrina de una cuenta de prueba. NO vale aqui, y la diferencia es la que importa: un
// producto de prueba NO EXISTE, asi que su saldo es tan ficticio como el. Venderlo seria cobrarle a un paciente
// por nada, y con la remesa de admin (que si los ofrece, a proposito) ese saldo es alcanzable para cualquiera.
//
// Lo que se hace con unidades de un producto que no existe es darlas de BAJA, no venderlas.
//
// Y EL INVENTARIO SIGUE MOSTRANDOLAS, que es la otra mitad: ahi la regla es "con saldo siempre", porque esa
// pantalla existe para CONTAR y esconder unidades la haria contradecir el conteo fisico. Contar y vender son
// dos preguntas distintas, y por eso tienen dos reglas.
//
// Oculta ademas los productos de prueba que NO estan a la venta (los "PRUEBA SMOKE BLOQUE 3 (retirado ...)" que
// deja cada smoke y no se pueden borrar). Un producto REAL "aun no disponible" se sigue mostrando: el
// profesional debe saber que el modelo lo contempla (cotejo 2026-08-24).

/**
 * El filtro `or` de PostgREST para el desplegable, segun quien mira.
 *
 * @param profesionalEsDePrueba si la cuenta que prescribe o cobra esta marcada `is_test`.
 */
export function filtroCatalogoPrescribible(profesionalEsDePrueba: boolean): string {
  // UNA CUENTA DE PRUEBA VE LO DE SIEMPRE: los reales, mas los de prueba que estan a la venta. Es el carril
  // que hace posible un smoke sin tocar producto de verdad.
  if (profesionalEsDePrueba) return "is_test.eq.false,commercial_availability.eq.en_consultorio";
  // Y UNA CUENTA REAL, SOLO PRODUCTO REAL. El `or` con un solo termino se escribe igual, para que las dos
  // ramas devuelvan la misma forma y quien llama no tenga que saber cual le toco.
  return "is_test.eq.false";
}

// NO SE DEJA UNA CONSTANTE "POR COMPATIBILIDAD": una que no distinga quien mira es exactamente el filtro que
// se acaba de quitar, y el dia que alguien la importe sin darse cuenta vuelve el agujero sin que nada falle.
// Ya no la usa nadie (verificado), asi que se va.
