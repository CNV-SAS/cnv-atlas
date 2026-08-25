// PROXIMO CONTROL (pieza 1 del cotejo de Seguimiento, 2026-08-25). Modulo NEUTRO y PURO: la parte que
// decide QUE fecha se sugiere, separada de la lectura y de la escritura para poder probarla sin BD.
//
// La sugerencia sale de la FRECUENCIA de la ruta primaria activa ("Cada 90 días"), como en su archivo, no
// de un numero fijo. Y se suma a la fecha de la MEDICION de esta consulta, no a hoy: una evaluacion
// corregida meses despues tiene created_at de hoy, y sumar sobre eso agendaria la cita en el futuro
// equivocado (misma ancla que ya usa comparison-chronology).

export type ProximoControlRuta = {
  id: string;
  label: string;
  frecuencia: string;
  criterioEgreso: string;
  /** R6 no tiene egreso: su objetivo es la PERMANENCIA. La pantalla no lo llama "criterio de egreso". */
  esPermanencia: boolean;
};

/** Dias que declara una frecuencia en texto ("Cada 90 días" -> 90). null si no se puede leer. */
export function diasDeFrecuencia(frecuencia: string | null | undefined): number | null {
  if (!frecuencia) return null;
  const m = /(\d+)/.exec(frecuencia);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Fecha sugerida = fecha de la medicion + los dias de la frecuencia. ISO corto (YYYY-MM-DD). */
export function fechaSugerida(fechaMedicion: string | null, frecuencia: string | null): string | null {
  const dias = diasDeFrecuencia(frecuencia);
  if (dias == null || !fechaMedicion) return null;
  const base = new Date(fechaMedicion);
  if (Number.isNaN(base.getTime())) return null;
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// "Permanencia" y no "egreso": R6 declara que el objetivo es quedarse. Se detecta por el TEXTO del propio
// criterio, no por el id, para que una ruta futura con la misma naturaleza se lea igual sin tocar esto.
const ES_PERMANENCIA = /permanencia/i;

export function rutaPrimaria(
  rutas: { id: string; label: string; seguimiento: { frecuencia: string; criterioEgreso: string } }[],
): ProximoControlRuta | null {
  // La PRIMERA de las activas es la prioritaria (mismo criterio que su archivo: `_rr[0]`).
  const r = rutas[0];
  if (!r) return null;
  return {
    id: r.id,
    label: r.label,
    frecuencia: r.seguimiento.frecuencia,
    criterioEgreso: r.seguimiento.criterioEgreso,
    esPermanencia: ES_PERMANENCIA.test(r.seguimiento.criterioEgreso),
  };
}

export type ProximoControlView = {
  ruta: ProximoControlRuta | null;
  /** La que el profesional CONFIRMO. null = todavia nadie la fijo. */
  citaGuardada: string | null;
  /** La que propone el modelo. Se MUESTRA; no se guarda hasta que el profesional confirme. */
  citaSugerida: string | null;
  fechaMedicion: string | null;
  /** Sin tratamiento no hay donde guardar la cita (el diagnostico todavia no se generó). */
  puedeGuardar: boolean;
};
