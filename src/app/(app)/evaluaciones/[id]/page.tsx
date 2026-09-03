import { notFound, redirect } from "next/navigation";
import { Banda } from "@/components/shared/banda";
import { TituloSeccion } from "@/components/shared/titulo-pantalla";
import { VolverA } from "@/components/shared/volver-a";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/modules/auth/session";
import { getBisImportEvaluationForId } from "@/modules/bis/data/bis-evaluations-reader";
import {
  getActiveBisConditionCatalog,
  getBisConditionsReadonly,
  getBisIntakeForEvaluation,
  getEvaluationPatientSex,
} from "@/modules/bis-intake/data/bis-conditions-reader";
import { CorrectionEntry } from "@/modules/corrections/components/correction-entry";
import { CorrectionHistory } from "@/modules/corrections/components/correction-history";
import { SupersededBanner } from "@/modules/corrections/components/superseded-banner";
import { getCorrectionAvailability } from "@/modules/corrections/data/correction-availability-reader";
import { getSupersessionStatus } from "@/modules/corrections/data/supersession-reader";
import { CompositionSection } from "@/modules/diagnoses/components/composition-section";
import { ConfirmDiagnosisPanel } from "@/modules/diagnoses/components/confirm-diagnosis-panel";
import {
  abordajeProfesional,
  computeProtocoloEfectivo,
  dfiNarrativeFromOutput,
  indicatorSeverities,
  isEngineOutput,
} from "@/clinical-engine";
import {
  type AbordajeCardData,
  EvaluationResults,
} from "@/modules/diagnoses/components/evaluation-results";
import { EvaluationTabs } from "@/modules/diagnoses/components/evaluation-tabs";
import { formatDate, formatDateOnly, formatDateTime } from "@/lib/format/date";
import { ProfessionalCriterion } from "@/modules/diagnoses/components/professional-criterion";
import { RemisionesSection } from "@/modules/diagnoses/components/remisiones-section";
import { CelularSection } from "@/modules/diagnoses/components/celular-section";
import { getCelularBadgesForEvaluation } from "@/modules/diagnoses/data/celular-badges-reader";
import { RutasSection } from "@/modules/diagnoses/components/rutas-section";
import { REFERRAL_TARGET_LABEL } from "@/modules/referrals/components/patient-referrals-section";
import { getPendingReferralHints, listReferralsForTreatment } from "@/modules/referrals/data/referrals-reader";
import { SurveyDiagnosisSection } from "@/modules/diagnoses/components/survey-diagnosis-section";
import { missingDomainsFrom } from "@/modules/diagnoses/missing-domains";
import { GenerateDiagnosisPanel } from "@/modules/clinical-pipeline/components/generate-diagnosis-panel";
import { getCompositionForEvaluation } from "@/modules/diagnoses/data/composition-reader";
import { indicatorRange } from "@/modules/diagnoses/data/indicator-ranges";
import { getDiagnosisCriterion } from "@/modules/diagnoses/data/diagnosis-notes-reader";
import { resolvePatronView } from "@/modules/diagnoses/data/patron-view";
import {
  type EfrStateRef,
  getEfrStatesForModel,
} from "@/modules/diagnoses/data/efr-states-reader";
import {
  type EvaluationHeader,
  getEvaluationHeaderForSession,
  getEvaluationResults,
} from "@/modules/diagnoses/data/results-reader";
import { alertasDisponibles, encDesdeRespuestas } from "@/clinical-engine/alertas-disponibles";
import { AlertasClinicas } from "@/modules/diagnoses/components/alertas-clinicas";
import { EntradaEvaluacion } from "@/modules/evaluations/components/entrada-evaluacion";
import {
  IdentityConfirmation,
  type DuplicateCandidateView,
} from "@/modules/evaluations/components/identity-confirmation";
import { IdentityConflictResolution } from "@/modules/evaluations/components/identity-conflict-resolution";
import { getPendingIdentityCheck } from "@/modules/evaluations/data/evaluations-repository";
import {
  findDuplicateCandidates,
  getPatientIdentityById,
} from "@/modules/patients/data/patients-intake";
import { findDuplicatesForPatient } from "@/modules/patients/services/identity-resolution";
import { getConsentStatusForEvaluation } from "@/modules/evaluations/data/consent-status-reader";
import { getSurveyAnswersForEvaluation } from "@/modules/evaluations/data/survey-answers-reader";
import {
  getEvaluationCharacterization,
  getPatientProfileHasCharacterization,
} from "@/modules/evaluations/data/characterization-reader";
import { FollowupComparison } from "@/modules/followups/components/followup-comparison";
import { ProximoControl } from "@/modules/followups/components/proximo-control";
import { getProximoControl } from "@/modules/followups/data/proximo-control-reader";
import {
  SeguimientoSinPrevia,
  SeguimientoVisual,
} from "@/modules/followups/components/seguimiento-visual";
import { getSerieSeguimiento } from "@/modules/followups/data/serie-reader";
import { TrajectoryNotice } from "@/modules/followups/components/trajectory-notice";
import { getFollowupComparison } from "@/modules/followups/data/comparison-reader";
import { getTrajectoryNotice } from "@/modules/followups/data/trajectory-notice-reader";
import { EtapaReporte } from "@/modules/reports/components/etapa-reporte";
import {
  HcAntecedentes,
  HcDatosDelPaciente,
  HcDiagnosticoFuncional,
  HcFirmaYFecha,
  HcMetaTerapeutica,
  HcObjetivoTratamiento,
  HcPlanNutricional,
  HcProximaConsulta,
  HcRecomendaciones,
  HcIndicesAniBise,
  HcRemisiones,
  HcRutasActivadas,
  HcMotivoDeConsulta,
  HcObservaciones,
  HcResumenDiagnostico,
} from "@/modules/reports/components/historia-clinica";
import { resolverAntecedentes } from "@/modules/reports/data/hc-antecedentes-map";
import { CierreConsulta } from "@/modules/reports/components/cierre-consulta";
import { pendientesDeLaConsulta } from "@/modules/reports/data/cierre-pendientes";
import { getPatientConsents } from "@/modules/consent/data/consent-reader";
import { CONSENT_TYPE_LABELS } from "@/modules/consent/labels";
import { HcConsentimiento } from "@/modules/reports/components/hc-consentimiento";
import { HcImprimir } from "@/modules/reports/components/hc-imprimir";
import { getHcHeaderForEvaluation } from "@/modules/reports/data/hc-header-reader";
import { getUltimaEntregaHc } from "@/modules/reports/data/hc-entregas-writer";
import { HcEntregar } from "@/modules/reports/components/hc-entregar";
import { componerHistoriaClinica } from "@/modules/reports/data/hc-composicion";
import { ReportCard } from "@/modules/reports/components/report-card";
import { getReportCardForEvaluation } from "@/modules/reports/data/reports-repository";
import { canManageReports } from "@/modules/reports/policies/can-manage-reports";
import { bloqueCls } from "@/components/shared/bloque";
import { PatientStateHeader } from "@/modules/treatment/components/patient-state-header";
import { patronDeclarado } from "@/modules/treatment/services/patron-declarado";
import { DespachoSection } from "@/modules/treatment/components/despacho-section";
import { NutraDecisionSection } from "@/modules/treatment/components/nutra-decision-section";
import { SeccionRuta } from "@/modules/treatment/components/seccion-ruta";
import { NutraceuticalsSection } from "@/modules/treatment/components/nutraceuticals-section";
import { prescriptionSignature, sectionKey } from "@/modules/treatment/data/protocol-signature";
import {
  getPrescripcionNutricional,
  getProtKgPrescrito,
  getResumenProfesionForEvaluation,
} from "@/modules/treatment/data/dieta-resumen-reader";
import {
  ProfessionTreatmentSection,
  type TreatmentNarrative,
} from "@/modules/treatment/components/profession-treatment-section";
import { TreatmentSubtabs } from "@/modules/treatment/components/treatment-subtabs";
import { getPlanPaciente } from "@/modules/reports/data/plan-paciente-reader";
import { PlanImprimible } from "@/modules/reports/components/plan-imprimible";
import { getActorProfession } from "@/modules/treatment/data/actor-profession-reader";
import { getTreatmentProtocol } from "@/modules/treatment/data/treatment-reader";

