import "server-only";

import { getPatientConsents } from "@/modules/consent/data/consent-reader";
import { CONSENT_TYPE_LABELS } from "@/modules/consent/labels";
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

  const [composition, protocol, answers] = await Promise.all([
    getCompositionForEvaluation(evaluationId),
    getTreatmentProtocol(evaluationId),
    getSurveyAnswersForEvaluation(evaluationId),
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

  const compuesta = componerHistoriaClinica({
    // El PDF no recibe el snapshot del motor: sus indices se sellan en el diagnostico y no en el
    // protocolo. Sin el, los bloques que dependen de indicadores salen vacios, que es lo correcto: es
    // preferible un bloque ausente a uno con cifras de otra parte.
    snapshot: null,
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
    sexoM: header.sexo !== "F",
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

  return {
    paciente: header.paciente,
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
