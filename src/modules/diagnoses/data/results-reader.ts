import "server-only";

import { type EngineOutput, isEngineOutput } from "@/clinical-engine";
import type { RutaContent } from "@/clinical-engine/rutas-content";
import type { ValidityCaveat } from "@/modules/bis-intake/services/validity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { vigenciaEmision, type VigenciaEmision } from "@/modules/clinical-pipeline/emision-vigencia";
import {
  getReportDispatch,
  getReportForEvaluation,
  type ReportStatus,
} from "@/modules/reports/data/reports-repository";

// Lectura de los resultados clinicos de una evaluacion para la VISTA INTERNA del
// profesional (B12). Fuente de verdad UNICA: el snapshot inmutable del reporte (EngineOutput +
// efrContent): 12 indicadores + clasificaciones + fenotipo EFR/estructural/FyR + DFI + el
// contenido clinico del estado EFR (nombre/mecanismo/biomarcadores/riesgos), TODO congelado al
// diagnosticar (ii). La vista es autosuficiente: NO cruza el registry vivo por state_number. Del
// registry solo se leen el estado de confirmacion del diagnostico y los nombres de indicadores
// (rotulos, por model_version_id). Todo por RLS (regla dura 3): el cliente anon con sesion solo
// ve las evaluaciones de sus pacientes; si no es suyo, no hay filas -> null (la pagina 404).

export type EfrStateContent = {
  diagnosisName: string;
  mechanism: string | null;
  biomarkers: string | null;
  risks: string | null;
  suggestedNutraceuticals: string | null;
};

// Forma del snapshot inmutable que persiste el pipeline: el EngineOutput MAS el contenido
// clinico del estado EFR congelado (efrContent, ii). efrContent es REQUERIDO: la vista lee toda
// la evidencia clinica de aqui, sin cruzar el registry vivo. (En runtime un dato previo a ii
// podria no traerlo; se maneja con `?? null` y la vista degrada, pero el contrato lo exige.)
// validityCaveats es OPCIONAL: los snapshots generados antes de este bloque no lo traen (no se
// reescribe el pasado, inmutabilidad); ausente = sin caveats.
type StoredSnapshot = EngineOutput & {
  efrContent: EfrStateContent;
  validityCaveats?: ValidityCaveat[];
  // Contenido de las rutas activas congelado (T1). OPCIONAL: snapshots previos no lo traen.
  rutasContent?: RutaContent[];
};

export type EvaluationResults = {
  snapshot: EngineOutput;
  // El snapshot coincide con la forma ACTUAL del motor. false para snapshots de eras
  // anteriores (stub-0.1.0 pre-B11): la vista degrada en vez de tronar.
  compatible: boolean;
  engineVersion: string | null; // versions.engine del snapshot, para informar el formato
  efrState: EfrStateContent | null;
  // Caveats de validez congelados en el snapshot (bajo que condicion(es) se hizo la medicion). []
  // si no hay o si el snapshot es previo a este bloque.
  validityCaveats: ValidityCaveat[];
  // Contenido de las rutas de atencion activas, congelado en el snapshot (T1). [] si no hay o si el
  // snapshot es previo a este bloque.
  rutasContent: RutaContent[];
  evaluationId: string; // para la superficie de confirmacion (B-0)
  confirmed: boolean;
  confirmedAt: string | null;
  confirmedByName: string | null; // full_name del profesional que confirmo (quien, decision 6)
  reportStatus: ReportStatus;
  patientName: string;
  documentLabel: string;
  evaluationDate: string;
  indicatorNames: Record<string, string>; // codigo -> nombre del registry
  // model_version_id del diagnostico: para leer los 81 estados de referencia (efr_states) de la
  // MISMA era del diagnostico del paciente (exploracion de la Diana, era-consistente). null si no
  // hay diagnostico o el snapshot es incompatible.
  modelVersionId: string | null;
  // Versiones de emision SELLADAS del diagnostico (jsonb de diagnoses). null en diagnosticos previos
  // a la columna. Alimenta la marca "calibracion provisional" de EB-BIS/IAE (P0), que se lee del dato
  // sellado, no de una constante (ver isProvisionalCalibration).
  emissionVersions: Record<string, unknown> | null;
  // Si el documento se emitio con una version anterior del modelo, y que dimensiones se movieron.
  // NO invalida nada: el diagnostico sigue vigente hasta que alguien reemita (ver el aviso).
  vigencia: VigenciaEmision;
};

