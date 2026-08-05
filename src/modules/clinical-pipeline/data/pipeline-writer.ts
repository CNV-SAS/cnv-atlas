import "server-only";

import { eq } from "drizzle-orm";

import {
  type EngineIndicators,
  type EngineOutput,
  INDICATOR_KEY_TO_CODE,
  type ProtocoloSnapshot,
} from "@/clinical-engine";
import { db, type DbTransaction } from "@/db";
import {
  diagnoses,
  followupMetrics,
  followups,
  indicatorValues,
  reports,
  treatmentDietGuidelines,
  treatments,
} from "@/db/schema";
import type { RutaContent } from "@/clinical-engine/rutas-content";
import type { ValidityCaveat } from "@/modules/bis-intake/services/validity";
import { recordAudit } from "@/modules/audit/log";
import { buildEmissionVersions } from "../emission-versions";

import type { EfrContent } from "./pipeline-reader";
import { computeTrajectoryToSeal } from "./pipeline-trajectory";

// Persistencia de la propagacion en UNA db.transaction (Drizzle owner): indicator_values
// -> diagnoses -> treatments (+ guias) -> reports (snapshot draft), con la constelacion
// de versiones en cada registro que la lleva (regla 7) y el audit diagnosis.created /
// treatment.created INLINE (regla 8). Si algo falla, no queda nada a medias. La
// autorizacion se verifico antes en el action bajo RLS (regla 3). El mapeo indicador ->
// codigo canonico vive en el contrato del motor (INDICATOR_KEY_TO_CODE).

// La evaluacion ya tiene un diagnostico: re-propagar duplicaria registros clinicos. Se
// rechaza; el servicio la mapea a conflicto. No deja rastro parcial.
export class PipelineAlreadyRunError extends Error {
  constructor(public readonly evaluationId: string) {
    super(`La evaluacion ${evaluationId} ya tiene un diagnostico generado.`);
    this.name = "PipelineAlreadyRunError";
  }
}

export type PipelineWriteInput = {
  evaluationId: string;
  patientId: string;
  evaluationType: string; // inicial | seguimiento
  output: EngineOutput;
  // Contenido clinico del estado EFR (del registry, por bandas), para CONGELARLO en el snapshot
  // junto al EngineOutput. REQUERIDO: run-pipeline garantiza que no sea null (falla fuerte).
  efrContent: EfrContent;
  // Caveats de validez (condiciones que comprometen la validez respondidas "si"), para CONGELARLOS
  // en el snapshot: la reserva del resultado debe sobrevivir al diagnostico (el intake es mutable).
  // [] si no hay ninguna.
  validityCaveats: ValidityCaveat[];
  // Contenido clinico de las rutas de atencion ACTIVAS (verbatim de Gildardo), para CONGELARLO en el
  // snapshot: es lo que efectivamente se prescribio ese dia (indicaciones, remisiones, seguimiento),
  // acto clinico como el fenotipo. Si Gildardo cambia una ruta despues, el diagnostico de hoy sigue
  // mostrando lo prescrito. [] si no hay rutas activas.
  rutasContent: RutaContent[];
  // Protocolo sugerido (T2 A3), salida del orquestador. null si el orquestador fallo o no pudo
  // computar: se sella null (no un objeto de error, para no cerrar el backfill) y se audita el
  // fallo con protocolFailMotive. Constelacion: el jsonb ya trae protocol_engine_version; el resto
  // se hereda del diagnostico via diagnosis_id.
  protocolSuggested: ProtocoloSnapshot | null;
  // Motivo del fallo del protocolo (nivel motor, sin PII), o null si se computo bien. Si no es null,
  // se registra protocol.compute_failed INLINE (regla 8) para que un fallo sistematico sea buscable.
  protocolFailMotive: string | null;
  surveyVersionId: string;
  modelVersionId: string;
  indicatorDefIdByCode: Record<string, string>;
  // Mapas clave -> id del registry para los FK del diagnostico (opcionales: null si el
  // registry aun no esta poblado). structural.key (STRUCT) y frSector.key (FyR).
  phenotypeIdByKey?: Record<string, string>;
  frSectorIdByKey?: Record<string, string>;
  actorId: string; // profiles.id: createdBy del tratamiento y actor del audit
  actorEmail: string;
  ip: string | null;
};

export type PipelineWriteResult = {
  diagnosisId: string;
  treatmentId: string;
  reportId: string;
  indicatorCount: number;
};

