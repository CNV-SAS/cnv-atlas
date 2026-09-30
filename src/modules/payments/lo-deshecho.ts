// ═══ LO QUE SE DESHIZO: LAS CLASES, Y POR QUE NO SON TODAS LA MISMA COSA ═══
//
// TypeScript puro: los nombres y la tasa. Las cifras las trae el lector.
//
// LA PREGUNTA DE SANTIAGO: "¿cuantas se anularon, cuantas se devolvieron, cuantas terminaron en
// contracargo?". Al medirlo contra la base aparecieron CUATRO situaciones distintas donde la pregunta
// suponia dos, y mezclarlas daria una tasa de reversion inflada con cosas que no revirtieron nada:
//
//   1. LA VENTA SE DESHIZO Y HUBO PLATA DE POR MEDIO. Es `sale_reversals`: contracargo, anulacion de la
//      pasarela y devolucion del paciente. Aqui alguien compro y despues dejo de haber comprado.
//   2. EL LINK SE ANULO A MANO ANTES DE COBRARSE. Nadie compro, asi que no se deshizo una venta: se
//      descarto un intento. Es lo que hizo Maria Camila con LUVIA.
//   3. EL LINK SE ANULO PORQUE LA VENTA SE COBRO POR OTRO MEDIO. Ni siquiera es un cambio de opinion: la
//      venta SI ocurrio, en efectivo, y el link sobraba. Contarlo como algo deshecho seria al reves.
//   4. EL PAGO NO SE COMPLETO EN LA PASARELA. Nadie anulo nada: el intento murio solo.
//
// ── Y LA QUINTA QUE NO EXISTE, verificada en el codigo (2026-09-30) ──
//
// NO HAY NINGUN PROCESO QUE ANULE LINKS POR VENCIMIENTO. Un link pendiente se queda pendiente para
// siempre si nadie lo paga ni lo anula. Asi que la distincion "lo anulo el profesional o lo anulo el
// sistema" no se puede hacer porque el segundo caso no ocurre; lo que si se distingue es a mano contra
// reemplazado por otro cobro, que son dos hechos de verdad distintos. Los pendientes viejos se cuentan
// aparte, porque son justo los que nadie uso.

export type ClaseDeshecha = "contracargo" | "anulacion_wompi" | "devolucion";

/** Como se llama cada clase en pantalla. Con su estado, porque un contracargo abierto no es uno perdido. */
export const NOMBRE_DE_CLASE: Record<ClaseDeshecha, string> = {
  contracargo: "Contracargo",
  anulacion_wompi: "Anulación de la pasarela",
  devolucion: "Devolución del paciente",
};

export const NOMBRE_DE_ESTADO: Record<string, string> = {
  abierta: "en disputa",
  ganada: "ganada",
  perdida: "perdida",
  devuelta: "recibida",
};

/**
 * La tasa sobre las ventas pagadas del periodo.
 *
 * SIN DENOMINADOR NO DICE NADA: "3 devoluciones" es excelente sobre mil ventas y alarmante sobre diez. Y
 * devuelve null cuando no hay ventas en vez de cero, porque cero por ciento afirmaria que no se deshace
 * nada, que es una conclusion, mientras que "no hay con que compararlo" es la verdad.
 */
export function tasaDeReversion(deshechas: number, pagadas: number): number | null {
  if (pagadas <= 0) return null;
  return Math.round((deshechas / pagadas) * 1000) / 10;
}
