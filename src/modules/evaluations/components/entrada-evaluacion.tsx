import { CompositionSection } from "@/modules/diagnoses/components/composition-section";
import { DetailsSection } from "@/modules/diagnoses/components/details-section";
import type { Composition } from "@/modules/diagnoses/data/composition-reader";

import { ConsentStatusCard } from "./consent-status-card";
import { SurveyReadonly } from "./survey-readonly";
import type { ConsentStatus } from "../data/consent-status-reader";
import type { SurveyDomain } from "../data/survey-answers-reader";

// Etapa de ENTRADA (pestana Evaluacion): que entro y se verifico antes del diagnostico. Orden
// consentimiento (la puerta) -> encuesta del paciente (solo lectura) -> composicion corporal cruda.
// La composicion reusa CompositionSection SIN clasificaciones del snapshot (classifications={}), ya
// que en la etapa de evaluacion aun no hay diagnostico: la columna Diagnostico degrada a guion. La
// tabla numerica lee de bis_raw_values (crudo). Presentacion pura desde readers RLS. Las condiciones
// de la toma BIS, la fuerza prensil y la meta de peso van en el sub-bloque B (esperan a Gildardo).
export function EntradaEvaluacion({
  consentStatus,
  surveyDomains,
  composition,
  sexoM,
}: {
  consentStatus: ConsentStatus | null;
  surveyDomains: SurveyDomain[] | null;
  composition: Composition | null;
  sexoM: boolean;
}) {
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

      <DetailsSection title="Encuesta del paciente (D1-D8)">
        <SurveyReadonly domains={surveyDomains ?? []} />
      </DetailsSection>

      <DetailsSection title="Composición corporal (Niveles de Wang)">
        {composition ? (
          <CompositionSection composition={composition} sexoM={sexoM} classifications={{}} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Aún sin medición BIS importada para esta evaluación. La composición aparece aquí cuando
            se importe el XLSX de Biody.
          </p>
        )}
      </DetailsSection>
    </div>
  );
}
