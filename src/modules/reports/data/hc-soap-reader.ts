import "server-only";

import { getSurveyAnswersForEvaluation } from "@/modules/evaluations/data/survey-answers-reader";

import { getHistoriaClinicaDoc } from "./hc-documento-reader";
import { lineaDeReemplazo, observacionesVigentes } from "./observaciones-vigentes";
import { redactarEncuesta } from "../services/encuesta-redactada";
import { preguntasDeLosAntecedentes } from "./hc-antecedentes-map";
import { alertasDeLaConsulta } from "@/clinical-engine/alertas-de-la-consulta";
import { alertasParaElSoap, CAMPOS_DEL_PARRAFO_DE_DIETA } from "../services/alertas-en-el-soap";
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
// LAS ALERTAS VAN EN LA A (observacion g, 2026-09-21), como primera linea, de la MISMA fuente que el
// resumen de IA. La S sigue sin semaforo: es lo que el paciente respondio, y la alerta es su lectura.

/** Lo que un rotulo dice ANTES del guion largo: la lectura, sin la conducta que trae detras. */
export function sinConducta(rotulo: string): string {
  return rotulo.split(/\s+—\s+/)[0].trim();
}

const palabras = (s: string): string[] =>
  s.toLocaleLowerCase("es-CO").split(/[^\p{L}]+/u).filter((w) => w.length > 3);

/** ¿El rotulo de la fila dice lo mismo que su grupo? Todas las palabras con peso del grupo estan en el rotulo. */
export function repiteElGrupo(grupo: string, rotulo: string): boolean {
  const delRotulo = new Set(palabras(rotulo));
  const delGrupo = palabras(grupo);
  return delGrupo.length > 0 && delGrupo.every((w) => delRotulo.has(w));
}

export function sinRotuloRepetido(grupo: string, item: string): string {
  const i = item.indexOf(": ");
  if (i < 0) return item;
  return repiteElGrupo(grupo, item.slice(0, i)) ? item.slice(i + 2) : item;
}

export function sinAlergiasSiNoLasTrae(dominio: string, texto: string): string {
  return /alerg/i.test(texto) ? dominio : dominio.replace(/Alergias y digestión/i, "Digestión");
}

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
      // Y SI LA ENCUESTA NO LA RESPONDIO EL (0172), esta seccion tiene que decirlo: "refiere" sigue siendo
      // cierto cuando el profesional transcribe lo que el paciente dice, pero no es la misma evidencia, y
      // quien lea el documento dentro de un año no puede tener que adivinarlo.
      encuestaRegistradaPor: hc.encuestaRegistradaPor,
      motivos: hc.motivos,
      // EL ROTULO NO SE REPITE (Santiago, 2026-09-21 y 22): "Diagnósticos personales: Diagnósticos personales:"
      // y "Exposición a contaminantes: Exposición habitual a contaminantes:". Se quita el rotulo de la fila
      // cuando dice lo mismo que el grupo (ver `repiteElGrupo`).
      antecedentes: hc.antecedentes.map((a) => ({
        grupo: a.grupo,
        items: a.items.map((i) => sinRotuloRepetido(a.grupo, i)),
      })),
      // Y LA ENCUESTA NO REPITE LO QUE YA DICEN LOS ANTECEDENTES: la hipertension, los contaminantes y las
      // alergias salian dos veces en la S. La misma funcion que arma los antecedentes decide cuales son.
      // Y SI LA SECCION PIERDE SUS ALERGIAS (van en los antecedentes), su nombre tampoco las promete:
      // "Alergias y digestión" queda "Digestión" (Santiago, 2026-09-22). Solo en el SOAP; la encuesta no cambia.
      encuesta: redactarEncuesta(
        domains ?? [],
        preguntasDeLosAntecedentes((domains ?? []).flatMap((d) => d.questions)),
      ).map((p) => ({ ...p, dominio: sinAlergiasSiNoLasTrae(p.dominio, p.texto) })),
    },

    // ── O · lo que se mide ───────────────────────────────────────────────────────────────────────
    objetivo: {
      pesoKg: hc.pesoKg,
      tallaCm: hc.tallaCm,
      // DOS AJUSTES DE LA O (2026-09-21), los dos por lo mismo: la O es lo que se MIDE.
      //   · Peso y estatura ya abren la O en su propia linea: en la tabla salian por segunda vez.
      //   · Algunos rotulos de su tabla traen una CONDUCTA detras del guion largo ("Déficit matriz — considerar
      //     colágeno", "vigilar colágeno"). Es la misma regla que las alertas: el sistema no pone conductas en
      //     un documento que firma el profesional. Queda la lectura, sin la recomendacion. La HC, que es su
      //     documento, no se toca.
      composicion: hc.composicion
        .filter((f) => f.clave !== "peso" && f.clave !== "talla")
        .map((f) => ({ ...f, clasificacion: f.clasificacion ? sinConducta(f.clasificacion) : null })),
      indices: hc.indices,
    },

    // ── A · lo que el profesional concluye ───────────────────────────────────────────────────────
    //
    // EL RESUMEN DEL PROFESIONAL VA PRIMERO, antes del parrafo del DFI: en un SOAP el analisis es de
    // quien firma, y el del modelo es su respaldo. En la historia de Gildardo el orden es el contrario
    // porque alli manda el origen del dato.
    analisis: {
      alertas: alertasParaElSoap(
        alertasDeLaConsulta(
          (domains ?? []).flatMap((d) =>
            d.questions.map((q) => ({ fieldKey: q.fieldKey, pregunta: q.questionText, valor: q.answerValue })),
          ),
        ),
        // El parrafo de dieta va en la A: lo que ya dice no se repite en la lista roja.
        hc.resumenProfesional ? CAMPOS_DEL_PARRAFO_DE_DIETA : undefined,
      ),
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
