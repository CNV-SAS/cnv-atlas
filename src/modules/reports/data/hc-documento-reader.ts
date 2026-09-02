import "server-only";

import { dfiNarrativeFromOutput } from "@/clinical-engine/dfi-narrative";
import { indicatorSeverities } from "@/clinical-engine/severity";
import { getPatientConsents } from "@/modules/consent/data/consent-reader";
import { getEvaluationResults } from "@/modules/diagnoses/data/results-reader";
import { indicatorRange } from "@/modules/diagnoses/data/indicator-ranges";
import { getResumenProfesionForEvaluation } from "@/modules/treatment/data/dieta-resumen-reader";
import { CONSENT_TYPE_LABELS } from "@/modules/consent/labels";
import { allCompositionRows } from "@/modules/diagnoses/data/composition-map";
import { getCompositionForEvaluation } from "@/modules/diagnoses/data/composition-reader";
import { listReferralsForTreatment } from "@/modules/referrals/data/referrals-reader";
import { getTreatmentProtocol } from "@/modules/treatment/data/treatment-reader";
import { getPrescripcionNutricional } from "@/modules/treatment/data/dieta-resumen-reader";
import { getSurveyAnswersForEvaluation } from "@/modules/evaluations/data/survey-answers-reader";
import { formatDate, formatDateOnly } from "@/lib/format/date";

import { componerHistoriaClinica } from "./hc-composicion";
import { resolverAntecedentes } from "./hc-antecedentes-map";
import { getHcHeaderForEvaluation } from "./hc-header-reader";
import type { HistoriaClinicaDoc } from "./reports-view-types";

// LA HISTORIA CLINICA COMO DATO, para el PDF que se le adjunta al paciente.
//
// LA CONDICION QUE GOBIERNA ESTE ARCHIVO (Santiago, 2026-09-02): el PDF y la pantalla tienen que salir del
// MISMO sitio. Por eso aqui no se compone nada: se llaman los MISMOS lectores que la pantalla
// (`getHcHeaderForEvaluation`, `resolverAntecedentes`, `listReferralsForTreatment`, `getPatientConsents`)
// y la MISMA composicion (`componerHistoriaClinica`), que existe justamente porque seis de los bloques se
// armaban sueltos en la pagina y un segundo documento los habria armado a su manera.
//
// SI ALGUN DIA HAY QUE AGREGAR UN BLOQUE, se agrega a la composicion, no aqui: este archivo solo lee.