// Refactor ADITIVO (flujo de correccion, 2026-08-03): writePipeline puede unirse a una transaccion
// EXTERNA para que la correccion copie insumos + escriba el diagnostico + inserte la correccion en
// UNA sola tx atomica. SIN externalTx toma EXACTAMENTE el mismo camino que siempre (db.transaction):
// el camino normal queda byte-identico (verificado ejecutando, 3a). El cuerpo NO cambia; solo se
// extrae a run(tx) y se despacha al final.
export async function writePipeline(
  input: PipelineWriteInput,
  // externalTx: para el flujo de correccion, que necesita escribir el diagnostico ATOMICAMENTE con
  // la copia de insumos y la insercion de la correccion. QUIEN LO PASE SE HACE RESPONSABLE DE LA
  // TRANSACCION COMPLETA: si algo falla despues, el diagnostico se revierte con ella; el diagnostico
  // queda atado a un contexto que este modulo no controla. Hoy lo usa SOLO correctEvaluation. No usar
  // por conveniencia ni para "agrupar" escrituras: el camino normal es SIN transaccion externa (abre
  // la suya y aisla el diagnostico). Escribe diagnostico, indicadores, tratamiento, reporte y audit.
  externalTx?: DbTransaction,
): Promise<PipelineWriteResult> {
  const { output } = input;
  const run = async (tx: DbTransaction): Promise<PipelineWriteResult> => {
    // Guard de re-propagacion dentro de la transaccion (evita TOCTOU).
    const existing = await tx
      .select({ id: diagnoses.id })
      .from(diagnoses)
      .where(eq(diagnoses.evaluationId, input.evaluationId))
      .limit(1);
    if (existing.length > 0) throw new PipelineAlreadyRunError(input.evaluationId);

    // 1. indicator_values (uno por indicador), cada uno con su constelacion. La
    //    clasificacion se deja null (los cortes son datos del registry, congelados).
    const indicatorRows = (Object.keys(INDICATOR_KEY_TO_CODE) as (keyof EngineIndicators)[]).map(
      (key) => {
        const code = INDICATOR_KEY_TO_CODE[key];
        const definitionId = input.indicatorDefIdByCode[code];
        if (!definitionId) {
          throw new Error(`pipeline-writer: falta indicator_definition para el codigo ${code}`);
        }
        const v = output.indicators[key];
        return {
          evaluationId: input.evaluationId,
          indicatorDefinitionId: definitionId,
          // null se persiste como null (indicador no calculable): no se inventa un 0.
          value: v == null ? null : String(v),
          engineVersion: output.versions.engine,
          surveyVersionId: input.surveyVersionId,
          modelVersionId: input.modelVersionId,
          rulesVersion: output.versions.rules,
        };
      },
    );
    await tx.insert(indicatorValues).values(indicatorRows);

    // 2. diagnosis (sin confirmar: el profesional confirma aguas abajo, B10).
    const [diagnosis] = await tx
      .insert(diagnoses)
      .values({
        evaluationId: input.evaluationId,
        efrStateNumber: output.efrPhenotype.stateNumber,
        // FK al fenotipo estructural (9) y sector FyR (9) del registry, resueltos por
        // clave. null si el registry aun no los tiene poblados (best-effort).
        phenotypeId: input.phenotypeIdByKey?.[output.structural.key] ?? null,
        frSectorId: input.frSectorIdByKey?.[output.frSector.key] ?? null,
        diagnosisName: output.efrPhenotype.diagnostico,
        engineVersion: output.versions.engine,
        modelVersionId: input.modelVersionId,
        rulesVersion: output.versions.rules,
        // Versiones de emision emergentes (Q20/C2b), set COMPLETO sellado write-once.
        emissionVersions: buildEmissionVersions(),
      })
      .returning({ id: diagnoses.id });
    await recordAudit(tx, {
      event: "diagnosis.created",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "diagnosis",
      entityId: diagnosis.id,
      payload: {
        evaluation_id: input.evaluationId,
        efr_state_number: output.efrPhenotype.stateNumber,
        efr_key: output.efrPhenotype.key,
        dfi_complete: output.dfi.complete,
      },
      ip: input.ip,
    });

    // 3. treatment + una guia dietaria con el resumen del protocolo (stub). protocol_suggested se
    //    SELLA aqui, en el INSERT (write-once). El trigger de inmutabilidad es BEFORE UPDATE OR
    //    DELETE, no INSERT, asi que sellar en el INSERT no choca con el.
    const [treatment] = await tx
      .insert(treatments)
      .values({
        diagnosisId: diagnosis.id,
        createdBy: input.actorId,
        protocolSuggested: input.protocolSuggested,
      })
      .returning({ id: treatments.id });
    if (output.resumenClinico) {
      await tx.insert(treatmentDietGuidelines).values({
        treatmentId: treatment.id,
        guidelineText: output.resumenClinico,
      });
    }
    await recordAudit(tx, {
      event: "treatment.created",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "treatment",
      entityId: treatment.id,
      payload: { diagnosis_id: diagnosis.id, protocol_sealed: input.protocolSuggested != null },
      ip: input.ip,
    });
    // Si el orquestador no produjo protocolo, se sello null; se deja rastro BUSCABLE inline (regla 8)
    // para que un fallo sistematico no sea invisible ("la pestana no muestra nada"). Sin PII.
    if (input.protocolFailMotive) {
      await recordAudit(tx, {
        event: "protocol.compute_failed",
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        entityType: "treatment",
        entityId: treatment.id,
        payload: { diagnosis_id: diagnosis.id, evaluation_id: input.evaluationId, motivo: input.protocolFailMotive },
        ip: input.ip,
      });
    }

    // Trayectoria de EB-BIS a SELLAR (P0 Parte 2): solo en SEGUIMIENTO y solo si hay previa comparable
    // (>=12 semanas por measurement_date, C2-a). null en inicial o sin previa comparable. Se computa
    // ANTES del insert para sellarla EN el reporte (no por UPDATE: la columna es inmutable por trigger).
    const trajectory =
      input.evaluationType === "seguimiento"
        ? await computeTrajectoryToSeal(tx, {
            patientId: input.patientId,
            evaluationId: input.evaluationId,
            currentEb: output.indicators.eb ?? null,
          })
        : null;

    // 4. report draft con el snapshot inmutable (evidencia, principio 4). Ademas del
    //    EngineOutput se congela efrContent (contenido clinico del estado EFR del registry),
    //    para que la vista de resultados sea autosuficiente y no re-derive evidencia del
    //    registry vivo (ii). La aprobacion/envio del reporte es B10.
    const [report] = await tx
      .insert(reports)
      .values({
        evaluationId: input.evaluationId,
        patientId: input.patientId,
        type: "paciente",
        status: "draft",
        snapshot: {
          ...output,
          efrContent: input.efrContent,
          validityCaveats: input.validityCaveats,
          rutasContent: input.rutasContent,
          // survey_version_id SELLADO junto a dfi.complete: la lista de field_key contra la
          // que se midio la completitud es reconstruible desde aqui (regla 7). Con el, un
          // dfi.complete sellado no depende de que lista se le pase despues.
          surveyVersionId: input.surveyVersionId,
        },
        trajectory, // null salvo seguimiento con previa comparable
      })
      .returning({ id: reports.id });

    // 5. Si la evaluacion es de SEGUIMIENTO, el ciclo registra un followup con su
    //    fotografia de metricas (B13). El followup queda atado a la evaluacion de
    //    seguimiento y al tratamiento de ESTE ciclo; la comparacion contra la evaluacion
    //    previa la resuelve el comparador al leer (no se guardan deltas). Audit inline.
    if (input.evaluationType === "seguimiento") {
      const [followup] = await tx
        .insert(followups)
        .values({
          patientId: input.patientId,
          treatmentId: treatment.id,
          evaluationId: input.evaluationId,
        })
        .returning({ id: followups.id });

      const metricRows = buildFollowupMetrics(followup.id, output);
      if (metricRows.length) await tx.insert(followupMetrics).values(metricRows);

      await recordAudit(tx, {
        event: "followup.recorded",
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        entityType: "followup",
        entityId: followup.id,
        payload: {
          evaluation_id: input.evaluationId,
          treatment_id: treatment.id,
          efr_state_number: output.efrPhenotype.stateNumber,
          metric_count: metricRows.length,
        },
        ip: input.ip,
      });
    }

    return {
      diagnosisId: diagnosis.id,
      treatmentId: treatment.id,
      reportId: report.id,
      indicatorCount: indicatorRows.length,
    };
  };
  // Sin tx externa: mismo camino de siempre (abre su propia transaccion). Con tx externa: se une a
  // ella, para que la escritura del diagnostico sea atomica con la copia de insumos y la correccion.
  return externalTx ? run(externalTx) : db.transaction(run);
}

// Fotografia de metricas del seguimiento: los 12 indicadores + el estado EFR + el score de
// riesgo del DFI, para la comparacion longitudinal. Un valor null se guarda como null (no
// se inventa un 0). El nombre canonico es el codigo del indicador (o EFR_STATE /
// DFI_RISK_SCORE), estable entre ciclos para poder comparar el mismo campo.
function buildFollowupMetrics(
  followupId: string,
  output: EngineOutput,
): { followupId: string; metricName: string; value: string | null }[] {
  const rows: { followupId: string; metricName: string; value: string | null }[] = (
    Object.keys(INDICATOR_KEY_TO_CODE) as (keyof EngineIndicators)[]
  ).map((key) => {
    const v = output.indicators[key];
    return {
      followupId,
      metricName: INDICATOR_KEY_TO_CODE[key] as string,
      value: v == null ? null : String(v),
    };
  });
  rows.push({
    followupId,
    metricName: "EFR_STATE",
    value: String(output.efrPhenotype.stateNumber),
  });
  rows.push({
    followupId,
    metricName: "DFI_RISK_SCORE",
    value: String(output.dfi.riesgo.score),
  });
  return rows;
}
