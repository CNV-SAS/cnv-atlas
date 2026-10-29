// ══════════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE UNA VENTA CUENTA COMO DE PRUEBA  ·  MODULO NEUTRO
//
// ═══ EL DEFECTO QUE CIERRA (Santiago, 2026-10-28) ═══
//
// Reporto *"ventas duplicadas de Maria Camila: una ya estaba registrada como prueba y otra me aparece
// normal"*. Medido contra produccion: **no estaban duplicadas**. Son tres ventas de tres dias distintos, y
// cada una cuenta de prueba por una razon distinta (una por el paciente, una marcada a mano, y la tercera
// no cuenta). Dos de ellas son OMEGA COMPLEX en efectivo y 214.200 es exactamente 2 x 107.100.
//
// **Lo que de verdad fallaba es que la lista no lo decia.** Con el interruptor de "ver las de prueba"
// encendido, una venta de prueba y una real se ven IGUAL: ni chip, ni razon, nada. Asi que dos ventas
// parecidas del mismo profesional se leen como una duplicada.
//
// ES LA REGLA QUE YA ESTA APLICADA EN TODAS PARTES MENOS AQUI: marcadas, no escondidas (capa 3 de
// `patients/de-prueba.ts`). La lista de pacientes lo hace, la del integrante lo hace, el inventario lo
// hace. /pagos era el unico sitio donde la marca no se veia.
//
// ═══ Y DICE LA RAZON, NO SOLO QUE LO ES ═══
//
// De la razon depende que hacer. Una marcada A MANO se desmarca desde la propia fila. Una derivada del
// PACIENTE no se desmarca ahi: el paciente es de prueba y la venta lo hereda, asi que lo que hay que mirar
// es el paciente. Decir solo "de prueba" en los tres casos deja a quien mira sin saber que boton tiene
// sentido, que es la misma leccion del rotulo de los pacientes derivados.
//
// MODULO NEUTRO (sin `server-only` ni `"use client"`): lo usa la pagina de /pagos, que es de servidor, y
// podria usarlo cualquier superficie de cliente que liste ventas.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Los cuatro hechos que entran en la marca derivada (0203), tal como los trae la fila de la venta. */
export type HechosDeLaVenta = {
  /** La derivada. Si es `false`, no hay nada que explicar. */
  cuentaComoDePrueba: boolean;
  /** Alguien la marco a mano desde la fila (0217). */
  marcadaAMano: boolean;
  /** El profesional que la registro esta marcado de prueba (0199). */
  profesionalDePrueba: boolean;
  /** El paciente cuenta como de prueba (0202). */
  pacienteDePrueba: boolean;
  /** Alguna linea lleva un producto de prueba. */
  productoDePrueba: boolean;
};

/**
 * Por que esta venta no cuenta en las cifras, en una linea. `null` = cuenta normalmente.
 *
 * EL ORDEN ES EL DE LA DECISION, no el de la gravedad: primero lo que una PERSONA decidio (la marca a
 * mano), despues lo que se deriva. Al reves, una venta marcada a mano sobre un paciente de prueba diria
 * "porque el paciente es de prueba" y mandaria a quitar la marca del paciente, que no es lo que pasa.
 */
export function porQueCuentaComoDePrueba(h: HechosDeLaVenta): string | null {
  if (!h.cuentaComoDePrueba) return null;
  if (h.marcadaAMano) return "Marcada a mano como prueba";
  if (h.profesionalDePrueba) return "De prueba porque su profesional lo es";
  if (h.pacienteDePrueba) return "De prueba porque su paciente lo es";
  if (h.productoDePrueba) return "De prueba porque lleva un producto de prueba";
  // NO SE INVENTA UNA RAZON. La derivada puede quedar en `true` por una entrada que todavia no se lee
  // aqui; decir una de las cuatro al azar seria mandar a mirar donde no es.
  return "No cuenta en las cifras";
}

/**
 * Si la marca se puede QUITAR desde la fila.
 *
 * Solo la que una persona puso a mano. Una derivada no se "desmarca": se cambia la entrada de la que sale
 * (el paciente, el profesional o el producto), y ofrecer el boton aqui llevaria a pulsar algo que no hace
 * lo que dice. Misma distincion que el paciente derivado, al que se le ofrece "es real" y no "desmarcar".
 */
export function laMarcaSeQuitaDesdeLaVenta(h: HechosDeLaVenta): boolean {
  return h.marcadaAMano;
}
