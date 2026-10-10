// PENDIENTES DE LA CONSULTA (cierre, 2026-08-24). Modulo NEUTRO y PURO: recibe el estado ya leido y
// devuelve la lista. No consulta nada, asi que se puede probar entero sin BD.
//
// Tres estados, y la distincion es el punto del bloque: una lista que mezcla lo que se puede hacer con lo
// que no se puede hacer todavia obliga al profesional a averiguar cual es cual, y entonces no la lee.
//
//   ACCIONABLE   -> esta en la lista con su enlace: se resuelve ahora.
//   BLOQUEADO    -> esta en la lista, diciendo QUE lo desbloquea. No se puede hacer hoy, pero va a poder.
//   IMPOSIBLE    -> NO aparece. No es que falte: es que en esta evaluacion no puede existir.
//
// El tercero usa la MISMA condicion con la que el sistema ya rechaza el acto (sin `protocol_suggested` no
// hay prescripcion que emitir: el writer de emisiones lanza "No se puede emitir una prescripción que nunca
// se computó"). Listarlo para siempre seria pedirle al profesional algo que el sistema le prohibe, en cada
// consulta, hasta el fin de los tiempos.
//
// Y el TONO importa: el profesional puede cerrar con pendientes A PROPOSITO (el paciente se lo piensa, la
// remision depende de otro). La lista informa, no reprocha; por eso ningun texto dice "falta" ni "debes".

export type PendienteCierre = {
  id: string;
  titulo: string;
  detalle: string;
  /** Ancla dentro de la evaluacion, para ir a resolverlo. null cuando esta bloqueado por otra cosa. */
  etapa: string | null;
  bloqueadoPor: string | null;
};

export type EstadoConsulta = {
  encuestaCompleta: boolean;
  /** El protocolo se pudo computar (protocol_suggested). Si es false, entregarlo es IMPOSIBLE, no pendiente. */
  protocoloComputado: boolean;
  /** ¿Se le entregó el plan al paciente (impreso o por correo)? Sustituye a `protocoloAprobado`. */
  protocoloEmitido: boolean;
  /** null = la evaluacion no llego a generar reporte. */
  reporteEstado: "draft" | "approved" | "sent" | null;
  /** Decision sobre nutraceuticos: null = nunca se pregunto. */
  /**
   * La decision registrada, que despues del rediseño del 2026-09-26 solo puede ser "no" (o nula): la pregunta de
   * tres opciones se retiro y el "si" YA NO SE DECLARA, se demuestra con la venta.
   */
  nutraceuticosDecision: "si" | "no" | "pendiente" | null;
  /**
   * Si esta consulta tiene una venta de nutraceuticos. ES EL "SI", y por eso entra aqui: un hecho (el paciente
   * pago y se los llevo) vale mas que una casilla marcada, y ademas no hay que acordarse de marcarla.
   */
  hayVentaDeNutraceuticos: boolean;
  /**
   * El profesional registró que NO prescribe nutracéuticos en esta consulta (0214). Es la tercera vía que
   * resuelve este pendiente, y es la ÚNICA que se puede registrar hoy: `nutraceuticosDecision` quedó
   * congelado el 2026-10-10.
   */
  sinPrescripcion: boolean;
  proximaCita: string | null;
  remisionesSinRetorno: number;
};

