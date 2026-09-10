// ═══ QUE LE FALTA A CADA PACIENTE, DICHO COMO ACCION ═══
//
// Instruccion de Santiago (2026-09-10): "LA COLUMNA DICE LA ACCION, no el estado. 'Montar BIS', 'Generar
// diagnostico', 'Responder encuesta'". La diferencia no es de redaccion: un estado ("in_progress") obliga
// a traducir mentalmente que toca hacer, y esa traduccion es justo el trabajo que la columna existe para
// ahorrar.
//
// MODULO NEUTRO Y PURO: sin BD, sin React. Lo alimenta el lector de la lista y lo consume la vista, y asi
// la regla se puede probar corriendola en vez de leyendo la pantalla.
//
// ── CUANTAS ACCIONES DISTINTAS SALEN, que era lo que habia que verificar ────────────────────────────
//
// SEIS, y solo UNA aplica a la vez por evaluacion, porque son los pasos de una secuencia: la consulta
// avanza de una a la siguiente. Por eso caben en una columna: no es una lista de seis casillas, es un
// puntero al escalon en el que esta parada.
//
// Lo que SI puede pasar es que un paciente tenga VARIAS evaluaciones paradas (73 pacientes y 83
// evaluaciones vigentes en produccion). Ahi la columna dice la mas urgente y cuenta las demas.
//
// ── EL ORDEN ES EL DE LA CONSULTA, no una prioridad inventada ───────────────────────────────────────
//
// Salvo el primero: la autorizacion vigente va delante de todo porque sin ella no se puede ni empezar
// (regla dura 15), asi que cualquier otra accion que se ofrezca seria un callejon.

/** Lo que se sabe de UNA evaluacion vigente para decidir que le falta. */
export type EvaluacionPendiente = {
  status: string;
  tieneBis: boolean;
  tieneDiagnostico: boolean;
  /** Estado del reporte, si existe. `null` = todavia no hay reporte. */
  reporte: string | null;
};

export type AccionPendiente = {
  /** Lo que hay que hacer, en imperativo. Es lo que se pinta en la columna. */
  texto: string;
  /**
   * De quien es el siguiente paso. `paciente` = no hay nada que el profesional pueda pulsar, y decirlo
   * evita que se lea como trabajo suyo atrasado.
   */
  de: "profesional" | "paciente";
  /** Posicion en la secuencia. Menor = mas atras, y por tanto mas urgente. */
  orden: number;
};

const SIN_AUTORIZACION: AccionPendiente = {
  texto: "Renovar autorización",
  de: "profesional",
  orden: 0,
};

/**
 * Que le falta a UNA evaluacion. `null` = nada (esta cerrada o al dia).
 *
 * `awaiting_survey` y `abandoned` NO son pasos del profesional: el primero espera al paciente y el
 * segundo se abandono a proposito. El abandonado no genera pendiente ninguno.
 */
export function accionDeEvaluacion(e: EvaluacionPendiente): AccionPendiente | null {
  if (e.status === "abandoned") return null;
  if (e.status === "completed") return null;
  if (e.status === "awaiting_survey") {
    // NO ES UNA ACCION SUYA y por eso lo dice: el paciente firmo y todavia no respondio. Escribir aqui
    // "Responder encuesta" en imperativo le atribuiria al profesional un trabajo que no es suyo.
    return { texto: "Esperando al paciente", de: "paciente", orden: 1 };
  }
  if (!e.tieneBis) return { texto: "Montar BIS", de: "profesional", orden: 2 };
  if (!e.tieneDiagnostico) return { texto: "Generar diagnóstico", de: "profesional", orden: 3 };
  if (e.reporte == null || e.reporte === "draft") {
    return { texto: "Aprobar y enviar el reporte", de: "profesional", orden: 4 };
  }
  // Con el reporte enviado, lo unico que queda es cerrar la consulta.
  return { texto: "Cerrar la consulta", de: "profesional", orden: 5 };
}

export type PendienteDelPaciente = {
  /** La accion mas atrasada de sus evaluaciones vigentes. `null` = no hay nada pendiente. */
  principal: AccionPendiente | null;
  /** Cuantas OTRAS evaluaciones suyas tienen algo pendiente, ademas de la principal. */
  otras: number;
};

/**
 * Lo que le falta a un paciente: la accion mas atrasada de sus evaluaciones, y cuantas mas hay.
 *
 * LA MAS ATRASADA Y NO LA MAS RECIENTE: si una consulta se quedo sin BIS hace tres semanas y la de ayer
 * espera el reporte, lo que hay que atender primero es la vieja. El orden de la secuencia YA es el de
 * urgencia; no hace falta una segunda escala.
 */
export function pendienteDelPaciente(
  evaluaciones: EvaluacionPendiente[],
  sinAutorizacionVigente: boolean,
): PendienteDelPaciente {
  const acciones = evaluaciones
    .map(accionDeEvaluacion)
    .filter((a): a is AccionPendiente => a != null)
    .sort((a, b) => a.orden - b.orden);

  // SIN AUTORIZACION VIGENTE MANDA SOBRE TODO, pero solo si hay algo que hacer con este paciente: a un
  // paciente cerrado y al dia no hay que renovarle nada para seguir, porque no hay nada que seguir.
  if (sinAutorizacionVigente && acciones.length > 0) {
    return { principal: SIN_AUTORIZACION, otras: acciones.length };
  }
  return { principal: acciones[0] ?? null, otras: Math.max(0, acciones.length - 1) };
}
