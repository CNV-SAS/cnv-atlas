import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

import { formatDateLong } from "@/lib/format/date";
import { BisImportForm } from "@/modules/bis/components/bis-import-form";
import type { BisImportEvaluation } from "@/modules/bis/data/bis-evaluations-reader";
import { BisConditionsCapture } from "@/modules/bis-intake/components/bis-conditions-capture";
import { BisConditionsReadonly } from "@/modules/bis-intake/components/bis-conditions-readonly";
import type { BisConditionsReadonly as BisConditionsReadonlyData } from "@/modules/bis-intake/data/bis-conditions-reader";
import { evaluateBisImportGate } from "@/modules/bis-intake/services/import-gate";
import type { BisConditionCatalog, BisIntakeRecord } from "@/modules/bis-intake/types";
import { CompositionSection } from "@/modules/diagnoses/components/composition-section";
import { DetailsSection } from "@/modules/diagnoses/components/details-section";
import { SarcopeniaCard } from "@/modules/diagnoses/components/sarcopenia-card";
import type { Composition } from "@/modules/diagnoses/data/composition-reader";

import { ConsentStatusCard } from "./consent-status-card";
import { EvaluationSubtabs } from "./evaluation-subtabs";
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
  bisReadonly,
  identityConfirmationSlot = null,
}: {
  evaluationId: string;
  consentStatus: ConsentStatus | null;
  surveyDomains: SurveyDomain[] | null;
  composition: Composition | null;
  // Confirmar identidad, DENTRO de la evaluacion (Santiago 2026-08-15, c): la accion se movio de la lista
  // aca, al INICIO de Encuesta, cuando la evaluacion esta en draft. null si ya esta confirmada (in_progress).
  // Lo arma la pagina (tiene los datos del pendiente + duplicados); este componente solo lo coloca.
  identityConfirmationSlot?: ReactNode;
  // Vista para importar BIS desde aqui (reusa el modulo bis del panel). null si la evaluacion no
  // esta in_progress (identidad sin confirmar) o ya no aplica.
  bisImportEval: BisImportEvaluation | null;
  // Sub-bloque B: catalogo activo de condiciones + captura ya guardada (si existe) + sexo, para la
  // captura de condiciones y el gate del import. null cuando la identidad no esta confirmada.
  bisCatalog: BisConditionCatalog | null;
  bisIntake: BisIntakeRecord | null;
  patientIsFemale: boolean;
  // Captura sellada en SOLO LECTURA (tras el diagnostico, ya no editable). null si no hay o si la
  // captura editable aplica.
  bisReadonly: BisConditionsReadonlyData | null;
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

  // Aviso de SECUENCIA (care Santiago 2026-08-15): Antropometria DEPENDE de Encuesta. Si la identidad
  // esta confirmada pero las condiciones de la toma aun no se guardaron, la segunda subpestaña lo dice y
  // remite a la primera (sin las condiciones, el import no se habilita). "contraindicated" ya se captura.
  const conditionsPending = identityConfirmed && !gate.allowed && gate.reason !== "contraindicated";

  // ASMI y AF para el diagnostico de sarcopenia (EWGSOP2): se leen de las filas de la composicion (ASMI =
  // MMEM/talla^2 computado; AF = columna del equipo). La fuerza prensil NO se captura hoy -> null (la card
  // lo dice, ver SarcopeniaCard). sexoM = paciente no femenino.
  const compRows = composition?.levels.flatMap((l) => l.rows) ?? [];
  const sarcopeniaAsmi = compRows.find((r) => r.key === "asmi")?.value ?? null;
  const sarcopeniaAf = compRows.find((r) => r.key === "AF")?.value ?? null;

  // SUBPESTAÑA 1 · ENCUESTA: consentimiento + encuesta del paciente + condiciones de la toma BIS. Es lo
  // PRIMERO de la secuencia; la subpestaña 2 depende de que esto este hecho.
  const encuestaPanel = (
    <div className="flex flex-col gap-8">
      {/* Confirmar identidad (draft): PRIMERO en la secuencia. Habilita las condiciones de la toma y el
          import. Cuando ya esta confirmada, el slot es null y se ve el flujo normal. */}
      {identityConfirmationSlot}
      {consentStatus ? <ConsentStatusCard status={consentStatus} /> : null}

      {/* Resumen de la encuesta: estado (respondidas/total), sin desplegar las preguntas. El detalle
          completo, en solo lectura, vive en una pantalla aparte. */}
      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">Encuesta del paciente</h3>
          {/* "Ver o editar" (no solo "ver"): la pantalla deja editar (pre-diagnostico) o corregir versionado
              (con diagnostico). El boton decia "ver" cuando tambien edita (Santiago 2026-08-15, b). */}
          <Link
            href={`/evaluaciones/${evaluationId}/encuesta`}
            className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
          >
            Ver o editar encuesta
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

      {/* Condiciones de la toma BIS: se responden ANTES del import. El sistema impone el orden; sin este
          checklist guardado, el import (en Antropometría) no se habilita. Se muestra tambien cuando ya hay
          medicion (caso borde: registrar condiciones despues de un BIS previo). */}
      {identityConfirmed && bisCatalog ? (
        <BisConditionsCapture
          evaluationId={evaluationId}
          catalog={bisCatalog}
          intake={bisIntake}
          patientIsFemale={patientIsFemale}
        />
      ) : bisReadonly ? (
        <BisConditionsReadonly data={bisReadonly} />
      ) : null}
    </div>
  );

  // SUBPESTAÑA 2 · ANTROPOMETRIA Y BIS: import del archivo + composicion corporal. (La sarcopenia y las
  // referencias entran en el siguiente paso.) Depende de la subpestaña Encuesta: el aviso lo hace explicito.
  const antropometriaPanel = (
    <div className="flex flex-col gap-8">
      {conditionsPending ? (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-lg border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning"
        >
          <span className="font-medium">Primero, las condiciones de la toma</span>
          <span>
            Responde y guarda las condiciones de la toma BIS en la subpestaña{" "}
            <span className="font-semibold">Encuesta</span>: sin ellas no se habilita el import.
          </span>
        </div>
      ) : null}

      {/* Seccion Medicion BIS SIEMPRE presente (no aparece/desaparece: eso confunde). Con medicion,
          muestra un mensaje de exito PERSISTENTE + la composicion; sin medicion, el import GATEADO
          (boton deshabilitado con explicacion en gris). Mismo criterio de "estados vacios limpios". */}
      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-foreground">Medición BIS</h3>
        {composition ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-clinical-optimal/40 bg-clinical-optimal-bg px-3 py-2">
              <CheckCircle2 className="size-4 shrink-0 text-clinical-optimal" aria-hidden />
              <span className="text-sm font-medium text-clinical-optimal">
                Medición BIS importada
                {composition.measurementDate
                  ? ` · tomada el ${formatDateLong(composition.measurementDate)}`
                  : ""}
                .
              </span>
            </div>
            <DetailsSection title="Composición corporal (Niveles de Wang)">
              <CompositionSection composition={composition} showDiagnosis={false} />
            </DetailsSection>
          </div>
        ) : !identityConfirmed || !bisImportEval ? (
          <p className="text-sm text-muted-foreground">
            Aún sin medición BIS. Confirma la identidad del paciente para poder importar la medición
            (XLSX de Biody Manager).
          </p>
        ) : !gate.allowed && gate.reason === "contraindicated" ? (
          <p className="text-sm font-semibold text-clinical-critical">
            Import bloqueado: hay una contraindicación (marcapasos). No se realiza la bioimpedancia.
            Ver el detalle en las condiciones de la toma (subpestaña Encuesta).
          </p>
        ) : (
          <BisImportForm
            evaluation={bisImportEval}
            disabledReason={
              gate.allowed
                ? null
                : "Responde y guarda las condiciones de la toma (subpestaña Encuesta) para habilitar el import."
            }
          />
        )}
      </section>

      {/* Diagnostico de sarcopenia (EWGSOP2): fuerza + ASMI + AF. Solo con medicion (necesita ASMI/AF de la
          composicion). La fuerza prensil no se captura hoy: la card lo dice ("sin dato"), no lo inventa. */}
      {composition ? (
        <SarcopeniaCard asmi={sarcopeniaAsmi} af={sarcopeniaAf} sexoM={!patientIsFemale} />
      ) : null}
    </div>
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

      <EvaluationSubtabs encuesta={encuestaPanel} antropometria={antropometriaPanel} />
    </div>
  );
}