export function pendientesDeLaConsulta(e: EstadoConsulta): PendienteCierre[] {
  const out: PendienteCierre[] = [];

  if (!e.encuestaCompleta) {
    out.push({
      id: "encuesta",
      titulo: "La encuesta quedó incompleta",
      detalle:
        "Con la encuesta a medias, el diagnóstico no emite el resumen funcional ni la meta terapéutica.",
      etapa: "evaluacion",
      bloqueadoPor: null,
    });
  }

  // EL PENDIENTE DE "EL DIAGNOSTICO NO SE CONFIRMO" SE RETIRO (2026-09-10).
  //
  // Apuntaba a un acto que ya no existe: confirmar dejo de ser un boton. Dejarlo listaria para siempre
  // algo que el profesional no puede hacer, que es justo lo que el tercer estado de este archivo
  // (IMPOSIBLE) existe para evitar.
  //
  // Y NO SE PIERDE NADA: desde el 2026-09-18 el diagnostico NACE FIRMADO, con quien lo genero y su
  // profesion (`pipeline-writer`), asi que no hay un momento en que este sin responsable.

  // EL PENDIENTE CAMBIO DE HECHO (2026-09-09): antes era "el tratamiento no se aprobó" y ahora es "el
  // plan no se le entregó al paciente".
  //
  // POR QUE NO ES EL MISMO PENDIENTE CON OTRO NOMBRE. Aprobar era un tramite interno: el paciente no se
  // enteraba de que ocurriera. Entregar es el hecho que le importa a la persona, y ademas es el que
  // sostiene la historia clinica (sin emision, el documento sale con las cifras de hoy). Cerrar una
  // consulta sin haber entregado nada es lo que de verdad merece aparecer en la lista.
  //
  // ═══ Y ESTE PENDIENTE SE RETIRA (Santiago, smoke del 2026-10-04) ═══
  //
  // SU RAZON, y es buena: muchos profesionales entregan su PROPIO plan de alimentacion, con su plantilla.
  // Que Atlas no conste la entrega del suyo no significa que el paciente se fuera sin plan, asi que listarlo
  // era afirmar un hueco que la mayoria de las veces no existe.
  //
  // Y UNA LISTA DE PENDIENTES VIVE DE QUE TODO LO QUE TRAE SEA CIERTO: una linea que sale casi siempre y casi
  // siempre no es nada entrena a cerrar la consulta sin leerla, y entonces el dia que aparezca una de verdad
  // (la venta sin despachar, la nota credito) se va a cerrar igual. El costo de un pendiente falso no es el
  // ruido, es que desarma a los demas.
  //
  // LO QUE NO SE PIERDE: la historia clinica SIGUE diciendo si el plan se emitio o no (sale de
  // `protocoloEmitido`, que no se toca). El dato esta; lo que se quita es tratarlo como algo pendiente.
  //
  // SI ALGUNA VEZ SE QUIERE DE VUELTA, tendria que distinguir al profesional que usa el plan de Atlas del que
  // usa el suyo, y eso hoy no se sabe: no hay dato que lo diga. Por eso no se deja "apagado tras una bandera".

  // YA NO HAY APROBACION (2026-09-18): el reporte es una hoja mas, que se imprime o se envia. Antes esto
  // distinguia "sin aprobar" de "aprobado y sin enviar", y ese par ya no existe. Lo que sigue siendo cierto es
  // lo unico que le importa al paciente: si lo recibio o no.
  if (e.reporteEstado !== null && e.reporteEstado !== "sent") {
    out.push({
      id: "reporte",
      titulo: "El reporte no se le envió al paciente",
      detalle: "Todavía no recibió el informe de esta consulta en su idioma.",
      etapa: "reporte",
      bloqueadoPor: null,
    });
  }

  // ═══ LA DECISION SOBRE LOS NUTRACEUTICOS, DESPUES DEL REDISEÑO (2026-09-26) ═══
  //
  // ANTES colgaba de una pregunta de tres opciones ("¿el paciente los adquiere?"), y el pendiente decia "se
  // pregunta siempre". Esa pregunta se retiro: el "si" ya no se declara, LO DEMUESTRA LA VENTA, y el "no" es un
  // boton con su motivo.
  //
  // Asi que esto queda resuelto por CUALQUIERA de las dos vias, y sigue pendiente solo cuando no pasa ninguna:
  // ni se le vendieron ni se registro por que no. Un "pendiente" viejo (de antes del rediseño) se sigue
  // tratando como resuelto-con-nota, porque es una respuesta que alguien dio.
  // ── Y LA TERCERA VIA, QUE ES LA UNICA QUE SE PUEDE REGISTRAR HOY (2026-10-10, migracion 0214) ──
  //
  // El boton "el paciente no los adquiere por ahora" se retiro: medía si el PACIENTE adquiere, que es un
  // hecho que la VENTA ya responde. Lo reemplaza "No prescribo nutracéuticos", el criterio del PROFESIONAL.
  //
  // SI NO SE SUMARA AQUI, una consulta cerrada por la via nueva seguiria listando este pendiente, y su
  // detalle mandaria a pulsar un boton que ya no existe. Es el defecto de la regla muerta en otra puerta,
  // que en este archivo ya paso dos veces (el diagnostico confirmado y la entrega del plan).
  const resueltoPorLaVenta = e.hayVentaDeNutraceuticos;
  const resueltoPorElNo = e.nutraceuticosDecision === "no" || e.sinPrescripcion;
  if (!resueltoPorLaVenta && !resueltoPorElNo) {
    out.push({
      id: "nutraceuticos",
      titulo:
        e.nutraceuticosDecision === "pendiente"
          ? "El paciente quedó de pensar los nutracéuticos"
          : "No se registró si el paciente se lleva los nutracéuticos",
      detalle:
        e.nutraceuticosDecision === "pendiente"
          ? "Es una respuesta válida: se puede cerrar así y registrarla cuando el paciente decida."
          : "Si se los llevó, queda registrado con la venta. Si no le prescribiste ninguno, usa el botón \"No prescribo nutracéuticos\", junto a Guardar prescripción.",
      etapa: "tratamiento",
      bloqueadoPor: null,
    });
  }

  if (!e.proximaCita) {
    out.push({
      id: "cita",
      titulo: "No hay próxima cita registrada",
      detalle: "El paciente se va sin saber cuándo lo vuelven a ver.",
      etapa: "reporte",
      bloqueadoPor: null,
    });
  }

  if (e.remisionesSinRetorno > 0) {
    out.push({
      id: "remisiones",
      titulo:
        e.remisionesSinRetorno === 1
          ? "Una remisión sigue sin retorno"
          : `${e.remisionesSinRetorno} remisiones siguen sin retorno`,
      detalle: "El retorno se registra cuando el paciente vuelve; no depende de esta consulta.",
      etapa: null,
      bloqueadoPor: "que el paciente vuelva de la remisión",
    });
  }

  return out;
}

/** Lo que NO se lista porque no puede existir en esta evaluacion. Se expone para poder probarlo. */
export function imposiblesDeLaConsulta(e: EstadoConsulta): string[] {
  const out: string[] = [];
  if (!e.protocoloComputado) out.push("protocolo");
  if (e.reporteEstado === null) out.push("reporte");
  return out;
}