export const metadata = { title: "Resultados - Atlas" };

// Placeholder de una etapa aun sin construir (Evaluacion / Tratamiento / Seguimiento se reubican
// en A2/A3; su pulido es de bloques futuros). Mover no es rediseñar.
// CABECERA DE PAGINA de la evaluacion (2026-08-29). Antes esta pantalla NO tenia ninguna: se llegaba
// desde el roster y, salvo que abrieras la etapa de Diagnostico, no decia de QUIEN era la evaluacion que
// estabas mirando.
//
// QUE LLEVA Y POR QUE ESO: el nombre del paciente como titulo y, como datos de cabecera, el TIPO, el
// documento y la fecha. El tipo ubica sin abrir nada (una inicial y un seguimiento se trabajan distinto) y
// sale de la MISMA consulta, una columna mas.
//
// VA EN BANDA COMPACTA (2026-09-03). Es el tercer sitio donde la banda se gana el espacio, por la misma
// razon que el detalle del paciente (la cabecera carga IDENTIDAD) pero con el peso invertido: debajo hay
// mil lineas de trabajo clinico, asi que ubica y se quita de en medio.
//
// Y LOS TRES DATOS CUMPLEN LA REGLA, verificado y no supuesto: tipo de evaluacion, documento y fecha son
// administrativos. Ninguno es una clasificacion, una severidad, un indice ni la edad bioelectrica, que es
// lo unico que no puede ir sobre el degradado (ver `banda.tsx`).
//
// LOS TRES PASAN DE UNA LINEA CONCATENADA A PARES ROTULO/VALOR. La linea "Inicial · CC 1.020.445.118 ·
// 14 ago 2026" obliga a parsear para saber que es cada trozo; con su rotulo encima se leen de un vistazo,
// que es lo que una cabecera tiene que hacer.
//
// (La razon original decia ademas que "la seccion la dice la barra superior". Ese rotulo se retiro el
// 2026-09-03, asi que esta pantalla es hoy el unico sitio que lo dice.)
//
// Y LA FECHA ES `created_at`, no la de medicion. Se conserva tal cual estaba antes en la etapa de
// Diagnostico para no cambiar en silencio la cronologia; queda anotado que la ficha del paciente usa la
// fecha de MEDICION para lo mismo, asi que las dos pantallas pueden mostrar dias distintos de la misma
// evaluacion. Es una discrepancia real y se reporta, no se resuelve aqui.
const TIPO_EVALUACION: Record<string, string> = { inicial: "Inicial", seguimiento: "Seguimiento" };