export type EvaluationHeader = {
  patientId: string; // para poder VOLVER a la ficha del paciente desde la evaluacion
  patientName: string;
  documentLabel: string;
  /** `created_at` de la evaluacion, no la fecha de MEDICION. Ver la nota del reader. */
  evaluationDate: string;
  /** inicial | seguimiento. Ubica la evaluacion sin abrir ninguna etapa. */
  evaluationType: string;
};

// Cabecera minima de una evaluacion por RLS (existe y es del profesional?). Distingue
// "evaluacion sin diagnostico todavia" (estado vacio elegante) de "no existe o no es suya"
// (404): getEvaluationResults devuelve null en ambos casos, esto rompe el empate.
export async function getEvaluationHeaderForSession(
  evaluationId: string,
): Promise<EvaluationHeader | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluations")
    .select(
      // `type` se suma a la MISMA consulta: una columna mas, cero consultas nuevas.
      "created_at, type, patient_id, patients!inner(document_type, document_number, patient_profiles!inner(first_name, last_name))",
    )
    .eq("id", evaluationId)
    .maybeSingle();
  if (error) throw new Error(`results-reader: evaluation header: ${error.message}`);
  if (!data) return null;
  const one = <T,>(e: T | T[] | null): T | undefined => (Array.isArray(e) ? e[0] : (e ?? undefined));
  const patient = one(
    data.patients as
      | { document_type: string; document_number: string; patient_profiles: unknown }
      | { document_type: string; document_number: string; patient_profiles: unknown }[]
      | null,
  );
  const profile = one(
    (patient?.patient_profiles ?? null) as
      | { first_name: string; last_name: string }
      | { first_name: string; last_name: string }[]
      | null,
  );
  return {
    patientId: data.patient_id,
    patientName: `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim(),
    documentLabel: `${patient?.document_type ?? ""} ${patient?.document_number ?? ""}`.trim(),
    evaluationDate: data.created_at,
    evaluationType: data.type as string,
  };
}

export async function getEvaluationResults(
  evaluationId: string,
): Promise<EvaluationResults | null> {
  // Reporte del paciente para la evaluacion (RLS). Sin reporte no hay snapshot que ver.
  const report = await getReportForEvaluation(evaluationId);
  if (!report) return null;
  const dispatch = await getReportDispatch(report.reportId);
  if (!dispatch) return null;

  // Versiones de emision selladas del diagnostico (columna aparte de diagnoses, NO en el snapshot
  // del reporte). Para la marca de calibracion provisional (P0). RLS: si no es del profesional, null.
  const sellado = await getDiagnosisEmissionVersions(evaluationId);
  const emissionVersions = sellado.emissionVersions;
  // Vigencia de la ciencia con que se emitio: se computa AL LEER (como el delta de los rangos), nunca
  // se sella. Un documento no cambia porque el motor avance; lo que cambia es la distancia entre lo
  // que sello y lo que rige, y esa se mide hoy. Ver emision-vigencia.
  const vigencia = vigenciaEmision({
    engineVersion: sellado.engineVersion,
    emissionVersions: sellado.emissionVersions,
  });

  // Compatibilidad del snapshot con la forma actual del motor. Los snapshots de eras
  // anteriores (stub-0.1.0 pre-B11) no tienen efrPhenotype/dfi/structural: se degrada la
  // vista en vez de tronar. reports es inmutable, no se pueden migrar.
  const rawSnapshot = dispatch.snapshot as unknown;
  const engineVersion =
    (rawSnapshot as { versions?: { engine?: string } } | null)?.versions?.engine ?? null;
  if (!isEngineOutput(rawSnapshot)) {
    return {
      snapshot: dispatch.snapshot,
      compatible: false,
      engineVersion,
      vigencia,
      efrState: null,
      validityCaveats: [],
      rutasContent: [],
      evaluationId,
      confirmed: false,
      confirmedAt: null,
      confirmedByName: null,
      reportStatus: dispatch.status,
      patientName: dispatch.patientName,
      documentLabel: dispatch.documentLabel,
      evaluationDate: dispatch.evaluationDate,
      indicatorNames: {},
      modelVersionId: null,
      emissionVersions,
    };
  }

  // Contenido clinico del estado EFR: SIEMPRE del snapshot inmutable, donde se congela al
  // diagnosticar (ii). La vista es AUTOSUFICIENTE: NO cruza contra el registry vivo (ni efr_states
  // ni nada por state_number), para que una edicion futura del contenido de un estado no
  // re-escriba diagnosticos historicos. Un snapshot con la forma actual del motor trae efrContent
  // (ST1); si faltara (dato previo a ii, ya limpiado), efrState es null y la vista degrada.
  const efrState: EfrStateContent | null =
    (rawSnapshot as StoredSnapshot).efrContent ?? null;
  // Caveats de validez congelados en el snapshot. Ausente en snapshots previos a este bloque -> [].
  const validityCaveats: ValidityCaveat[] = (rawSnapshot as StoredSnapshot).validityCaveats ?? [];
  // Contenido de las rutas activas congelado (T1). Ausente en snapshots previos -> [].
  const rutasContent: RutaContent[] = (rawSnapshot as StoredSnapshot).rutasContent ?? [];

  // Del registry solo quedan dos lecturas, ninguna por state_number ni evidencia clinica: el
  // estado de confirmacion del diagnostico, y los NOMBRES de indicadores (rotulos, por
  // model_version_id; fuera del alcance de ii por decision, ver docs/RESULTADOS_GAP.md).
  const supabase = await createSupabaseServerClient();
  const { data: diag, error: dErr } = await supabase
    .from("diagnoses")
    .select("model_version_id, confirmed_at, confirmed_by")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dErr) throw new Error(`results-reader: diagnoses: ${dErr.message}`);

  // Nombre del profesional que confirmo (quien, B-0). Solo si esta confirmado.
  let confirmedByName: string | null = null;
  if (diag?.confirmed_by) {
    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", diag.confirmed_by)
      .maybeSingle();
    if (pErr) throw new Error(`results-reader: profiles: ${pErr.message}`);
    confirmedByName = prof?.full_name ?? null;
  }

  const indicatorNames: Record<string, string> = {};
  if (diag) {
    const { data: defs, error: defsErr } = await supabase
      .from("indicator_definitions")
      .select("code, name")
      .eq("model_version_id", diag.model_version_id);
    if (defsErr) throw new Error(`results-reader: indicator_definitions: ${defsErr.message}`);
    for (const d of defs ?? []) indicatorNames[d.code] = d.name;
  }

  return {
    snapshot: dispatch.snapshot,
    compatible: true,
    vigencia,
    engineVersion,
    efrState,
    validityCaveats,
    rutasContent,
    evaluationId,
    confirmed: Boolean(diag?.confirmed_at),
    confirmedAt: diag?.confirmed_at ?? null,
    confirmedByName,
    reportStatus: dispatch.status,
    patientName: dispatch.patientName,
    documentLabel: dispatch.documentLabel,
    evaluationDate: dispatch.evaluationDate,
    indicatorNames,
    modelVersionId: diag?.model_version_id ?? null,
    emissionVersions,
  };
}

// Lee las versiones de emision selladas del diagnostico mas reciente de la evaluacion (columna jsonb
// de diagnoses). RLS: si la evaluacion no es del profesional, no hay fila -> null. Se lee aparte del
// snapshot del reporte porque emission_versions NO viaja en el EngineOutput; es columna de diagnoses.
// Devuelve tambien `engine_version`: es la COLUMNA SELLADA (constelacion de la regla 7), que es la
// autoridad sobre con que motor se emitio. El `versions.engine` del snapshot deberia coincidir, pero
// para decidir si un documento quedo con ciencia anterior manda lo sellado en la fila, no lo copiado.
async function getDiagnosisEmissionVersions(
  evaluationId: string,
): Promise<{ emissionVersions: Record<string, unknown> | null; engineVersion: string | null }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("diagnoses")
    .select("emission_versions, engine_version")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`results-reader: emission_versions: `);
  return {
    emissionVersions: (data?.emission_versions as Record<string, unknown> | null) ?? null,
    engineVersion: data?.engine_version ?? null,
  };
}
