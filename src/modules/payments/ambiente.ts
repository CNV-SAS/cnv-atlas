// ═══ DE QUE AMBIENTE ES UNA VENTA, Y DONDE SE PUEDE FACTURAR ═══
//
// Modulo PURO: decide sin hablar con nadie, asi que la regla que impide emitir una factura real por un pago
// de prueba se puede probar entera sin red y sin base.
//
// ── POR QUE EXISTE (2026-09-13, un dia antes de salir a produccion) ─────────────────────────────
//
// El guard de `is_test` mira QUE PACIENTE es. No mira DE QUE AMBIENTE ES EL PAGO. Y la base de produccion
// ya guardaba ventas del smoke: un pago con tarjeta de prueba de Wompi a un paciente real habria quedado
// PERMITIDO al pasar Alegra a produccion, y la cola le habria emitido una factura electronica real por un
// pago que nunca movio dinero.
//
// La regla de este archivo cierra ese caso POR EL PAGO, sin depender de que alguien marque al paciente.

export type WompiEnv = "test" | "produccion";
export type AlegraEnv = "sandbox" | "produccion";

/**
 * El modo del pago, derivado de la llave publica de Wompi con que esta configurado el sistema.
 *
 * LO DESCONOCIDO CUENTA COMO PRUEBA, y es deliberado: una llave ausente o con un prefijo inesperado deja la
 * venta como `test`, que solo se puede facturar en sandbox. Equivocarse hacia ese lado significa una venta
 * real que no se factura y aparece en el panel; equivocarse hacia el otro, una factura fiscal por un pago
 * de juguete. Lo primero se ve y se arregla; lo segundo se deshace con nota credito.
 */
export function wompiEnvDeLaLlave(llavePublica: string | undefined | null): WompiEnv {
  return typeof llavePublica === "string" && llavePublica.startsWith("pub_prod_") ? "produccion" : "test";
}

/** El ambiente de Alegra que corresponde a cada modo de pago. */
const CORRESPONDE: Record<WompiEnv, AlegraEnv> = {
  test: "sandbox",
  produccion: "produccion",
};

/**
 * Si una venta se puede facturar en el ambiente de Alegra que esta configurado. Devuelve el motivo si NO.
 *
 * DOS CONDICIONES, una por cada caso que cerro esta regla:
 *
 *   1. El pago y la factura tienen que ser del MISMO mundo: un pago de prueba no se factura en produccion.
 *   2. Si la venta YA TIENE factura, se toca solo en el ambiente de ESA factura. El id interno de Alegra no
 *      es global: la factura 7 del sandbox no es la factura 7 de produccion, y releerla en el otro ambiente
 *      leeria el documento de otra persona y podria registrarle un pago.
 */
export function motivoSiLaVentaNoEsDeEsteAmbiente(
  venta: { wompiEnv: string; alegraEnv: string | null },
  ambienteActual: string,
): string | null {
  const esperado = CORRESPONDE[venta.wompiEnv as WompiEnv];
  if (!esperado) {
    return `La venta no tiene un modo de pago válido ("${venta.wompiEnv}"). No se factura en ningún ambiente.`;
  }
  if (esperado !== ambienteActual) {
    return venta.wompiEnv === "test"
      ? `Es un pago de PRUEBA y Alegra está en ${ambienteActual}. No se emite: sería una factura fiscal por un pago que no movió dinero.`
      : `Es un pago REAL y Alegra está en ${ambienteActual}. No se emite ahí: su factura va en producción.`;
  }
  if (venta.alegraEnv && venta.alegraEnv !== ambienteActual) {
    return `Su factura es del ambiente ${venta.alegraEnv} y Alegra está en ${ambienteActual}. No se relee: el mismo id sería otra factura.`;
  }
  return null;
}
