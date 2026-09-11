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
  /** Para poder LLEVAR a la evaluacion donde esta el pendiente, no solo nombrarlo. */
  evaluationId: string;
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
 * EL PACIENTE QUE NO TIENE NINGUNA EVALUACION.
 *
 * ═══ EL HUECO QUE ESTO CIERRA (2026-09-10) ═══
 *
 * La primera version derivaba la accion de las evaluaciones, asi que un paciente registrado y nunca
 * evaluado salia con la celda VACIA: la unica fila de la lista que de verdad no tiene nada empezado se
 * leia como si estuviera al dia. Es el caso mas facil de perder, porque no aparece en ninguna cola: no
 * tiene evaluacion que este parada en ningun escalon.
 *
 * ES EL ESCALON CERO de la secuencia, y por eso va con orden 1 (detras de la autorizacion, que sin ella
 * no se puede ni empezar).
 */
const SIN_EVALUACIONES: AccionPendiente = {
  texto: "Iniciar la primera evaluación",
  de: "profesional",
  orden: 1,
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
    return { texto: "Esperando al paciente", de: "paciente", orden: 2 };
  }
  if (!e.tieneBis) return { texto: "Montar BIS", de: "profesional", orden: 3 };
  if (!e.tieneDiagnostico) return { texto: "Generar diagnóstico", de: "profesional", orden: 4 };
  if (e.reporte == null || e.reporte === "draft") {
    return { texto: "Aprobar y enviar el reporte", de: "profesional", orden: 5 };
  }
  // Con el reporte enviado, lo unico que queda es cerrar la consulta.
  return { texto: "Cerrar la consulta", de: "profesional", orden: 6 };
}

export type PendienteDelPaciente = {
  /** La accion mas atrasada de sus evaluaciones vigentes. `null` = no hay nada pendiente. */
  principal: AccionPendiente | null;
  /**
   * La evaluacion donde esta ese pendiente, para que la celda lleve AHI y no a la ficha.
   *
   * `null` cuando el pendiente no es de ninguna evaluacion en concreto: el paciente que no tiene
   * ninguna, o al que le falta la autorizacion (que es del paciente, no de una consulta).
   */
  evaluationId: string | null;
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
  // SE CONSERVA DE QUE EVALUACION ES CADA ACCION: sin eso la celda puede decir "Montar BIS" y no saber a
  // cual de las tres consultas del paciente llevar.
  const acciones = evaluaciones
    .map((e) => ({ accion: accionDeEvaluacion(e), evaluationId: e.evaluationId }))
    .filter((x): x is { accion: AccionPendiente; evaluationId: string } => x.accion != null)
    .sort((a, b) => a.accion.orden - b.accion.orden);

  // NI UNA SOLA EVALUACION: no es que no haya nada pendiente, es que no ha empezado. Ver
  // `SIN_EVALUACIONES`. Se mira sobre la lista ENTERA, no sobre las acciones: un paciente cuya unica
  // evaluacion se abandono tampoco ha empezado nada, y ahi la lista de acciones tambien queda vacia.
  if (evaluaciones.length === 0) {
    return sinAutorizacionVigente
      ? { principal: SIN_AUTORIZACION, evaluationId: null, otras: 1 }
      : { principal: SIN_EVALUACIONES, evaluationId: null, otras: 0 };
  }

  // SIN AUTORIZACION VIGENTE MANDA SOBRE TODO, pero solo si hay algo que hacer con este paciente: a un
  // paciente cerrado y al dia no hay que renovarle nada para seguir, porque no hay nada que seguir.
  if (sinAutorizacionVigente && acciones.length > 0) {
    // LA AUTORIZACION NO ES DE UNA EVALUACION: es del paciente. Llevar a una consulta concreta desde ahi
    // mandaria al sitio donde NO se arregla.
    return { principal: SIN_AUTORIZACION, evaluationId: null, otras: acciones.length };
  }
  return {
    principal: acciones[0]?.accion ?? null,
    evaluationId: acciones[0]?.evaluationId ?? null,
    otras: Math.max(0, acciones.length - 1),
  };
}
