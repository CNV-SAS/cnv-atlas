// ═══ QUE SIGNIFICA "PACIENTE DE PRUEBA" (2026-09-25) ═══
//
// MODULO NEUTRO, y existe para que el significado viva en UN SITIO. `patients.is_test` ya existia y se
// respetaba en UNO SOLO (gateaba la facturacion). En todo lo demas un paciente de prueba contaba igual que un
// paciente real: en los conteos del tablero, en la comision, en los pacientes asignados de un integrante.
//
// MARCAR SOLO EXCLUYE DONDE ALGUIEN ESCRIBIO QUE EXCLUYA. Asi que el trabajo nunca fue la casilla: es el
// barrido, y esto es su unica fuente.
//
// ── LA REGLA NO ES "EXCLUIRLO DE TODO", Y ESA ES LA PARTE QUE IMPORTA ──
//
// Si un paciente de prueba desapareciera de la lista del profesional, el profesional NO PODRIA PROBAR, que es
// para lo que lo creo. La regla es mas fina, y son tres capas:
//
//   1 · FUERA DE LAS CIFRAS. Los conteos que alguien lee como "el tamaño de la operacion" no lo cuentan.
//   2 · FUERA DE LO QUE SALE. Nada de el viaja a un dataset de investigacion ni a una factura real.
//   3 · VISIBLE DONDE SE TRABAJA, PERO MARCADO. Sigue en su lista, con su rotulo, porque ahi es util y porque
//       esconderlo seria la forma de que alguien lo confunda con uno real.
//
// La 3 no es una excepcion a la 1: son preguntas distintas. "¿Cuantos pacientes atiende CNV?" no lo incluye;
// "¿a quien puedo abrirle una evaluacion?" si.

// LAS TRES CAPAS NO SON UNA FUNCION, y eso es deliberado. Escribi una (`incluyeDePrueba("cifra")`) y la
// retire el mismo dia: no la llamaba nadie mas que su propio test, o sea un guard sin superficie que lo
// alcance, que es la forma de hacer creer que una regla se aplica. Lo que de verdad la aplica son dos cosas:
// el filtro escrito en cada lectura, y el candado `paciente-de-prueba-barrido` que falla si una cifra nueva
// se escribe sin el.

/** Rotulo del paciente de prueba en una superficie de trabajo. Corto a proposito: acompaña, no grita. */
export const ROTULO_DE_PRUEBA = "De prueba";

export type EstadoDePrueba = {
  esDePrueba: boolean;
  /** Hay una propuesta del profesional esperando a que admin la confirme. */
  propuesto: boolean;
  motivoPropuesto: string | null;
};

/**
 * Lo que hay que mostrarle a quien mira un paciente, en una linea.
 *
 * DISTINGUE PROPUESTO DE MARCADO, y hace falta: mientras admin no confirme, el paciente SIGUE CONTANDO en
 * todo. Si la pantalla dijera "de prueba" desde que el profesional lo propone, la cifra y la pantalla se
 * contradirian, y esa clase de contradiccion ya nos costo un diagnostico equivocado (dos partes que leen
 * fuentes distintas).
 */
export function leyendaDePrueba(e: EstadoDePrueba): string | null {
  if (e.esDePrueba) return `${ROTULO_DE_PRUEBA}. No cuenta en las cifras ni se factura.`;
  if (e.propuesto) {
    return "Propuesto como de prueba, esperando que un administrador lo confirme. Mientras tanto sigue contando en las cifras.";
  }
  return null;
}
