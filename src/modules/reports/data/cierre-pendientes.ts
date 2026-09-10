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
  nutraceuticosDecision: "si" | "no" | "pendiente" | null;
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
  // Apuntaba a un acto que ya no existe: confirmar dejo de ser un boton, y la firma clinica se sella sola
  // al aprobar el reporte. Dejarlo listaria para siempre algo que el profesional no puede hacer, que es
  // justo lo que el tercer estado de este archivo (IMPOSIBLE) existe para evitar.
  //
  // Y NO SE PIERDE NADA: `confirmed_at` se llena exactamente al aprobar el reporte, asi que este pendiente
  // coincidia siempre con el de abajo ("El reporte no se aprobó ni se envió"), que si nombra un acto suyo.

  // EL PENDIENTE CAMBIO DE HECHO (2026-09-09): antes era "el tratamiento no se aprobó" y ahora es "el
  // plan no se le entregó al paciente".
  //
  // POR QUE NO ES EL MISMO PENDIENTE CON OTRO NOMBRE. Aprobar era un tramite interno: el paciente no se
  // enteraba de que ocurriera. Entregar es el hecho que le importa a la persona, y ademas es el que
  // sostiene la historia clinica (sin emision, el documento sale con las cifras de hoy). Cerrar una
  // consulta sin haber entregado nada es lo que de verdad merece aparecer en la lista.
  //
  // IMPOSIBLE: sin protocol_suggested no hay plan que entregar. Fuera de la lista.
  if (e.protocoloComputado && !e.protocoloEmitido) {
    out.push({
      id: "protocolo",
      titulo: "El plan no se le entregó al paciente",
      // NI GATE NI REPROCHE: se puede cerrar una consulta sin entregar el plan a proposito (el paciente
      // se lo piensa, se le envia despues). La lista informa, que es el tono de todo este bloque.
      detalle: "No consta que se haya impreso ni enviado. La historia clínica lo dirá así.",
      etapa: "tratamiento",
      bloqueadoPor: null,
    });
  }

  if (e.reporteEstado === "draft") {
    out.push({
      id: "reporte",
      titulo: "El reporte no se aprobó ni se envió",
      detalle: "El paciente todavía no recibió su informe de esta consulta.",
      etapa: "reporte",
      bloqueadoPor: null,
    });
  } else if (e.reporteEstado === "approved") {
    out.push({
      id: "reporte",
      titulo: "El reporte está aprobado pero no se envió",
      detalle: "El paciente todavía no lo recibió.",
      etapa: "reporte",
      bloqueadoPor: null,
    });
  }

  if (e.nutraceuticosDecision === null || e.nutraceuticosDecision === "pendiente") {
    out.push({
      id: "nutraceuticos",
      titulo:
        e.nutraceuticosDecision === "pendiente"
          ? "El paciente quedó de pensar los nutracéuticos"
          : "No se registró la decisión sobre los nutracéuticos",
      detalle:
        e.nutraceuticosDecision === "pendiente"
          ? "Es una respuesta válida: se puede cerrar así y registrarla cuando el paciente decida."
          : "Se pregunta siempre, aunque la respuesta sea que no los lleva.",
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
