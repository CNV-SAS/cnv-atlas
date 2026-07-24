import Link from "next/link";

import { BisImportForm } from "@/modules/bis/components/bis-import-form";
import type { BisImportEvaluation } from "@/modules/bis/data/bis-evaluations-reader";
import { BisConditionsCapture } from "@/modules/bis-intake/components/bis-conditions-capture";
import { evaluateBisImportGate } from "@/modules/bis-intake/services/import-gate";
import type { BisConditionCatalog, BisIntakeRecord } from "@/modules/bis-intake/types";
import { CompositionSection } from "@/modules/diagnoses/components/composition-section";
import { DetailsSection } from "@/modules/diagnoses/components/details-section";
import type { Composition } from "@/modules/diagnoses/data/composition-reader";

import { ConsentStatusCard } from "./consent-status-card";
import type { ConsentStatus } from "../data/consent-status-reader";
import type { SurveyDomain } from "../data/survey-answers-reader";

// Etapa de ENTRADA (pestana Evaluacion): que entro y se verifico antes del diagnostico. Orden
// consentimiento (la puerta) -> encuesta del paciente (solo lectura) -> composicion corporal cruda.
// La composicion reusa CompositionSection con showDiagnosis=false: muestra solo "que entro"
// (Variable, Valor, Referencia, Δ), SIN el veredicto (clasificacion OMS + columna Diagnostico), que
// es materia de Diagnostico. Lee de bis_raw_values (crudo). Presentacion pura desde readers RLS. Las
// condiciones de la toma BIS, la fuerza prensil y la meta de peso van en el sub-bloque B (Gildardo).
export function EntradaEvaluacion({
  evaluationId,
  consentStatus,
  surveyDomains,
  composition,
  bisImportEval,
  bisCatalog,
  bisIntake,
  patientIsFemale,
}: {
  evaluationId: string;
  consentStatus: ConsentStatus | null;
  surveyDomains: SurveyDomain[] | null;
  composition: Composition | null;
  // Vista para importar BIS desde aqui (reusa el modulo bis del panel). null si la evaluacion no
  // esta in_progress (identidad sin confirmar) o ya no aplica.
  bisImportEval: BisImportEvaluation | null;
  // Sub-bloque B: catalogo activo de condiciones + captura ya guardada (si existe) + sexo, para la
  // captura de condiciones y el gate del import. null cuando la identidad no esta confirmada.
  bisCatalog: BisConditionCatalog | null;
  bisIntake: BisIntakeRecord | null;
  patientIsFemale: boolean;
}) {
  // Identidad confirmada (in_progress): se puede capturar condiciones e importar. La ausencia de
  // bisImportEval significa que aun no esta lista (o ya paso a diagnostico, otra rama).
  const identityConfirmed = bisImportEval != null;
  const gate = evaluateBisImportGate(bisIntake);
  // Contador respondidas/total con el total REAL de preguntas del instrumento (no hardcodeado): el
  // reader devuelve todas las preguntas con answerValue null si no se respondio.
  const domains = surveyDomains ?? [];
  const total = domains.reduce((acc, d) => acc + d.questions.length, 0);
  const answered = domains.reduce(
    (acc, d) => acc + d.questions.filter((q) => q.answerValue != null && q.answerValue !== "").length,
    0,
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Entrada de la evaluación
        </h2>
        <p className="text-sm text-muted-foreground">
          Lo que entró y se verificó antes del diagnóstico: consentimiento, encuesta y medición.
        </p>
      </header>

      {consentStatus ? <ConsentStatusCard status={consentStatus} /> : null}

      {/* Resumen de la encuesta: estado (respondidas/total), sin desplegar las preguntas. El detalle
          completo, en solo lectura, vive en una pantalla aparte. */}
      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">Encuesta del paciente</h3>
          <Link
            href={`/evaluaciones/${evaluationId}/encuesta`}
            className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
          >
            Ver encuesta
          </Link>
        </div>
        {total > 0 ? (
          <p className="text-sm text-muted-foreground">
            {answered} de {total} preguntas respondidas.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Esta evaluación aún no tiene respuestas de encuesta.
          </p>
        )}
      </section>

      {/* Condiciones de la toma BIS (Parte 2): se responden ANTES del import. El sistema impone el
          orden; sin este checklist guardado, el import no se habilita. Se muestra tambien cuando ya
          hay medicion (caso borde: registrar condiciones despues de un BIS previo). */}
      {identityConfirmed && bisCatalog ? (
        <BisConditionsCapture
          evaluationId={evaluationId}
          catalog={bisCatalog}
          intake={bisIntake}
          patientIsFemale={patientIsFemale}
        />
      ) : null}

      {/* Con medicion BIS: la composicion (solo "que entro"). Sin medicion: el import BIS desde
          aqui, GATEADO por las condiciones (orden + contraindicacion), o un aviso si la identidad
          aun no esta confirmada. */}
      {composition ? (
        <DetailsSection title="Composición corporal (Niveles de Wang)">
          <CompositionSection composition={composition} showDiagnosis={false} />
        </DetailsSection>
      ) : (
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-semibold text-foreground">Medición BIS</h3>
          {!identityConfirmed || !bisImportEval ? (
            <p className="text-sm text-muted-foreground">
              Aún sin medición BIS. Confirma la identidad del paciente para poder importar la
              medición (XLSX de Biody Manager).
            </p>
          ) : gate.allowed ? (
            <BisImportForm evaluation={bisImportEval} />
          ) : gate.reason === "contraindicated" ? (
            <p className="text-sm font-semibold text-clinical-critical">
              Import bloqueado: hay una contraindicación (marcapasos). No se realiza la
              bioimpedancia. Ver el detalle en las condiciones de la toma, arriba.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Responde y guarda las condiciones de la toma para habilitar el import de la medición
              BIS.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
