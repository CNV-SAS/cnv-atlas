// Tipos y constante de la SERIE de seguimiento. Modulo NEUTRO (sin `server-only`): lo importan el reader
// del servidor, el componente y los tests. Una constante compartida entre el servidor y otra capa no puede
// vivir en el reader server-only (misma razon que los demas `*-types` del proyecto).

/**
 * TOPE de puntos en pantalla. El criterio no es un numero redondo: el intervalo minimo comparable que fijo
 * Gildardo es de 12 semanas, asi que 8 puntos cubren unos DOS AÑOS de seguimiento trimestral, que es un
 * horizonte razonable para una grafica. Verificado contra los datos de hoy (2026-08-25): ningun paciente
 * pasa de DOS evaluaciones, asi que el tope todavia no muerde y es preventivo, no validado contra un caso
 * real. Cuando recorta, se DICE cuantas quedaron fuera: nunca truncar en silencio.
 */
export const SERIE_MAX = 8;

export type PuntoSerie = {
  evaluationId: string;
  fecha: string; // measurement_date
  /** Capacitancia de membrana: el parametro de seguimiento del protocolo. Sale del BIS crudo. */
  c: number | null;
  pabu: number | null;
  icaBis: number | null;
  /** Dominios del DFI (5), para el radar comparativo. */
  dominios: { id: string; nombre: string; sev: number }[] | null;
};

export type SerieSeguimiento = {
  puntos: PuntoSerie[];
  /** Cuantas mediciones quedaron fuera por el tope. 0 = se muestran todas. */
  omitidas: number;
};
