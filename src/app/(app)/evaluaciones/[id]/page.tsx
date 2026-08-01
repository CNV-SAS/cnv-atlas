import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { getBisImportEvaluationForId } from "@/modules/bis/data/bis-evaluations-reader";
import {
  getActiveBisConditionCatalog,
  getBisConditionsReadonly,
  getBisIntakeForEvaluation,
  getEvaluationPatientSex,
} from "@/modules/bis-intake/data/bis-conditions-reader";
import { CompositionSection } from "@/modules/diagnoses/components/composition-section";
import { abordajeProfesional } from "@/clinical-engine";
import {
  type AbordajeCardData,
  EvaluationResults,
} from "@/modules/diagnoses/components/evaluation-results";
import { EvaluationTabs } from "@/modules/diagnoses/components/evaluation-tabs";
import { ProfessionalCriterion } from "@/modules/diagnoses/components/professional-criterion";
import { RemisionesSection } from "@/modules/diagnoses/components/remisiones-section";
import { RutasSection } from "@/modules/diagnoses/components/rutas-section";
import { SurveyDiagnosisSection } from "@/modules/diagnoses/components/survey-diagnosis-section";
import { getCompositionForEvaluation } from "@/modules/diagnoses/data/composition-reader";
import { getDiagnosisCriterion } from "@/modules/diagnoses/data/diagnosis-notes-reader";
import {
  type EfrStateRef,
  getEfrStatesForModel,
} from "@/modules/diagnoses/data/efr-states-reader";
import {
  getEvaluationHeaderForSession,
  getEvaluationResults,
} from "@/modules/diagnoses/data/results-reader";
import { EntradaEvaluacion } from "@/modules/evaluations/components/entrada-evaluacion";
import { getConsentStatusForEvaluation } from "@/modules/evaluations/data/consent-status-reader";
import { getSurveyAnswersForEvaluation } from "@/modules/evaluations/data/survey-answers-reader";
import { FollowupComparison } from "@/modules/followups/components/followup-comparison";
import { getFollowupComparison } from "@/modules/followups/data/comparison-reader";
import { ReportCard } from "@/modules/reports/components/report-card";
import { getReportCardForEvaluation } from "@/modules/reports/data/reports-repository";
import { canManageReports } from "@/modules/reports/policies/can-manage-reports";
import { PatientStateHeader } from "@/modules/treatment/components/patient-state-header";
import { ProfessionTreatmentSection } from "@/modules/treatment/components/profession-treatment-section";
import { getActorProfession } from "@/modules/treatment/data/actor-profession-reader";
import { getTreatmentProtocol } from "@/modules/treatment/data/treatment-reader";

export const metadata = { title: "Resultados - Atlas" };

// Placeholder de una etapa aun sin construir (Evaluacion / Tratamiento / Seguimiento se reubican
// en A2/A3; su pulido es de bloques futuros). Mover no es rediseñar.
function StagePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="max-w-prose text-sm text-muted-foreground">
        Esta etapa se construye en un bloque posterior.
      </p>
    </div>
  );
}