function CabeceraEvaluacion({ header }: { header: EvaluationHeader }) {
  const tipo = TIPO_EVALUACION[header.evaluationType] ?? header.evaluationType;
  return (
    <Banda
      compacta
      volver={
        <VolverA href={`/pacientes/${header.patientId}`}>Volver a la ficha del paciente</VolverA>
      }
      antetitulo="Evaluación"
      titulo={header.patientName}
      datos={[
        { rotulo: "Tipo", valor: tipo },
        { rotulo: "Documento", valor: header.documentLabel },
        { rotulo: "Fecha", valor: formatDate(header.evaluationDate) },
      ]}
    />
  );
}

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

  // Si esta evaluacion fue reemplazada por una correccion, un banner lo avisa (C2-b): no debe leerse
  // como vigente. Se resuelve para ambas ramas (con y sin diagnostico).
  const supersession = await getSupersessionStatus(id);

  const results = await getEvaluationResults(id);
  // Cabecera minima (trae el patientId): la necesitan LAS DOS ramas, porque la salida hacia la ficha
  // del paciente tiene que existir haya diagnostico o no.
  const header = await getEvaluationHeaderForSession(id);
  if (!results) {
    // Sin diagnostico todavia: si la evaluacion existe y es del profesional, estado vacio
    // elegante (no un 404 crudo). Si no existe o no es suya (RLS), sigue siendo 404.
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
    // Confirmar identidad DENTRO de la evaluacion (Santiago 2026-08-15, c): si esta en draft, se arma el
    // widget de confirmacion (o la resolucion de conflicto declarado-vs-registrado) y se coloca al inicio de
    // Encuesta. Fuera de draft (ya confirmada) -> null y se ve el flujo normal. Los duplicados solo aplican a
    // iniciales (en seguimiento el paciente ya quedo resuelto por documento).
    const pendingIdentity = await getPendingIdentityCheck(id);
    const identityDups: DuplicateCandidateView[] =
      pendingIdentity && !pendingIdentity.identityConflict && pendingIdentity.type === "inicial"
        ? await findDuplicatesForPatient(
            { getPatientIdentityById, findDuplicateCandidates },
            pendingIdentity.patientId,
          )
        : [];
    const identityNode = !pendingIdentity ? null : pendingIdentity.identityConflict ? (
      <IdentityConflictResolution
        evaluationId={pendingIdentity.evaluationId}
        registeredName={`${pendingIdentity.firstName} ${pendingIdentity.lastName}`.trim()}
        declaredName={`${pendingIdentity.declaredFirstName ?? ""} ${pendingIdentity.declaredLastName ?? ""}`.trim()}
      />
    ) : (
      <IdentityConfirmation evaluation={pendingIdentity} duplicateCandidates={identityDups} />
    );
    return (
      <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-4">
        <CabeceraEvaluacion header={header} />
        {supersession.superseded ? (
          <SupersededBanner newEvaluationId={supersession.newEvaluationId} />
        ) : null}
        <CorrectionHistory evaluationId={id} />
        <EvaluationTabs
        evaluacion={
          <div className="flex flex-col gap-6">
            {/* Las alertas van ARRIBA de la entrada: una bandera de conducta alimentaria manda derivar
                antes de seguir revisando, no despues. Se computan sobre las respuestas YA leidas, sin
                consulta nueva, igual que los antecedentes de la HC. */}
            <AlertasClinicas
              alertas={alertasDisponibles(
                encDesdeRespuestas(entrySurvey?.flatMap((d) => d.questions) ?? []),
              )}
            />
          <EntradaEvaluacion
            evaluationId={id}
            diagnosticoGenerado={false}
            consentStatus={entryConsent}
            surveyDomains={entrySurvey}
            composition={entryComposition}
            bisImportEval={entryBisImport}
            bisCatalog={entryCatalog}
            bisIntake={entryIntake}
            patientIsFemale={entrySex === "F"}
            bisReadonly={null}
            identityConfirmationSlot={identityNode}
          />
          </div>
        }
        tratamiento={<StagePlaceholder label="Tratamiento" />}
        seguimiento={<StagePlaceholder label="Seguimiento" />}
        reporte={
          // Sin diagnostico no hay nada que reportar ni que cerrar.
          <StagePlaceholder label="Reporte / HC" />
        }
        diagnostico={
          <div className="flex flex-col gap-6">
            {/* SIN REPETIR AL PACIENTE: el nombre, el documento y la fecha viven ahora en la cabecera
                de la PAGINA, visible desde las cinco etapas. Aqui solo queda el nombre de la etapa. */}
            <TituloSeccion>Resultados de la evaluación</TituloSeccion>
            <GenerateDiagnosisPanel
              evaluationId={id}
              identityConfirmed={!pendingIdentity}
              bisImported={entryBisImport?.alreadyImported === true}
            />
          </div>
        }
        />
      </div>
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
    trajectoryNotice,
    correctionAvailability,
    characterization,
    profileHasCharacterization,
    hcHeader,
    proximoControl,
    serie,
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
    // P0 Parte 2 (P5): por que el paciente no ve un cambio (recomputado en vivo). null si hay banda o inicial.
    getTrajectoryNotice(id),
    // CP3: si la evaluacion es de una version anterior de la encuesta, el boton "Corregir" se deshabilita.
    getCorrectionAvailability(id),
    // (m) Caracterizacion sociodemografica versionada de ESTA evaluacion, para el bloque de D8.
    getEvaluationCharacterization(id),
    // ¿El perfil tiene sociodemograficos? Para distinguir en D8 "no respondio" de "eval anterior al registro".
    getPatientProfileHasCharacterization(id),
    // Encabezado de la historia clinica (bloques 1 y 2).
    getHcHeaderForEvaluation(id),
    // Proximo control (Seguimiento, pieza 1): ruta activa, criterio de egreso y la cita.
    getProximoControl(id),
    // Serie del paciente para las tres visuales de Seguimiento.
    getSerieSeguimiento(id),
  ]);

  const sexoM = (results.snapshot as { sexo?: string }).sexo !== "F";

  // Antecedentes de la HC: se resuelven sobre las respuestas YA leidas (entrySurvey), sin consulta nueva.
  // La marca de "solo registro" sale del field_key de cada pregunta, no de una lista escrita a mano.
  const hcAntecedentes = resolverAntecedentes(entrySurvey?.flatMap((d) => d.questions) ?? []);
  // SELLO DE CONSENTIMIENTO de la historia clinica. Se leen del MISMO reader que usa la ficha del paciente
  // (`getPatientConsents`): una segunda lectura del mismo dato es como se crean las discrepancias, y este
  // es un documento probatorio. La etiqueta sale de `CONSENT_TYPE_LABELS`, tambien compartida.
  const hcAutorizaciones = protocol?.patientId
    ? (await getPatientConsents(protocol.patientId)).map((a) => ({
        tipo: a.tipo as string,
        etiqueta: CONSENT_TYPE_LABELS[a.tipo] ?? (a.tipo as string),
        necesaria: a.necesaria,
        vigente: a.vigente,
        firmadaEl: a.firmadaEl,
        version: a.version,
        revocadaEl: a.revocadaEl,
      }))
    : [];
  // Referencia + Δ (rango COMPLETO del motor) de los indicadores que viven en la tabla de Wang (FFMI/FMI/
  // AF/IR): del clasificador del motor (indicator-ranges), computadas aca porque tienen los indicadores.
  const wangRefs: Record<string, { reference: string; delta: string | null }> = {};
  if (isEngineOutput(results.snapshot)) {
    for (const code of ["FFMI", "FMI", "AF", "IR"]) {
      const r = indicatorRange(code, results.snapshot.indicators, sexoM);
      if (r) wangRefs[code] = r;
    }
  }

  // Patron alimentario (C9, D1): estado computado en vista desde la encuesta ya leida (no se sella; no
  // alimenta el diagnostico mientras C1 siga apagado). Sin encuesta -> no_capturado.
  const patron = resolvePatronView(entrySurvey ?? []);

  // D-009: el registro de remisión se ofrece al profesional que atiende, anclado al treatmentId sellado.
  // `today` para el default de fecha (página dinámica; el tiempo de request es el correcto). Las remisiones
  // pendientes de retorno alimentan el aviso suave de repetida (solo si hay treatmentId al que anclar).
  const referralToday = new Date().toISOString().slice(0, 10);
  const referralPendingHints =
    actorProfession.isProfessional && protocol?.treatmentId
      ? await getPendingReferralHints(protocol.treatmentId)
      : [];
  const referralRegister =
    actorProfession.isProfessional && protocol?.treatmentId
      ? {
          treatmentId: protocol.treatmentId,
          today: referralToday,
          actorProfession: actorProfession.profession,
          pendingHints: referralPendingHints,
        }
      : undefined;

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

  // Resumen funcional + meta terapeutica del DFI (pieza 1a.3, subpestaña del Nutricionista). Se DERIVAN del
  // snapshot (no se almacenan), asi que se recomputan solos y nunca quedan stale. Solo se emiten con snapshot
  // COMPATIBLE y DFI COMPLETO: el parrafo integra dominios de encuesta (envejecimiento/conductual/contextual)
  // y la meta sale de las rutas, ambos suspendidos con encuesta incompleta (Q28). Si no, se pasa el MOTIVO
  // para que el hueco lo explique (no un vacio mudo).
  let treatmentNarrative: TreatmentNarrative;
  if (!results.compatible) {
    treatmentNarrative = {
      kind: "unavailable",
      reason:
        "Este diagnóstico se emitió antes de portar el resumen funcional y la meta terapéutica al motor, por eso no aparecen aquí.",
    };
  } else if (!results.snapshot.dfi.complete) {
    treatmentNarrative = {
      kind: "unavailable",
      reason:
        "La encuesta está incompleta. El resumen funcional y la meta terapéutica se emiten cuando el diagnóstico está completo.",
    };
  } else {
    const n = dfiNarrativeFromOutput(results.snapshot);
    // Parrafo del PROFESIONAL que mira: de la encuesta y la composicion, no del snapshot del DFI. Es el
    // segundo de los dos resumenes de su §11c; el primero (el del DFI) va en Rutas de atencion.
    const parrafoProfesion = await getResumenProfesionForEvaluation(
      id,
      results.snapshot.sexo,
      actorProfession.profession,
      results.snapshot.indicators as unknown as Record<string, unknown>,
    );
    treatmentNarrative = {
      kind: "text",
      parrafoProfesion,
      parrafo: n.parrafo,
      metaNutricion: n.metas.nutricion,
    };
  }

  // LA PRESCRIPCION DEL MOTOR QUE GOBIERNA (`motorTratNutri`, Gildardo 2026-08-23 §1). Se computa al vuelo,
  // como los parrafos: no se sella. El snapshot conserva lo que `atlas-protocolo` computo al diagnosticar
  // (historia); lo que el profesional LEE hoy sale del motor vigente. Hasta el 2026-08-31 el panel mostraba
  // lo sellado, y a un hipertenso le decia "Sodio < 2300 mg/dia" con 1.500 ordenado ocho dias antes.
  //
  // LOS DOS ARGUMENTOS DE LA CADENA (peso efectivo y objetivo efectivo) NO SON OPCIONALES EN LA PRACTICA,
  // aunque el tipo los deje omitir: sin el peso, el motor cae a su default (Lorentz) y los gramos de
  // proteina que imprime NO son los de la cadena que el profesional esta mirando; sin el objetivo, el tipo
  // energetico del titulo se queda clavado en el que el motor calculo por su cuenta. Los dos se olvidaron
  // al conectar el motor el 2026-08-31: el parametro existia y ningun caller lo pasaba, que es la tercera
  // vez esta semana que una pieza terminada se queda sin su ultimo cable.
  // La proteina del motor, para los snapshots anteriores al 2026-09-03. Se resuelve ANTES que la cadena
  // porque la cadena la consume, y despues se vuelve a llamar al motor COMPLETO con el objetivo y el PAL
  // ya efectivos. No es la misma llamada dos veces por descuido: `protKg` no depende de esos dos, pero el
  // tipo energetico del titulo si, y ese solo se puede calcular cuando la cadena ya dio su objetivo.
  const protKgVigente = isEngineOutput(results.snapshot)
    ? await getProtKgPrescrito(
        id,
        results.snapshot.sexo,
        results.snapshot.indicators as unknown as Record<string, unknown>,
      )
    : null;
  const cadenaEfectiva =
    protocol?.protocolSuggested != null
      ? computeProtocoloEfectivo(protocol.protocolSuggested, {
          geb: protocol.adjGeb,
          pal: protocol.adjPal,
          kcalObj: protocol.adjKcalObj,
          protGkg: protocol.adjProtGkg,
          fatPct: protocol.adjFatPct,
          deficit: protocol.adjDeficit,
          pesoMeta: protocol.pesoMetaFijado,
        }, { protKgVigente })
      : null;
  const prescripcionNutricional = isEngineOutput(results.snapshot)
    ? await getPrescripcionNutricional(
        id,
        results.snapshot.sexo,
        results.snapshot.indicators as unknown as Record<string, unknown>,
        cadenaEfectiva?.pesoEfectivo ?? null,
        cadenaEfectiva != null ? Math.round(cadenaEfectiva.calorico.kcalObj) : null,
        cadenaEfectiva?.calorico.pal ?? null,
      )
    : null;

  // EL PLAN DEL PACIENTE, para la hoja imprimible de la subpestaña del nutricionista. MISMO lector que
  // alimenta el PDF del correo (`getPlanPaciente`): el papel y el correo no pueden decir cosas distintas,
  // y con una sola fuente no hay nada que sincronizar. null si la evaluación aún no tiene protocolo con
  // snapshot, que es cuando no hay plan que entregar.
  // La ultima entrega de la historia clinica, para decirlo en la pantalla: el profesional necesita poder
  // MOSTRAR que la entrego, que es para lo que existe la tabla.
  // `delivered_at` es un timestamptz, asi que se formatea con `formatDate` (zona de Colombia) y NO con
  // `formatDateOnly`, que es para las columnas `date` puras: convertir una fecha pura la retrocede un dia.
  const entregaHc = await getUltimaEntregaHc(id);
  const ultimaEntregaHc = entregaHc
    ? { fecha: formatDate(entregaHc.fecha), enviadaA: entregaHc.enviadaA }
    : null;

  const planPaciente = isEngineOutput(results.snapshot)
    ? await getPlanPaciente(id, results.snapshot)
    : null;

  // Los tres parrafos que la HC REUNE (bloques 5 a 7). Salen de lo ya derivado para el Diagnostico: la
  // historia clinica no recalcula, junta. Cuando no se pueden emitir, viaja el MOTIVO.
  // CIERRE de la consulta: los pendientes se DERIVAN del estado real en cada render, no se guardan, asi
  // que un pendiente resuelto despues del cierre deja de aparecer solo.
  // Bloque ANI BIS-E de la tabla de la HC: su historia clinica los muestra dentro de la tabla de Wang y
  // Atlas los tiene en la tabla de indices del Diagnostico. Se anaden SOLO aqui para no duplicarlos alli.

  // Bloque 12: las remisiones de ESTA consulta (ancladas al tratamiento, no al paciente).
  const hcRemisiones = protocol?.treatmentId ? await listReferralsForTreatment(protocol.treatmentId) : [];

  // Bloques 10 y 11: salen del protocolo SELLADO (protocol_suggested), no se recalculan. El sodio no
  // viaja: lo fija el motor de prescripcion que aun no se porta.
  const ps = protocol?.protocolSuggested ?? null;

  // LOS SEIS BLOQUES DE LA HISTORIA QUE SE ARMABAN AQUI SUELTOS ahora salen de UNA composicion
  // compartida (`componerHistoriaClinica`). No es limpieza: es la condicion para portar la historia a PDF
  // sin que el papel y la pantalla se desincronicen. Los bloques con lector propio (cabecera, antecedentes,
  // remisiones, autorizaciones) nunca fueron el riesgo, porque el PDF puede llamar al mismo lector; el
  // riesgo eran estos seis, que no tenian nombre en ninguna parte y un segundo sitio los habria armado a
  // su manera.
  const hcCompuesta = componerHistoriaClinica({
    protKgVigente,
    snapshot: isEngineOutput(results.snapshot)
      ? {
          indicators: results.snapshot.indicators as unknown as Record<string, number | null> & {
            FFMI: number;
          },
          classifications: results.snapshot.classifications as unknown as Record<string, unknown>,
        }
      : null,
    suggested: ps,
    ajustes: {
      geb: protocol?.adjGeb ?? null,
      pal: protocol?.adjPal ?? null,
      kcalObj: protocol?.adjKcalObj ?? null,
      protGkg: protocol?.adjProtGkg ?? null,
      fatPct: protocol?.adjFatPct ?? null,
      deficit: protocol?.adjDeficit ?? null,
      pesoMeta: protocol?.pesoMetaFijado ?? null,
    },
    sexoM,
    sodioMax: prescripcionNutricional?.sodioMax ?? null,
    protKg: prescripcionNutricional?.protKg ?? null,
    protG: prescripcionNutricional?.protG ?? null,
    d5_39:
      (entrySurvey ?? []).flatMap((d) => d.questions).find((q) => q.fieldKey === "d5_39")?.answerValue ??
      null,
    flags: { tieneHTA: ps?.flags.tieneHTA ?? false, tieneIRC: ps?.flags.tieneIRC ?? false },
    deficitEstrategia: ps?.estrategia.deficit ?? 0,
    // El peso EFECTIVO (el que gobierna la prescripcion), para traducir la hidratacion a litros y vasos.
    pesoKg: cadenaEfectiva?.pesoEfectivo ?? null,
  });
  const hcSev = hcCompuesta.severidades;
  const hcAni = hcCompuesta.indices;
  const hcPlan = hcCompuesta.plan;
  const hcRecs = hcCompuesta.recomendaciones;

  // LA HISTORIA REGISTRA LO PRESCRITO, NO LO SUGERIDO (defecto del smoke, 2026-09-01). Estos seis campos
  // salian del snapshot SELLADO (`ps.calorico`), que es la propuesta del modelo ANTES de los ajustes del
  // profesional. El plan que recibe el paciente sale de la cadena EFECTIVA. Resultado: los DOS DOCUMENTOS
  // DE LA MISMA CONSULTA decian cifras distintas. Con el paciente del smoke: el reporte llevaba el
  // objetivo que el nutricionista fijo y la historia registraba 2.574 kcal y 58 g de proteina, que es lo
  // que el modelo habia propuesto y nadie prescribio.
  //
  // Y no era solo el objetivo: `kcal_objetivo` y `proteina_g` (las columnas que se llenan AL APROBAR)
  // estan en null mientras el tratamiento sea borrador, asi que el fallback al sellado se usaba SIEMPRE en
  // borrador, que es cuando el profesional esta trabajando.
  //
  // Ahora es la MISMA funcion que usan el panel y el plan del paciente. Un documento clinico no puede
  // registrar una cifra que nadie prescribio.
  // Diagnosticos personales declarados (d5_39), para los bloques condicionales de recomendaciones.



  // El RESUMEN DIAGNOSTICO de la HC lleva la profesion del actor en el titulo, como el suyo. Y por eso
  // el CONTENIDO tiene que ser el de esa profesion: el parrafo de dieta es del nutricionista (es el que su
  // captura muestra bajo "RESUMEN DIAGNOSTICO · NUTRICIONISTA"), y para el resto va el abordaje por
  // profesion del motor. Titular con la profesion de quien mira un parrafo de dieta seria decir que el
  // modelo dice de su disciplina algo que no dijo.
  const hcEsNutricionista = actorProfession.profession === "nutricionista";
  const hcAbordaje = abordaje.kind === "text" ? abordaje.text : null;

  const hcNarrativa =
    treatmentNarrative.kind === "text"
      ? {
          parrafoDieta: treatmentNarrative.parrafoProfesion,
          parrafo: treatmentNarrative.parrafo,
          meta: treatmentNarrative.metaNutricion,
          motivo: null as string | null,
        }
      : { parrafoDieta: null, parrafo: null, meta: null, motivo: treatmentNarrative.reason };

  // Nombre de la segunda subpestaña de Tratamiento: la profesion del que mira (nunca hardcodeado). Admin o
  // actor sin profesion (que ve la vista de consulta) cae a un generico.
  const profesionLabel =
    actorProfession.isProfessional && actorProfession.profession
      ? (PROFESSION_LABEL[actorProfession.profession] ?? actorProfession.profession)
      : "Profesional";
  // Nutraceuticos (checkpoint 2.3): visibles en Rutas para toda profesion (Opcion A: el medico necesita
  // saber que se le da al paciente por interacciones farmaco-nutriente), pero SOLO el nutricionista edita
  // la prescripcion; el resto la ve en consulta. El despacho es acto de cualquier profesional sobre su
  // inventario. locked = diagnostico sin confirmar o protocolo aprobado (inmutable).
  const canPrescribeNutraceuticals =
    actorProfession.isProfessional && actorProfession.profession === "nutricionista";
  const nutraLocked = !protocol?.diagnosisConfirmed || Boolean(protocol?.approved);

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
    <div className="flex flex-col gap-4">
      {/* CABECERA DE PAGINA, con la SALIDA dentro. Las dos van al NIVEL DE PAGINA y no dentro de una
          pestaña: la evaluacion se abre desde la ficha del paciente, y desde cualquiera de las cinco
          etapas hay que saber DE QUIEN es y poder volver. El enlace es a un sitio concreto, no un "atras"
          del historial: quien llega desde un correo no tiene a donde volver. */}
      {header ? <CabeceraEvaluacion header={header} /> : null}
      {supersession.superseded ? (
        <SupersededBanner newEvaluationId={supersession.newEvaluationId} />
      ) : null}
      <CorrectionHistory evaluationId={id} />
      <EvaluationTabs
      evaluacion={
        <div className="flex flex-col gap-6">
        <AlertasClinicas
          alertas={alertasDisponibles(
            encDesdeRespuestas(entrySurvey?.flatMap((d) => d.questions) ?? []),
          )}
        />
        {/* Con diagnostico siempre hay medicion BIS (el pipeline la exige): se muestra la
            composicion y el import BIS no aplica (bisImportEval null).
            La correccion YA NO vive en Evaluacion (Santiago 2026-08-15, b): en Evaluacion el profesional
            REVISA la encuesta, no decide sobre un diagnostico. La via de correccion versionada se movio a
            la pantalla "Ver o editar encuesta" (encuesta/page.tsx) y sigue en Diagnostico. */}
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
          diagnosticoGenerado={Boolean(results)}
        />
        </div>
      }
      tratamiento={
        <div className="flex flex-col gap-8">
          {/* Estado del paciente (sector EFR + fenotipo): contexto de una linea que hace legible el
              abordaje del panel por profesion, sin ir y volver a Diagnostico (ajuste 2). Parte comun,
              para todas las profesiones. */}
          {patientState ? (
            <PatientStateHeader sector={patientState.sector} fenotipo={patientState.fenotipo} />
          ) : null}
          {/* Fase 0, checkpoint 1: la etapa se divide en DOS subpestañas (como el HTML), envolviendo el
              contenido que YA existe sin desarmar nada (el desarme del bloque viejo es checkpoint 2). El
              "Estado del paciente" queda arriba, comun a ambas. Rutas de atencion = comun (rutas + remisiones);
              [Profesion] = el workspace del profesional. */}
          <TreatmentSubtabs
            profesionLabel={profesionLabel}
            rutas={
              <div className="flex flex-col gap-8">
                {/* TITULOS DE SECCION NUMERADOS (cotejo 2026-08-24, punto A.1): su HTML numera y separa
                    los tres bloques de esta subpestaña, y se lee mejor que una pila sin rotulos. Se porta
                    la numeracion y el separador; sin guion largo (regla de estilo del proyecto). */}
                {/* EL PRIMERO DE LOS DOS RESUMENES (su §11c): "En mod ruta de atencion, el resumen del
                    diagnostico, LAS CONDICIONES ALTERADAS DEL DFI. Nada mas". Es el parrafo del DFI, que es
                    como el lo define en su archivo: "Resumen del diagnostico = DFI redactado como parrafo
                    (transcripcion de los 5 dominios; NO redaccion libre de IA)".
                    Estaba en la subpestana del profesional, junto al otro. Aqui es donde va, y su razon es
                    de uso: el que abre Rutas quiere saber que esta alterado antes de mirar que ruta se
                    activo. */}
                {treatmentNarrative.kind === "text" ? (
                  <section className={bloqueCls("derivado")}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Resumen del diagnóstico
                    </h3>
                    <p className="max-w-prose text-sm leading-relaxed text-foreground">
                      {treatmentNarrative.parrafo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Generado del diagnóstico. No editable.
                    </p>
                  </section>
                ) : null}
                <SeccionRuta n={1} titulo="Rutas de atención activadas" />
                <RutasSection rutas={rutas} />
                {/* Nutraceuticos (checkpoint 2.3): la prescripcion PRIMERO, el despacho DESPUES, para que se
                    lea la secuencia (primero se prescribe, luego se entrega) y nadie despache sin mirar lo
                    prescrito. El orden Rutas -> Nutraceuticos -> Remisiones sigue al HTML (Sec 1/2/3). */}
                <SeccionRuta n={2} titulo="Nutracéuticos recomendados" />
                {protocol ? (
                  <NutraceuticalsSection
                    key={sectionKey("nutraceuticos", prescriptionSignature(protocol))}
                    evaluationId={id}
                    protocol={protocol}
                    canPrescribe={canPrescribeNutraceuticals}
                    locked={nutraLocked}
                  />
                ) : null}
                {/* LA DECISION VA ANTES DE LA ENTREGA, y ese orden es el diseño: antes se entregaba sin
                    haber preguntado si el paciente puede tomarlos ni si los quiere.
                    Y NO APARECE SIN PRESCRIPCION GUARDADA: preguntar "¿el paciente los adquiere?" sin que
                    haya nada prescrito es preguntar si adquiere QUE. Se podia marcar "si" con la lista
                    vacia, que no significa nada. Ojo con la distincion, que es clinica: NO PRESCRIBIR no
                    es lo mismo que prescribir y que el paciente NO los compre; lo segundo es una
                    indicacion que no se cumple, y por eso la opcion "no" sigue existiendo aqui. */}
                {protocol && actorProfession.isProfessional && protocol.nutraceuticals.length > 0 ? (
                  <NutraDecisionSection evaluationId={id} protocol={protocol} locked={nutraLocked} />
                ) : null}
                {/* La entrega SOLO si la respuesta fue que si. Un aviso, no un formulario deshabilitado: un
                    bloque en gris invita a buscar como habilitarlo; una frase dice que falta. */}
                {protocol && actorProfession.isProfessional && protocol.nutraceuticals.length > 0 ? (
                  protocol.nutraceuticalDecision?.decision === "si" ? (
                    <DespachoSection evaluationId={id} protocol={protocol} />
                  ) : (
                    <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      {protocol.nutraceuticalDecision
                        ? "La entrega se habilita cuando el paciente los adquiere. Si cambia de decisión, actualízala arriba."
                        : "Registra arriba si el paciente los adquiere; la entrega se habilita entonces."}
                    </p>
                  )
                ) : null}
                <SeccionRuta n={3} titulo="Remisiones" />
                <RemisionesSection rutas={rutas} register={referralRegister} />
              </div>
            }
            profesion={
              <ProfessionTreatmentSection
                evaluationId={id}
                actor={actorProfession}
                protocol={protocol}
                abordaje={abordajeText}
                rutas={rutas}
                narrative={treatmentNarrative}
                patronAlimentario={patronDeclarado(
                  (entrySurvey ?? []).flatMap((d) =>
                    d.questions.map((q) => ({ fieldKey: q.fieldKey, valor: q.answerValue })),
                  ),
                )}
                prescripcion={prescripcionNutricional}
                planImprimible={
                  planPaciente ? (
                    <PlanImprimible
                      plan={planPaciente}
                      paciente={hcHeader?.paciente ?? "Paciente"}
                      fecha={formatDate(hcHeader?.fechaConsulta ?? new Date().toISOString())}
                    />
                  ) : null
                }
              />
            }
          />
          {/* EL REPORTE SE MOVIO A LA QUINTA ETAPA (2026-08-24). Aqui vivia por la decision del 2026-08-21,
              que decia "se QUEDA aqui, NO se mueve... No reabrir". Esa decision NO se ignoro: su PREMISA
              cambio, y estaba escrita en ella misma ("Atlas no tiene pestaña Reporte, y crear una quinta
              para mover algo que ya esta en su sitio no gana nada"). Ahora la quinta existe, y no se creo
              para mover el reporte: se creo porque el cotejo saco su historia clinica de once secciones,
              las cuatro salidas al paciente, y el cierre de la consulta, que no tenian donde vivir. Con esa
              pestaña, el reporte esta en su sitio alli. Se deja escrito para que no se lea como que se
              paso por encima de una decision tomada. */}
          {/* La correccion de la encuesta NO se duplica aqui: es el MISMO componente (misma ruta /corregir)
              que ya vive en el "Cierre del diagnostico" (junto a ConfirmDiagnosisPanel, en Diagnostico). Se
              quito la copia de Tratamiento (checkpoint 2, 2026-08-21): una sola via, en Diagnostico. */}
        </div>
      }
      seguimiento={
        // La comparacion aparece solo con una previa; el PROXIMO CONTROL aparece siempre, porque en la
        // PRIMERA consulta es justo cuando hace falta agendar. Antes de esto la unica via de fijar la cita
        // era confirmar un "empeoro", que exige una segunda medicion: un paciente que mejoro no tenia donde.
        <section className="flex flex-col gap-4">
          {/* Con UNA sola medicion su pantalla dibuja igual (el radar compara la medicion contra si misma).
              Aqui se dice que falta la segunda Y cuando corresponderia, con la frecuencia de la ruta. */}
          {serie.puntos.length >= 2 ? (
            <SeguimientoVisual serie={serie} />
          ) : (
            <SeguimientoSinPrevia
              fechaSugerida={proximoControl?.citaSugerida ?? null}
              frecuencia={proximoControl?.ruta?.frecuencia ?? null}
            />
          )}
          {comparison ? <FollowupComparison comparison={comparison} /> : null}
          {proximoControl ? (
            <ProximoControl evaluationId={id} vista={proximoControl} />
          ) : null}
        </section>
      }
      reporte={
        // QUINTA ETAPA, pieza 2 (2026-08-24): el reporte vive aqui, con su aprobacion, sus tres modos de
        // envio y su historial. Se MOVIO entero, sin partirlo: el flujo lo gobierna la propia ReportCard y
        // sus acciones revalidan la PAGINA (revalidatePath "/evaluaciones/[id]"), no una pestaña, asi que
        // cambiar de etapa no toca nada del acto. La proxima cita se va con el: se captura DENTRO de la
        // ReportCard (en la confirmacion de trayectoria desfavorable), no como un paso aparte.
        <section className="flex flex-col gap-4">
          {reportCard ? (
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-foreground">Reporte</h2>
              {/* P0 Parte 2 (P5): si el paciente NO verá un cambio (sin previa comparable o intervalo
                  corto), se explica al profesional junto al reporte, donde estaría la confirmación si la
                  hubiera. Recomputado en vivo; null si hay banda o es inicial. */}
              <TrajectoryNotice notice={trajectoryNotice} />
              <ReportCard report={reportCard} />
            </div>
          ) : (
            <EtapaReporte />
          )}
          {/* HISTORIA CLINICA de la consulta (bloques 1 a 3 de catorce, 2026-08-24). Se muestra aunque no
              haya reporte: la historia documenta la CONSULTA, no el envio. */}
          {hcHeader ? (
            // `imprimible`: al imprimir, esto es LO UNICO que sale en la hoja (ver globals.css). El
            // documento impreso es el mismo que el profesional tiene delante, sin una segunda
            // construccion que pueda desincronizarse.
            <div className="imprimible flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">Historia clínica</h2>
                <div className="flex flex-wrap items-start gap-3">
                  <HcImprimir />
                  <HcEntregar evaluationId={id} ultimaEntrega={ultimaEntregaHc} />
                </div>
              </div>
              <HcDatosDelPaciente
                datos={{
                  paciente: hcHeader.paciente,
                  edad: hcHeader.edad,
                  sexo: hcHeader.sexo,
                  pesoKg: composition?.peso ?? null,
                  tallaCm: composition?.talla ?? null,
                  fecha: formatDate(hcHeader.fechaConsulta),
                  profesional: hcHeader.profesional,
                  ocupacion: hcHeader.ocupacion,
                }}
              />
              <HcMotivoDeConsulta motivos={hcHeader.motivos} />
              <HcAntecedentes grupos={hcAntecedentes} />
              <HcResumenDiagnostico
                profesionLabel={profesionLabel}
                texto={hcEsNutricionista ? hcNarrativa.parrafoDieta : hcAbordaje}
                motivo={
                  hcEsNutricionista
                    ? hcNarrativa.motivo
                    : (hcAbordaje
                        ? null
                        : "El modelo tiene contenido para esta disciplina; su resumen todavía no se ha portado.")
                }
              />
              <HcDiagnosticoFuncional texto={hcNarrativa.parrafo} motivo={hcNarrativa.motivo} />
              <HcMetaTerapeutica texto={hcNarrativa.meta} motivo={hcNarrativa.motivo} />
              {/* Bloque 4: la MISMA tabla de Wang del Diagnostico, filtrada a lo alterado. No es una tabla
                  mas corta: es la regla de su HC (la historia muestra lo que esta mal, el diagnostico
                  muestra todo). Los VALORES son los sellados; los RANGOS son los del modelo vigente, y eso
                  se dice al pie en vez de sellarlos, para cubrir tambien los reportes ya emitidos. */}
              {composition ? (
                <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
                  <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                    Composición corporal · índices alterados
                  </h3>
                  <CompositionSection
                    composition={composition}
                    sexoM={sexoM}
                    classifications={results.snapshot.classifications}
                    sevByCode={hcSev}
                    references={wangRefs}
                    fenotipoMccb={results.snapshot.fenotipoMCCB ?? null}
                    soloAlterados
                  />
                  <HcIndicesAniBise indices={hcAni} />
                  <p className="text-xs text-muted-foreground">
                    Los valores son los de esta evaluación. Los rangos de referencia son los del modelo
                    vigente hoy, no los del día de la consulta.
                  </p>
                </section>
              ) : null}
              <HcObjetivoTratamiento texto={protocol?.objetivoTexto ?? null} />
              <HcPlanNutricional plan={hcPlan} />
              <HcRecomendaciones bloques={hcRecs} />
              <HcRemisiones
                remisiones={hcRemisiones.map((r) => ({
                  id: r.id,
                  destino:
                    r.referredTo === "otro"
                      ? (r.referredToOther ?? "Otro")
                      : (REFERRAL_TARGET_LABEL[r.referredTo] ?? r.referredTo),
                  motivo: r.reason,
                  fecha: formatDateOnly(r.referredAt),
                  retorno: r.returnedAt ? formatDateOnly(r.returnedAt) : null,
                }))}
              />
              <HcRutasActivadas
                rutas={rutas.map((r) => ({ id: r.id, label: r.label, activacion: r.activacion }))}
              />
              {/* OBSERVACIONES (§8.3): "deben aparecer en la historia, y POR CONSULTA, no por paciente".
                  Cuelgan del tratamiento de ESTA evaluacion, asi que lo de "por consulta" se cumple por
                  construccion. Van al final del cuerpo clinico, antes de la proxima cita y la firma:
                  es lo que el profesional anade despues de todo lo derivado. */}
              <HcObservaciones
                observaciones={(protocol?.notes ?? []).map((n) => ({
                  id: n.id,
                  note: n.note,
                  fecha: formatDateTime(n.createdAt),
                }))}
              />
              <HcProximaConsulta fecha={hcHeader.proximaCita ? formatDateOnly(hcHeader.proximaCita) : null} />
              {/* EL SELLO DE CONSENTIMIENTO va ANTES de la firma, que es donde cierra el documento: la
                  firma del profesional queda abajo del todo, como en cualquier documento clinico. */}
              <HcConsentimiento
                autorizaciones={hcAutorizaciones}
                versionDeLaConsulta={hcHeader.consentVersion}
              />
              <HcFirmaYFecha profesional={hcHeader.profesional} fecha={formatDate(hcHeader.fechaConsulta)} />
            </div>
          ) : null}
          {hcHeader ? (
            <CierreConsulta
              evaluationId={id}
              cerrada={hcHeader.estado === "completed"}
              cerradaPor={hcHeader.cerradaPor}
              cerradaEl={hcHeader.cerradaEl ? formatDate(hcHeader.cerradaEl) : null}
              pendientes={pendientesDeLaConsulta({
                encuestaCompleta: results.compatible ? results.snapshot.dfi.complete : true,
                diagnosticoConfirmado: Boolean(protocol?.diagnosisConfirmed),
                protocoloComputado: protocol?.protocolSuggested != null,
                protocoloAprobado: Boolean(protocol?.approved),
                reporteEstado: reportCard?.status ?? null,
                nutraceuticosDecision: protocol?.nutraceuticalDecision?.decision ?? null,
                proximaCita: hcHeader.proximaCita,
                remisionesSinRetorno: hcRemisiones.filter((r) => !r.returnedAt).length,
              })}
            />
          ) : null}
        </section>
      }
      diagnostico={
        // EvaluationResults ES el orquestador del Diagnostico: cabecera + franja persistentes + 3
        // subpestañas. La pagina le pasa como slots lo que ella arma (composicion, read-out D1-D8,
        // criterio, confirmar/corregir) y la vista los coloca en su pestaña. Un solo contenedor: sin
        // pila suelta que compita con las subpestañas.
        <EvaluationResults
          results={results}
          efrStates={efrStates}
          abordaje={abordaje}
          // D-007 Fase A: dominios de encuesta incompletos (derivados de lo sellado), para el aviso.
          missingDomains={
            results.compatible && !results.snapshot.dfi.complete
              ? missingDomainsFrom(results.snapshot.dfi.missingFieldKeys, entrySurvey)
              : []
          }
          composition={
            composition ? (
              <>
                <CompositionSection
                  composition={composition}
                  sexoM={sexoM}
                  classifications={results.snapshot.classifications}
                  sevByCode={
                    isEngineOutput(results.snapshot) ? indicatorSeverities(results.snapshot) : {}
                  }
                  references={wangRefs}
                  fenotipoMccb={results.snapshot.fenotipoMCCB ?? null}
                />
                {/* Nivel III · Salud celular. Estaba en Tratamiento (portada de donde el la tenia: su
                    subpestaña del nutricionista) y la movio Gildardo a Diagnostico el 2026-08-23: son
                    HALLAZGOS, no conducta. Va junto a la composicion, que es su vecina natural: las dos
                    leen los crudos del BIS por niveles de Wang. */}
                <CelularSection celular={await getCelularBadgesForEvaluation(id)} />
              </>
            ) : null
          }
          // Encuesta (D1-D8): D1 = patron; D2-D8 = read-out por dominio.
          surveyDiagnosis={
            <SurveyDiagnosisSection
              patron={patron}
              surveyDomains={entrySurvey}
              characterization={characterization}
              profileHasCharacterization={profileHasCharacterization}
            />
          }
          // Capa del profesional, separada de la evidencia del modelo (disciplina de snapshot).
          criterio={
            criterion ? <ProfessionalCriterion evaluationId={id} notes={criterion.notes} /> : null
          }
          // Cierre del diagnostico: confirmar (gate de estado) y corregir (versiona) UNIFICADOS bajo una
          // sola tarjeta (Santiago 2026-08-15: son los dos caminos para cerrar, van juntos), conservando la
          // distincion visual INTERNA (consecuencias muy diferentes: una cierra, otra crea version nueva). El
          // criterio del profesional queda APARTE (su propio slot): es la lectura clinica, no el cierre.
          confirmCorrect={
            <Card>
              <CardHeader>
                <CardTitle>Cierre del diagnóstico</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Dos caminos: confirmar el diagnóstico (lo cierra y habilita prescribir) o corregirlo
                  (crea una versión nueva).
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <ConfirmDiagnosisPanel
                  evaluationId={results.evaluationId}
                  confirmed={results.confirmed}
                  confirmedAt={results.confirmedAt}
                  confirmedByName={results.confirmedByName}
                />
                <CorrectionEntry evaluationId={id} availability={correctionAvailability} />
              </CardContent>
            </Card>
          }
        />
      }
      />
    </div>
  );
}
