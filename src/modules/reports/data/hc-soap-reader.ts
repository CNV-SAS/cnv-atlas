import "server-only";

import { getSurveyAnswersForEvaluation } from "@/modules/evaluations/data/survey-answers-reader";

import { getHistoriaClinicaDoc } from "./hc-documento-reader";
import { lineaDeReemplazo, observacionesVigentes } from "./observaciones-vigentes";
import { redactarEncuesta } from "../services/encuesta-redactada";
import type { HistoriaClinicaSoap } from "./reports-view-types";

// ═══ LA HISTORIA CLINICA EN FORMATO SOAP (plan aprobado, 2026-09-20) ═══
//
// QUE ES: los MISMOS datos de la historia clinica, ordenados por ACTO CLINICO (lo que el paciente refiere,
// lo que se mide, lo que el profesional concluye, lo que se va a hacer) en vez de por ORIGEN DEL DATO, que
// es como los ordena la historia de Gildardo.
//
// POR QUE CONVIVEN LAS DOS, en vez de reemplazar una: sirven a lecturas distintas. La suya se audita (se
// ve de donde sale cada cifra); el SOAP se lee en consulta y es lo que piden las EPS. Y sobre todo: su
// estructura es SUYA, y reordenarla es cambiar un documento clinico. Esto es un documento APARTE.
//
// NO CONSULTA POR SU CUENTA, y es la regla que ya siguen el plan del paciente y el informe: compone desde
// `getHistoriaClinicaDoc` (los catorce bloques) y desde el lector de respuestas. Dos formas de armar el
// mismo insumo es como se termina con dos verdades sobre la misma consulta.
//
// LO QUE NO LLEVA: alertas, semaforo ni cruces entre respuestas. Es la mitad que espera a Gildardo.

export async function getHistoriaClinicaSoap(evaluationId: string): Promise<HistoriaClinicaSoap | null> {
  const [hc, domains] = await Promise.all([
    getHistoriaClinicaDoc(evaluationId),
    getSurveyAnswersForEvaluation(evaluationId),
  ]);
  if (!hc) return null;

  return {
    // La cabecera es la misma del documento: quien firma, de quien es y de cuando.
    paciente: hc.paciente,
    edad: hc.edad,
    sexo: hc.sexo,
    fechaConsulta: hc.fechaConsulta,
    profesional: hc.profesional,

    // ── S · lo que el paciente refiere ───────────────────────────────────────────────────────────
    subjetivo: {
      motivos: hc.motivos,
      antecedentes: hc.antecedentes,
      encuesta: redactarEncuesta(domains ?? []),
    },

    // ── O · lo que se mide ───────────────────────────────────────────────────────────────────────
    objetivo: {
      pesoKg: hc.pesoKg,
      tallaCm: hc.tallaCm,
      composicion: hc.composicion,
      indices: hc.indices,
    },

    // ── A · lo que el profesional concluye ───────────────────────────────────────────────────────
    //
    // EL RESUMEN DEL PROFESIONAL VA PRIMERO, antes del parrafo del DFI: en un SOAP el analisis es de
    // quien firma, y el del modelo es su respaldo. En la historia de Gildardo el orden es el contrario
    // porque alli manda el origen del dato.
    analisis: {
      resumenProfesional: hc.resumenProfesional,
      dfiParrafo: hc.dfiParrafo,
      metaTerapeutica: hc.metaTerapeutica,
      motivoSinNarrativa: hc.motivoSinNarrativa,
      rutas: hc.rutas,
    },

    // ── P · lo que se va a hacer ─────────────────────────────────────────────────────────────────
    plan: {
      objetivoModelo: hc.objetivoModelo,
      objetivoTratamiento: hc.objetivoTratamiento,
      nutricional: hc.plan,
      recomendaciones: hc.recomendaciones,
      remisionesExigidas: hc.remisionesExigidas,
      remisiones: hc.remisiones,
      // SOLO LA VIGENTE DE CADA PROFESION, con su linea de rastro: la MISMA reduccion que usan la
      // pantalla y el PDF de la historia clinica (`observaciones-vigentes`). Dos superficies del mismo
      // documento no pueden decidir por separado cual es la vigente.
      observaciones: observacionesVigentes(
        hc.observaciones.map((o) => ({
          id: o.creadaEn,
          note: o.texto,
          fecha: o.fecha,
          creadaEn: o.creadaEn,
          profesion: o.profesion,
        })),
      ).map((o) => ({
        texto: o.note,
        autor: null,
        profesion: o.profesion,
        fecha: o.fecha,
        creadaEn: o.creadaEn,
        rastro: lineaDeReemplazo(o),
      })),
      proximaCita: hc.proximaCita,
    },

    prescripcionSinEmitir: hc.prescripcionSinEmitir,
  };
}