export async function getHistoriaClinicaDoc(evaluationId: string): Promise<HistoriaClinicaDoc | null> {
  const header = await getHcHeaderForEvaluation(evaluationId);
  if (!header) return null;

  const [composition, protocol, answers, results] = await Promise.all([
    getCompositionForEvaluation(evaluationId),
    getTreatmentProtocol(evaluationId),
    getSurveyAnswersForEvaluation(evaluationId),
    // EL SNAPSHOT DEL DIAGNOSTICO. Sin el faltaban SIETE bloques (el resumen del profesional, el DFI
    // narrativo, la meta terapeutica, la composicion corporal, los indices ANI y las rutas activadas), y
    // todos por la MISMA razon: no estaban disponibles, no es que se hubieran dejado fuera. Una historia
    // clinica sin el diagnostico funcional ni la composicion corporal no es la historia clinica: es un
    // resumen, y es exactamente lo que el legal dijo que no se puede entregar.
    getEvaluationResults(evaluationId),
  ]);

  const preguntas = (answers ?? []).flatMap((d) => d.questions);
  const snapshot = protocol?.protocolSuggested ?? null;

  // La prescripcion del motor que GOBIERNA, para el sodio y la proteina de las recomendaciones. Misma
  // llamada que hace la pagina; si la evaluacion no tiene encuesta legible viaja null y los bloques que la
  // citan vuelven a marcarse como pendientes, nunca con una cifra por defecto.
  const prescripcion = snapshot
    ? await getPrescripcionNutricional(
        evaluationId,
        header.sexo ?? "",
        {},
        protocol?.pesoMetaFijado ?? snapshot.pesoCalculo,
        null,
        null,
      ).catch(() => null)
    : null;

  // `getEvaluationResults` devuelve null si la evaluacion no tiene diagnostico: ahi no hay snapshot y los
  // bloques que dependen de el salen con su motivo, no vacios.
  const engine = results && results.compatible ? results.snapshot : null;
  const sexoM = engine ? engine.sexo !== "F" : header.sexo !== "F";

  const compuesta = componerHistoriaClinica({
    snapshot: engine
      ? {
          indicators: engine.indicators as unknown as Record<string, number | null> & { FFMI: number },
          classifications: engine.classifications as unknown as Record<string, unknown>,
        }
      : null,
    suggested: snapshot,
    ajustes: {
      geb: protocol?.adjGeb ?? null,
      pal: protocol?.adjPal ?? null,
      kcalObj: protocol?.adjKcalObj ?? null,
      protGkg: protocol?.adjProtGkg ?? null,
      fatPct: protocol?.adjFatPct ?? null,
      deficit: protocol?.adjDeficit ?? null,
      pesoMeta: protocol?.pesoMetaFijado ?? null,
    },
    sexoM,
    sodioMax: prescripcion?.sodioMax ?? null,
    protKg: prescripcion?.protKg ?? null,
    protG: prescripcion?.protG ?? null,
    d5_39: preguntas.find((q) => q.fieldKey === "d5_39")?.answerValue ?? null,
    flags: { tieneHTA: snapshot?.flags.tieneHTA ?? false, tieneIRC: snapshot?.flags.tieneIRC ?? false },
    deficitEstrategia: snapshot?.estrategia.deficit ?? 0,
    pesoKg: protocol?.pesoMetaFijado ?? snapshot?.pesoCalculo ?? null,
  });

  const remisiones = protocol?.treatmentId
    ? await listReferralsForTreatment(protocol.treatmentId)
    : [];

  // EL SELLO DE CONSENTIMIENTO. Va al PDF por la misma razon por la que esta en la pantalla: es la mitad
  // legal del derecho de acceso. Y dice la version de ESTA consulta, no la vigente hoy: "hubo permiso" sin
  // decir de que texto no es constancia de nada, porque las autorizaciones cambian de redaccion y lo que
  // se pacto fue el texto de SU version.
  const consents = protocol?.patientId ? await getPatientConsents(protocol.patientId) : [];

  // LOS TRES PARRAFOS. Mismas fuentes que la pantalla: el del DFI sale de `dfiNarrativeFromOutput` y el
  // del profesional de `getResumenProfesionForEvaluation`, que es el que cambia segun quien mira. Aqui se
  // pide el del NUTRICIONISTA a proposito: es el que su archivo pone bajo "RESUMEN DIAGNOSTICO", y el
  // documento que se entrega no puede depender de quien lo genero.
  //
  // Y CUANDO NO SE PUEDEN EMITIR SE DICE POR QUE, no se omiten: un bloque ausente sin explicacion en un
  // documento probatorio se lee como que no se evaluo.
  const dfiCompleto = engine != null && engine.dfi.complete;
  const narrativa = dfiCompleto ? dfiNarrativeFromOutput(engine) : null;
  const motivoSinNarrativa = !engine
    ? "Este diagnóstico se emitió antes de portar el resumen funcional y la meta terapéutica al motor."
    : !dfiCompleto
      ? "La encuesta está incompleta. El resumen funcional y la meta terapéutica se emiten cuando el diagnóstico está completo."
      : null;
  const resumenProfesional = dfiCompleto
    ? await getResumenProfesionForEvaluation(
        evaluationId,
        engine.sexo,
        "nutricionista",
        engine.indicators as unknown as Record<string, unknown>,
      )
    : null;

  // LOS INDICES ANI y la composicion, que son lo que hace de esto un documento TECNICO y no un extracto.
  const severidades = engine ? (indicatorSeverities(engine) as Record<string, number>) : {};
  const indices = compuesta.indices.map((i) => ({
    codigo: i.codigo,
    nombre: i.nombre ?? i.codigo,
    valor: i.valor,
    clasificacion: i.clasificacion,
    referencia: engine ? (indicatorRange(i.codigo, engine.indicators, sexoM)?.reference ?? null) : null,
    severidad: severidades[i.codigo] ?? null,
  }));

  return {
    paciente: header.paciente,
    resumenProfesional,
    dfiParrafo: narrativa?.parrafo ?? null,
    metaTerapeutica: narrativa?.metas.nutricion ?? null,
    motivoSinNarrativa,
    indices,
    rutas: (results?.rutasContent ?? []).map((r) => ({
      label: r.label,
      activacion: r.activacion ?? null,
    })),
    // LA MISMA TABLA QUE LA PANTALLA, fila por fila y con su referencia.
    //
    // SIN LA CLASIFICACION DE CADA FILA, Y VA DICHO: el veredicto ("Optimo", "Riesgo") lo produce
    // `wangRowDx`, que necesita un contexto que la pantalla arma (referencias poblacionales, IMC, cintura,
    // angulo de fase, indice de reactancia, y el formateador de cada fila). Reproducirlo aqui seria una
    // SEGUNDA CONSTRUCCION del clasificador, que es justo lo que este documento existe para no tener: si
    // divergiera, la historia impresa y la enviada clasificarian distinto al mismo paciente.
    //
    // El DATO va completo, que es lo que la historia clinica debe llevar; el veredicto de cada medida vive
    // en los indices y en el diagnostico funcional, que si viajan. Sacar `wangRowDx` a una capa compartida
    // es el siguiente paso y esta anotado.
    composicion: composition
      ? allCompositionRows(composition)
          .filter((f) => f.value != null)
          .map((f) => ({
            etiqueta: f.label,
            valor: `${f.value!.toFixed(f.decimals ?? 2)} ${f.unit}`.trim(),
            clasificacion:
              f.referenceLabel ?? (f.reference != null ? `ref ${f.reference}` : null),
          }))
      : [],
    edad: header.edad,
    sexo: header.sexo,
    pesoKg: composition?.peso ?? null,
    tallaCm: composition?.talla ?? null,
    fechaConsulta: formatDate(header.fechaConsulta),
    profesional: header.profesional,
    motivos: header.motivos,
    // Los antecedentes salen del MISMO resolvedor que la pantalla, y se aplanan a texto aqui: el
    // documento no necesita la estructura de filas, necesita lo que el paciente declaro.
    antecedentes: resolverAntecedentes(preguntas).map((g) => ({
      grupo: g.titulo,
      items: g.filas
        .filter((f) => f.valores.length > 0)
        .map((f) => `${f.etiqueta}: ${f.valores.join(", ")}`),
    })),
    objetivoTratamiento: protocol?.objetivoTexto ?? null,
    plan: compuesta.plan,
    recomendaciones: compuesta.recomendaciones,
    remisiones: remisiones.map((r) => ({
      profesion: r.referredToOther ?? r.referredTo,
      motivo: r.reason,
      // El estado se DERIVA de la fecha de retorno, que es el dato: un flag aparte podria desincronizarse.
      estado: r.returnedAt ? "Regresó" : "Pendiente",
      fecha: formatDateOnly(r.referredAt),
    })),
    // LAS NOTAS NO LLEVAN AUTOR EN EL DOCUMENTO: lo que consta es la PROFESION con que se escribieron
    // (su §8 del 30: "cada rol escribe lo suyo"), que es la condicion clinica. El nombre de quien la
    // escribio vive en la auditoria.
    observaciones: (protocol?.notes ?? []).map((n) => ({
      texto: n.note,
      autor: null,
      profesion: n.profession ?? null,
      fecha: formatDate(n.createdAt),
    })),
    proximaCita: header.proximaCita ? formatDateOnly(header.proximaCita) : null,
    consentVersion: header.consentVersion,
    // REVOCADA y NUNCA OTORGADA no son lo mismo en un documento probatorio: una dice que el permiso
    // existio y se retiro, la otra que nunca lo hubo. Se conservan separadas, como en la pantalla.
    autorizaciones: consents.map((c) => ({
      tipo: CONSENT_TYPE_LABELS[c.tipo] ?? c.tipo,
      vigente: c.vigente,
      revocada: c.revocadaEl != null,
    })),
  };
}
