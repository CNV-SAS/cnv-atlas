// ═══ DE QUE LOTES SALE UNA LINEA DE VENTA ═══
//
// Modulo PURO y NEUTRO. Lo usan la reserva del checkout y el descuento al sellar la venta.
//
// ── LA REGLA: SALE PRIMERO LO QUE VENCE PRIMERO, Y UNA LINEA PUEDE SALIR DE VARIOS LOTES ─────────
//
// En un perecedero la respuesta correcta es siempre la misma (FEFO), asi que no se le pregunta al
// profesional; es el mismo criterio de `loteParaEntregar`. La diferencia con la entrega de antes es que
// aquella exigia UN lote que cubriera toda la cantidad y, si no lo habia, avisaba. En la venta eso no sirve:
// con 2 unidades en el lote que vence en marzo y 5 en el de junio, una venta de 3 es legitima, y rechazarla
// dejaria las 2 de marzo en la vitrina hasta vencerse. Cada lote tocado es un movimiento propio, que es lo
// que conserva la trazabilidad hasta el paciente (plan del Bloque 3, 3.2).

export type LoteDisponible = {
  lotId: string;
  /** Fecha de vencimiento ISO (YYYY-MM-DD). */
  vence: string;
  /** Unidades que se pueden tomar: saldo menos reservas vivas de OTRAS ventas. */
  disponible: number;
};

export type Asignacion = { lotId: string; cantidad: number };

export function asignarPorLotes(
  lotes: readonly LoteDisponible[],
  cantidad: number,
): { asignaciones: Asignacion[]; faltante: number } {
  // A igualdad de vencimiento, primero el que mas tiene (deja menos saldos sueltos, como la entrega), y
  // despues el id, para que el resultado no dependa del orden en que la base devolvio las filas.
  const ordenados = lotes
    .filter((l) => l.disponible > 0)
    .sort(
      (a, b) =>
        a.vence.localeCompare(b.vence) || b.disponible - a.disponible || a.lotId.localeCompare(b.lotId),
    );

  const asignaciones: Asignacion[] = [];
  let resta = cantidad;
  for (const l of ordenados) {
    if (resta <= 0) break;
    const toma = Math.min(l.disponible, resta);
    asignaciones.push({ lotId: l.lotId, cantidad: toma });
    resta -= toma;
  }
  return { asignaciones, faltante: Math.max(0, resta) };
}