// Vista interna del profesional con los resultados clinicos de una evaluacion (B12).
// La policy gobierna el rol (regla 3); el alcance fino (que sea su paciente) lo impone la
// RLS en el reader: si no es suyo, getEvaluationResults devuelve null -> 404.
export default async function ResultadosEvaluacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!canManageReports(user)) redirect("/no-autorizado");

  const results = await getEvaluationResults(id);
  if (!results) {
    // Sin diagnostico todavia: si la evaluacion existe y es del profesional, estado vacio
    // elegante (no un 404 crudo). Si no existe o no es suya (RLS), sigue siendo 404.
    const header = await getEvaluationHeaderForSession(id);
    if (!header) notFound();
    // La etapa de ENTRADA existe desde el intake, con o sin diagnostico: consentimiento, encuesta y
    // composicion cruda. Es el uso principal de la pestana Evaluacion (revisar la entrada ANTES de
    // generar el diagnostico), asi que se puebla tambien en esta rama sin diagnostico.
    const [
      entryConsent,
      entrySurvey,
      entryComposition,
      entryBisImport,
      entryCatalog,
      entryIntake,
      entrySex,
    ] = await Promise.all([
      getConsentStatusForEvaluation(id),
      getSurveyAnswersForEvaluation(id),
      getCompositionForEvaluation(id),
      getBisImportEvaluationForId(id),
      getActiveBisConditionCatalog(),
      getBisIntakeForEvaluation(id),
      getEvaluationPatientSex(id),
    ]);
    return (
      <EvaluationTabs
        evaluacion={
          <EntradaEvaluacion
            evaluationId={id}
            consentStatus={entryConsent}
            surveyDomains={entrySurvey}
            composition={entryComposition}
            bisImportEval={entryBisImport}
            bisCatalog={entryCatalog}
            bisIntake={entryIntake}
            patientIsFemale={entrySex === "F"}
            bisReadonly={null}
          />
        }
        tratamiento={<StagePlaceholder label="Tratamiento" />}
        seguimiento={<StagePlaceholder label="Seguimiento" />}
        diagnostico={
          <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                Resultados de la evaluación
              </h1>
              <p className="text-muted-foreground">
                {header.patientName} · {header.documentLabel} ·{" "}
                {new Date(header.evaluationDate).toLocaleDateString("es-CO")}
              </p>
            </header>
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-foreground">
                Esta evaluación aún no tiene un diagnóstico generado.
              </p>
              <p className="max-w-prose text-sm text-muted-foreground">
                Confirma la identidad, importa la medición BIS y genera el diagnóstico desde el
                panel de Evaluaciones. Los resultados aparecerán aquí cuando el motor haya corrido.
              </p>
              <Link
                href="/evaluaciones"
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Ir a Evaluaciones
              </Link>
            </div>
          </div>
        }
      />
    );
  }

  // Protocolo de tratamiento (B13): el tratamiento ya existe (lo crea el pipeline al
  // generar el diagnostico); aqui se lee para que el profesional lo enriquezca.
  // La comparacion de seguimiento aparece solo si hay una evaluacion previa (null si es
  // la primera del paciente).
  const [
    protocol,
    comparison,
    composition,
    criterion,
    reportCard,
    efrStates,
    entryConsent,
    entrySurvey,
    entryReadonly,
    actorProfession,
  ] = await Promise.all([
    getTreatmentProtocol(id),
    getFollowupComparison(id),
    getCompositionForEvaluation(id),
    getDiagnosisCriterion(id),
    getReportCardForEvaluation(id),
    // Contenido de referencia de los 81 estados, por el model_version_id del diagnostico (V2).
    results.modelVersionId
      ? getEfrStatesForModel(results.modelVersionId)
      : Promise.resolve<Record<number, EfrStateRef>>({}),
    // Etapa de entrada (pestana Evaluacion): consentimiento + encuesta.
    getConsentStatusForEvaluation(id),
    getSurveyAnswersForEvaluation(id),
    // Condiciones BIS selladas en solo lectura (la captura ya no es editable tras el diagnostico).
    getBisConditionsReadonly(id),
    // Perfil profesional del actor (B1): decide que seccion de tratamiento por profesion ve.
    getActorProfession(user.id),
  ]);

  const sexoM = (results.snapshot as { sexo?: string }).sexo !== "F";

  // Abordaje por profesion (6ª card del estado EFR): ORIENTACION que se computa en tiempo de vista
  // (clinical-engine/abordaje.ts), no se sella. Depende de la profesion del que mira. Solo se computa
  // el texto cuando el snapshot es compatible (si no, EvaluationResults ya retorna el aviso de
  // "formato anterior" antes de la card).
  const PROFESSION_LABEL: Record<string, string> = {
    medico: "Médico",
    psicologo: "Psicólogo",
    deportologo: "Deportólogo",
    nutricionista: "Nutricionista",
  };
  let abordaje: AbordajeCardData;
  if (!actorProfession.isProfessional) {
    abordaje = { kind: "not-professional" };
  } else if (!actorProfession.profession) {
    abordaje = { kind: "no-profession" };
  } else {
    const key = results.compatible ? results.snapshot.efrPhenotype.key : null;
    const text = key ? abordajeProfesional(key, actorProfession.profession) : null;
    abordaje = text
      ? {
          kind: "text",
          professionLabel: PROFESSION_LABEL[actorProfession.profession] ?? actorProfession.profession,
          text,
        }
      : { kind: "no-profession" }; // clave malformada (defensivo; no ocurre en snapshots compatibles)
  }

  // Reparto por etapa (ST7 A2): Diagnostico conserva la evidencia del modelo + composicion +
  // criterio (se reordena en Parte B). Tratamiento recibe las rutas (salida del DFI) y el
  // protocolo. Seguimiento recibe la comparacion contra la evaluacion previa. El pulido de
  // Evaluacion/Tratamiento/Seguimiento es de bloques futuros; aqui solo se reubica.
  // Contenido de las rutas activas, congelado en el snapshot (T1). [] para snapshots incompatibles o
  // previos a T1 (la seccion muestra "sin rutas" en vez de tronar).
  const rutas = results.rutasContent;
  // Texto del abordaje del rol del actor para el panel de consulta (medico/deportologo); null si el
  // snapshot es incompatible o la profesion no aplica.
  const abordajeText = abordaje.kind === "text" ? abordaje.text : null;
  // Estado del paciente para la cabecera comun de Tratamiento (sector EFR + fenotipo), ya sellado en el
  // snapshot; solo cuando el snapshot es compatible (los previos a B11 no tienen esta forma).
  const patientState = results.compatible
    ? { sector: results.snapshot.frSector, fenotipo: results.snapshot.structural }
    : null;

  return (
    <EvaluationTabs
      evaluacion={
        // Con diagnostico siempre hay medicion BIS (el pipeline la exige): se muestra la
        // composicion y el import BIS no aplica (bisImportEval null).
        <EntradaEvaluacion
          evaluationId={id}
          consentStatus={entryConsent}
          surveyDomains={entrySurvey}
          composition={composition}
          bisImportEval={null}
          bisCatalog={null}
          bisIntake={null}
          patientIsFemale={false}
          bisReadonly={entryReadonly}
        />
      }
      tratamiento={
        <div className="flex flex-col gap-8">
          {/* Estado del paciente (sector EFR + fenotipo): contexto de una linea que hace legible el
              abordaje del panel por profesion, sin ir y volver a Diagnostico (ajuste 2). Parte comun,
              para todas las profesiones. */}
          {patientState ? (
            <PatientStateHeader sector={patientState.sector} fenotipo={patientState.fenotipo} />
          ) : null}
          <RutasSection rutas={rutas} />
          <RemisionesSection rutas={rutas} />
          <ProfessionTreatmentSection
            evaluationId={id}
            actor={actorProfession}
            protocol={protocol}
            abordaje={abordajeText}
            rutas={rutas}
          />
          {/* Reporte: cierre de la etapa de Tratamiento (es su salida). La aprobacion/envio la
              gobierna la propia ReportCard; aqui solo cambia donde se renderiza. */}
          {reportCard ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-foreground">Reporte</h2>
              <ReportCard report={reportCard} />
            </section>
          ) : null}
        </div>
      }
      seguimiento={
        comparison ? (
          <FollowupComparison comparison={comparison} />
        ) : (
          <StagePlaceholder label="Seguimiento" />
        )
      }
      diagnostico={
        <div className="flex flex-col gap-8">
          {/* Evidencia del modelo, orden conclusion -> detalle (cabecera, mapas, DFI, tablas
              colapsables, versiones al pie). La composicion va como colapsable dentro. */}
          <EvaluationResults
            results={results}
            efrStates={efrStates}
            abordaje={abordaje}
            composition={
              composition ? (
                <CompositionSection
                  composition={composition}
                  sexoM={sexoM}
                  classifications={results.snapshot.classifications}
                />
              ) : null
            }
          />
          {/* Diagnostico de encuesta (D1-D8): contenido de otra naturaleza, detras de un clic,
              para que no compita con el nucleo. Placeholder hasta que Gildardo lo entregue. */}
          <SurveyDiagnosisSection />
          {/* Capa del profesional, separada de la evidencia del modelo (disciplina de snapshot). */}
          {criterion ? (
            <ProfessionalCriterion evaluationId={id} notes={criterion.notes} />
          ) : null}
        </div>
      }
    />
  );
}
