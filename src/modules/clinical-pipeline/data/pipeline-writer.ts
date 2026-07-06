import "server-only";

import { eq } from "drizzle-orm";

import {
  type EngineIndicators,
  type EngineOutput,
  INDICATOR_KEY_TO_CODE,
} from "@/clinical-engine";
import { db } from "@/db";
import {
  diagnoses,
  indicatorValues,
  reports,
  treatmentDietGuidelines,
  treatments,
} from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

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
  output: EngineOutput;
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

export async function writePipeline(input: PipelineWriteInput): Promise<PipelineWriteResult> {
  const { output } = input;
  return db.transaction(async (tx) => {
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

    // 3. treatment + una guia dietaria con el resumen del protocolo (stub).
    const [treatment] = await tx
      .insert(treatments)
      .values({ diagnosisId: diagnosis.id, createdBy: input.actorId })
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
      payload: { diagnosis_id: diagnosis.id },
      ip: input.ip,
    });

    // 4. report draft con el snapshot inmutable del EngineOutput (evidencia, principio 4).
    //    La aprobacion/envio del reporte es B10.
    const [report] = await tx
      .insert(reports)
      .values({
        evaluationId: input.evaluationId,
        patientId: input.patientId,
        type: "paciente",
        status: "draft",
        snapshot: output,
      })
      .returning({ id: reports.id });

    return {
      diagnosisId: diagnosis.id,
      treatmentId: treatment.id,
      reportId: report.id,
      indicatorCount: indicatorRows.length,
    };
  });
}
