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
// remision depende de otro). La lista informa, no reprocha: ningun texto reprocha A LA PERSONA ("debes",
// "olvidaste", "no hiciste"). Decir que falta un REGISTRO si cabe, y hace falta: describe lo que el
// sistema no tiene, no lo que alguien dejo de hacer (precisado el 2026-11-15, con el aviso de la entrega
// de los nutraceuticos).

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
  // ═══ `hayVentaDeNutraceuticos` SE RETIRA DEL ESTADO (Santiago, 2026-11-16) ═══
  //
  // Estuvo aqui desde el rediseño del 2026-09-26 como "el SI" de los nutraceuticos, con un buen argumento:
  // un hecho (el paciente pago) vale mas que una casilla marcada. Lo que su regla nueva precisa es que ese
  // hecho es COMERCIAL y este pendiente es CLINICO: lo que cierra el acto es la PRESCRIPCION.
  //
  // Y NO SE DEJA EL CAMPO SIN LEER, que es la tentacion barata: una bandera que nadie mira deja creer que
  // se esta aplicando. Quitarla obliga a los dos llamadores a enterarse de que la regla cambio.
  //
  // Medido antes de cambiarlo, sobre los 554 tratamientos de la nube: el pendiente CIERRA en 434 que
  // antes seguian abiertos, y ABRE en 4, que son ventas pagadas sin prescripcion registrada. Esas 4 no
  // son un efecto colateral: son el hueco de registro clinico que la regla nueva existe para enseñar.
  /**
   * El profesional registró que NO prescribe nutracéuticos en esta consulta (0214). Es la tercera vía que
   * resuelve este pendiente, y es la ÚNICA que se puede registrar hoy: `nutraceuticosDecision` quedó
   * congelado el 2026-10-10.
   */
  sinPrescripcion: boolean;
  /**
   * CUANTOS NUTRACEUTICOS HAY PRESCRITOS en esta consulta. Decide QUE pendiente es (Santiago, smoke del
   * 2026-11-15): con dos prescritos, el aviso le decia *"si no le prescribiste ninguno, usa el botón No
   * prescribo"*, que es un consejo sobre un caso que no es el suyo. Lo que le falta es registrar la
   * ENTREGA, y eso se hace con la venta.
   */
  nutraceuticosPrescritos: number;
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
  // ═══ Y LA REGLA CAMBIA: LO QUE CIERRA ES LA PRESCRIPCION, NO LA ENTREGA (Santiago, 2026-11-16) ═══
  //
  // El aviso del 15 de noviembre decia su caso ("Prescribiste 2: falta registrar si se los llevó"), que
  // era mejor que el anterior, y seguia midiendo lo que no le toca medir a esta lista. Textual suyo:
  //
  //   · *"el ítem se CIERRA cuando el profesional guardó una prescripción de nutracéuticos (los del
  //     modelo u otros distintos), o marcó «No prescribo» con su motivo"*;
  //   · *"queda ABIERTO solo si no hay ninguna de las dos cosas (o si lo único prescrito no es un
  //     nutracéutico)"*;
  //   · *"si el paciente se los lleva o no, es comercial: no frena el cierre. La compra queda en la
  //     venta, y la adherencia en el S1 del seguimiento"*.
  //
  // POR QUE ES LA REGLA CORRECTA, y no solo un texto mejor: esta lista es de pendientes CLINICOS de la
  // consulta, y el acto clinico es PRESCRIBIR. Que el paciente compre hoy, la semana que viene o nunca es
  // un hecho comercial que ya tiene su propio sitio (la venta) y su propia medicion clinica (el S1 de la
  // CNV-S, que pregunta si los tomo). Mientras la entrega fuera la condicion de cierre, una consulta bien
  // hecha se quedaba con un pendiente que el profesional no podia resolver desde la consulta, y los
  // pendientes que no se pueden resolver son los que ensenan a no leer la lista.
  //
  // LO QUE CAMBIA EN LOS DATOS: antes la via del "si" era la VENTA (`hayVentaDeNutraceuticos`). Ahora es
  // la prescripcion. La venta deja de cerrarlo **a proposito**: una venta sin prescripcion es una falta
  // de registro clinico de verdad, y el unico sitio donde se puede ver es aqui. Medido antes de
  // cambiarlo, para no abrir un pendiente masivo sin saberlo (ver el informe del 2026-11-16).
  const resueltoPorLaPrescripcion = e.nutraceuticosPrescritos > 0;
  const resueltoPorElNo = e.nutraceuticosDecision === "no" || e.sinPrescripcion;
  if (!resueltoPorLaPrescripcion && !resueltoPorElNo) {
    // AQUI SOLO SE LLEGA SIN PRESCRIPCION Y SIN "No prescribo", asi que el hueco es UNO y el aviso puede
    // nombrarlo sin condicionales: falta el criterio del profesional sobre los nutracéuticos.
    //
    // EL CASO "quedó de pensarlo" SE CONSERVA porque es un dato que alguien dio (la pregunta de tres
    // opciones se retiro el 2026-09-26, pero sus respuestas siguen en la base) y porque dice otra cosa:
    // ahi SI hubo una decision, aplazada. Un pendiente que ignora una respuesta registrada le pide al
    // profesional que vuelva a decidir algo que ya decidio.
    const titulo =
      e.nutraceuticosDecision === "pendiente"
        ? "El paciente quedó de pensar los nutracéuticos"
        : "No se registró la decisión sobre los nutracéuticos";
    const detalle =
      e.nutraceuticosDecision === "pendiente"
        ? "Es una respuesta válida: se puede cerrar así y registrarla cuando el paciente decida."
        : 'Guarda la prescripción con los que le indicaste, o usa el botón "No prescribo nutracéuticos" con su motivo, junto a Guardar prescripción. Si se los lleva o no, queda en la venta.';
    out.push({
      id: "nutraceuticos",
      titulo,
      detalle,
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
