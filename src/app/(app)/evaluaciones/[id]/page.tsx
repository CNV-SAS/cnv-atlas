import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/modules/auth/session";
import { getBisImportEvaluationForId } from "@/modules/bis/data/bis-evaluations-reader";
import { CompositionSection } from "@/modules/diagnoses/components/composition-section";
import { EvaluationResults } from "@/modules/diagnoses/components/evaluation-results";
import { EvaluationTabs } from "@/modules/diagnoses/components/evaluation-tabs";
import { ProfessionalCriterion } from "@/modules/diagnoses/components/professional-criterion";
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
import { TreatmentPanel } from "@/modules/treatment/components/treatment-panel";
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
    const [entryConsent, entrySurvey, entryComposition, entryBisImport] = await Promise.all([
      getConsentStatusForEvaluation(id),
      getSurveyAnswersForEvaluation(id),
      getCompositionForEvaluation(id),
      getBisImportEvaluationForId(id),
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
  ]);

  const sexoM = (results.snapshot as { sexo?: string }).sexo !== "F";

  // Reparto por etapa (ST7 A2): Diagnostico conserva la evidencia del modelo + composicion +
  // criterio (se reordena en Parte B). Tratamiento recibe las rutas (salida del DFI) y el
  // protocolo. Seguimiento recibe la comparacion contra la evaluacion previa. El pulido de
  // Evaluacion/Tratamiento/Seguimiento es de bloques futuros; aqui solo se reubica.
  const rutas = results.compatible ? results.snapshot.dfi.rutas : [];

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
        />
      }
      tratamiento={
        <div className="flex flex-col gap-8">
          <RutasSection rutas={rutas} />
          {protocol ? (
            <TreatmentPanel evaluationId={id} protocol={protocol} />
          ) : (
            <StagePlaceholder label="Tratamiento" />
          )}
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
