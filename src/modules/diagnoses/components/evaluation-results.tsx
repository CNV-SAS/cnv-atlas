import { type ReactNode } from "react";
import { Ban, Brain, Dna, HeartPulse, Hourglass, type LucideIcon, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type EngineIndicators, indicatorSeverities, isBisDerivedDomain } from "@/clinical-engine";

import { DetailsSection } from "./details-section";
import { MapsSection } from "./maps-section";
import type { EvaluationResults as Results } from "../data/results-reader";
import type { EfrStateRef } from "../data/efr-states-reader";
import { isProvisionalCalibration } from "@/modules/clinical-pipeline/emission-versions";

import { indicatorRange } from "../data/indicator-ranges";
import { SEV_LABEL } from "../severity-labels";
import { OPTIMO_DOT, RISK_SEV, SEV_CLS } from "./risk-severity";
import { VerdictStrip } from "./verdict-strip";
import { DiagnosisSubtabs } from "./diagnosis-subtabs";
import { formatDate } from "@/lib/format/date";

// Vista INTERNA del profesional: resultados clinicos de una evaluacion (B12). Presentacion
// pura desde el snapshot inmutable + contenido EFR. Sin PII al exterior; el profesional
// autorizado (RLS) ve el nombre del paciente. Lenguaje funcional (BRAND / DATA_GOVERNANCE).

const INDICATORS: { code: string; key: keyof EngineIndicators }[] = [
  { code: "IFC", key: "ifc" },
  { code: "IRC", key: "irc" },
  { code: "PABU", key: "pabu" },
  { code: "ICA-BIS", key: "icaBis" },
  { code: "ISCM", key: "iscm" },
  { code: "IEHH", key: "iehh" },
  { code: "IAE", key: "iae" },
  { code: "EB", key: "eb" },
  { code: "FMI", key: "FMI" },
  { code: "FFMI", key: "FFMI" },
  { code: "AF", key: "AF" },
  { code: "IR", key: "IR" },
];

// Severidad de dominio DFI (0-3): la etiqueta (SEV_LABEL) viene de severity-labels; el color, de
// risk-severity (fuente unica compartida con la franja de veredicto, para que no diverjan).
// Icono lucide por dominio del DFI (ayuda de lectura, NO emoji). Color neutro: el icono
// identifica el dominio, no señala riesgo (eso lo hace el badge de severidad).
const DOMAIN_ICON: Record<string, LucideIcon> = {
  d1: Zap, // Celular-Electrico
  d2: HeartPulse, // Metabolico-Estructural
  d3: Hourglass, // Envejecimiento
  d4: Brain, // Conductual-Perceptual
  d5: Dna, // Epigenetico-Contextual
};

function fmtNum(v: number | null, code?: string): string {
  if (v == null) return "N/D";
  // D-016: el angulo de fase SIEMPRE con 1 decimal (2 sugieren una exactitud que el equipo no tiene).
  // Solo el AF; el resto de indicadores conserva su formato (2 decimales / entero).
  if (code === "AF") return v.toFixed(1);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function Line({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="text-sm text-foreground">
      <span className="font-medium text-muted-foreground">{label}: </span>
      {value}
    </p>
  );
}

// Tarjeta de contenido del estado EFR (una de las 6 de la Diana). Tolera el vacio (algunos
// estados no traen todos los campos) y el caso "pendiente" (abordaje por profesion). El motivo
// tecnico (Q9: efrProf no expuesto) vive en docs/GILDARDO_QUERIES.md, no en pantalla.
function ContentCard({
  label,
  value,
  pending,
}: {
  label: string;
  value: string | null;
  pending?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {pending ? (
        <span className="text-sm italic text-muted-foreground">Disponible próximamente.</span>
      ) : value ? (
        <p className="text-sm text-foreground">{value}</p>
      ) : (
        <span className="text-sm text-muted-foreground">Sin dato para este estado.</span>
      )}
    </div>
  );
}

// Abordaje por profesion (6ª card del estado EFR): ORIENTACION que se computa en tiempo de vista
// (ver clinical-engine/abordaje.ts). Lo computa la pagina (tiene la profesion del actor + la clave
// sellada) y lo pasa ya resuelto; esta card solo lo renderiza.
export type AbordajeCardData =
  | { kind: "text"; professionLabel: string; text: string } // profesional con profesion configurada
  | { kind: "no-profession" } // profesional sin profesion configurada
  | { kind: "not-professional" }; // no es profesional tratante (p. ej. admin)

function AbordajeCard({ abordaje }: { abordaje: AbordajeCardData }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Abordaje por profesión
      </span>
      {abordaje.kind === "text" ? (
        <>
          {/* Rotulo de la profesion que el sistema cree que es la tuya: hace visible una mala
              configuracion (un deportologo mal puesto como medico veria orientacion medica). */}
          <span className="text-xs text-muted-foreground">Abordaje para: {abordaje.professionLabel}</span>
          <p className="text-sm text-foreground">{abordaje.text}</p>
          <span className="text-xs italic text-muted-foreground">
            Orientación para ti; no se imprime en el reporte del paciente.
          </span>
        </>
      ) : abordaje.kind === "no-profession" ? (
        <span className="text-sm text-muted-foreground">
          El abordaje se adapta a tu especialidad. Contacta al administrador para que configure tu
          profesión y poder verlo.
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">
          El abordaje por profesión es orientación para el profesional tratante.
        </span>
      )}
    </div>
  );
}

export function EvaluationResults({
  results,
  composition,
  efrStates,
  abordaje,
  missingDomains = [],
  criterio = null,
  confirmCorrect = null,
  surveyDiagnosis = null,
}: {
  results: Results;
  composition?: ReactNode;
  // Nodos que la pagina arma y esta vista COLOCA en su subpestaña: el criterio del profesional y el par
  // confirmar/corregir van en Funcional; el read-out D1-D8 en Encuesta. Slots (no logica) para no
  // arrastrar sus tipos ni sus componentes cliente aqui.
  criterio?: ReactNode;
  confirmCorrect?: ReactNode;
  surveyDiagnosis?: ReactNode;
  // Contenido de referencia de los 81 estados para explorar la Diana (V2). Vacio si no hay
  // diagnostico/registry: la exploracion queda deshabilitada.
  efrStates: Record<number, EfrStateRef>;
  // Abordaje por profesion ya resuelto por la pagina (tiempo de vista).
  abordaje: AbordajeCardData;
  // D-007 Fase A: dominios de encuesta (que alimentan el diagnostico) que quedaron incompletos. La
  // pagina los deriva de dfi.missingFieldKeys + la seccion de cada pregunta. Solo INFORMA (no suprime).
  missingDomains?: string[];
}) {
  // Snapshot de una era anterior del motor (stub-0.1.0 pre-B11): forma incompatible con
  // esta vista. Se informa en vez de tronar (reports es inmutable, no se puede migrar).
  if (!results.compatible) {
    return (
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Resultados de la evaluación
          </h1>
          <p className="text-muted-foreground">
            {results.patientName} · {results.documentLabel} ·{" "}
            {formatDate(results.evaluationDate)}
          </p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Diagnóstico no disponible con este formato</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-foreground">
              El diagnóstico de esta evaluación se generó con una versión anterior del motor
              {results.engineVersion ? ` (${results.engineVersion})` : ""} y no puede mostrarse en
              este formato.
            </p>
            <p className="text-sm text-muted-foreground">
              Los datos siguen almacenados de forma inmutable. Para ver un diagnóstico con el
              formato actual, realiza una nueva evaluación del paciente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { snapshot, efrState } = results;
  const { indicators, classifications, efrPhenotype, structural, fenotipoMCCB, frSector, dfi, versions } =
    snapshot;
  const sexM = snapshot.sexo === "M"; // para los rangos de referencia por sexo (indicator-ranges)
  // Marca de calibracion provisional de EB-BIS/IAE (P0). Se lee del campo SELLADO del diagnostico
  // (emission_versions.calibration), NO de una constante: el dia que exista la calibracion
  // poblacional, los diagnosticos nuevos dejan de marcarse solos. Primer uso real de emission_versions.
  const ebIaeProvisional = isProvisionalCalibration(results.emissionVersions);
  // Severidad por indicador (recomputada del snapshot) para el punto de color de la clasificacion.
  const sevByCode = indicatorSeverities(snapshot);
  // Contenido del estado del paciente, SIEMPRE del snapshot inmutable (para el panel permanente y
  // para la celda propia durante la exploracion; nunca del registry).
  const patientContent = {
    diagnosisName: efrState?.diagnosisName ?? efrPhenotype.diagnostico ?? null,
    mechanism: efrState?.mechanism ?? null,
    biomarkers: efrState?.biomarkers ?? null,
    risks: efrState?.risks ?? null,
    suggestedNutraceuticals: efrState?.suggestedNutraceuticals ?? efrPhenotype.nutraceuticos ?? null,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Resultados de la evaluación
          </h1>
          {results.confirmed ? (
            <Badge className="bg-clinical-optimal-bg text-clinical-optimal">
              Diagnóstico confirmado
            </Badge>
          ) : (
            <Badge variant="outline">Pendiente de confirmar</Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          {results.patientName} · {results.documentLabel} ·{" "}
          {formatDate(results.evaluationDate)}
        </p>
      </header>

      {/* Caveat de validez sellado en el snapshot: bajo que condicion(es) que comprometen la validez
          se hizo la medicion. Solo si las hay (snapshots previos a este bloque no lo traen). */}
      {results.validityCaveats.length > 0 ? (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-lg border-2 border-clinical-warning bg-clinical-warning-bg p-4"
        >
          <p className="text-sm font-bold text-clinical-warning">Resultado con reserva de validez</p>
          <p className="text-sm text-foreground/90">
            Medición realizada bajo{" "}
            {results.validityCaveats.length === 1
              ? "una condición que compromete"
              : "condiciones que comprometen"}{" "}
            la validez: {results.validityCaveats.map((c) => c.label).join(", ")}. El resultado debe
            interpretarse con reserva.
          </p>
        </div>
      ) : null}

      {/* Franja de veredicto PERSISTENTE: la conclusion (estado EFR + riesgo + ruta) siempre visible por
          encima de las subpestañas, para que ninguna no la esconda (care a). Ruta prioritaria = la primera
          de las autoritativas del DFI, como PUNTERO a Tratamiento (no se duplica su contenido). */}
      <VerdictStrip
        stateNumber={efrPhenotype.stateNumber}
        efrName={patientContent.diagnosisName}
        riskLevel={dfi.riesgo.nivel}
        riskScore={dfi.riesgo.score}
        dfiComplete={dfi.complete}
        rutaPrioritaria={dfi.rutas[0] ?? null}
      />

      {/* Tres subpestañas (QUE de Gildardo, COMO nuestro). Default Funcional (DIV-7). */}
      <DiagnosisSubtabs
        funcional={
          <div className="flex flex-col gap-8">
            {/* Orden conclusion -> detalle (V3): el DFI (riesgo integrado + 5 dominios) va arriba,
                luego los mapas (Diana + radar), pegado el detalle de las 6 cards del estado, y la tabla
                completa de indices. Las rutas (salida del DFI) viven en la etapa de Tratamiento. */}
            <Card>
        <CardHeader>
          <CardTitle>Diagnóstico Funcional Integral (DFI)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!dfi.complete ? (
            // RED / SUSPENSION Q28 (NO se quita). Desde el bloqueo de generacion (Gildardo 2026-08-13 §1),
            // un diagnostico NUEVO nunca se sella incompleto: se completa la encuesta ANTES de generar. Este
            // aviso SOLO se alcanza para diagnosticos ya sellados incompletos ANTES del bloqueo. Gildardo la
            // pidio explicita como red: "si el bloqueo falla o alguien llega por otra ruta, el sistema no
            // emitira una edad bioelectrica inventada". Por eso se conserva aunque parezca inalcanzable.
            // (Se retiro el enlace "completar por correccion": ese flujo YA NO EXISTE; el completar es
            // pre-diagnostico. Un incompleto ya sellado se recupera por el flujo general de correccion.)
            <div className="flex flex-col gap-1 rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
              <span className="font-medium">
                {dfi.degradedReason ?? "El diagnóstico se emitio con la encuesta incompleta."}
              </span>
              {missingDomains.length ? (
                <span>Faltan estos dominios de la encuesta: {missingDomains.join(", ")}.</span>
              ) : null}
              <span>
                No se emitieron la edad bioeléctrica, el índice contextual ni las rutas que dependen de la
                encuesta: no se calculan sobre respuestas que faltan. El diagnóstico bioeléctrico (de la
                medición) se emite igual. El desglose de dominios de abajo es provisional (sobre lo
                respondido), no la lectura definitiva.
              </span>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Riesgo integrado:</span>
              {dfi.complete ? (
                <Badge className={SEV_CLS[RISK_SEV[dfi.riesgo.nivel] ?? 1]}>
                  {dfi.riesgo.nivel} · {dfi.riesgo.score}
                </Badge>
              ) : (
                // Q28: el riesgo integrado es un promedio ponderado de los cinco dominios, DOS de ellos
                // (envejecimiento y contextual) inflados sobre defaults con la encuesta incompleta. No se
                // muestra el nivel concreto (seria el ALTO inflado); se marca provisional hasta completar la
                // encuesta. Si Gildardo decide que se conserve como orientacion, se relaja (P-21).
                <Badge className={SEV_CLS[1]}>Provisional</Badge>
              )}
              {dfi.veto ? <Badge className={SEV_CLS[3]}>Veto activo</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {dfi.complete
                ? dfi.riesgo.descripcion
                : "El riesgo integrado se recalcula al completar la encuesta: depende de dominios que hoy salen sobre respuestas que faltan."}
            </p>
          </div>

          {/* Banner del veto conductual: cadena EXACTA del frozen (ATLAS_v8.html _DFIView). Sin el aviso, el
              badge "Veto activo" no orienta: el profesional no ve la instruccion (prioridad psicologica,
              excluir intervencion nutricional restrictiva). Si el veto debe ser CANDADO (bloquear la
              prescripcion) y no solo aviso, es decision de Gildardo (va a la ronda): hoy no se consume en
              tratamiento, solo aparece la ruta conductual como prioritaria. */}
          {dfi.veto ? (
            <div className="flex items-start gap-2 rounded-md border border-clinical-critical/40 bg-clinical-critical-bg px-3 py-2 text-sm text-clinical-critical">
              <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="font-medium">
                Alerta conductual activa: la prioridad es el abordaje psicológico. Queda excluida toda
                intervención nutricional restrictiva.
              </span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {dfi.domains.map((d) => {
              const Icon = DOMAIN_ICON[d.id];
              // Q28: con la encuesta incompleta, los dominios que dependen de ella (d3 envejecimiento, d4
              // conductual, d5 contextual) se marcan NO EVALUABLES en vez de pintar una severidad calculada
              // sobre defaults (d3/d5 salen de EB-BIS/ICEC, las mismas salidas suspendidas; mostrar su badge
              // contradiria el "no se emitieron"). d1/d2 salen de la medicion (BIS) y se muestran igual.
              const noEvaluable = !dfi.complete && !isBisDerivedDomain(d.id);
              return (
              <div key={d.id} className="flex flex-col gap-1 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
                    {d.nombre}
                  </span>
                  {noEvaluable ? (
                    <Badge className="bg-muted text-muted-foreground">No evaluable</Badge>
                  ) : (
                    <Badge className={SEV_CLS[Math.min(3, Math.max(0, d.sev))]}>
                      {SEV_LABEL[Math.min(3, Math.max(0, d.sev))]}
                    </Badge>
                  )}
                </div>
                {noEvaluable ? (
                  <p className="text-sm text-muted-foreground">
                    Pendiente de completar la encuesta: este dominio depende de respuestas que faltan.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">{d.clasif}</p>
                    <p className="text-sm text-foreground">{d.lectura}</p>
                    {d.items.length ? (
                      <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                        {d.items.map((it, i) => (
                          <li key={i}>{it}</li>
                        ))}
                      </ul>
                    ) : null}
                    {/* Mensaje por dominio del veto conductual: cadena EXACTA del frozen (_DFICard). */}
                    {d.veto ? (
                      <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-clinical-critical">
                        <Ban className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        Veto conductual: no iniciar intervención nutricional restrictiva.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Mapas del estado: la Diana (posicion entre los 81 estados) y el radar (severidad por
          dominio), juntos como lectura de un vistazo. */}
      <Card>
        <CardHeader>
          <CardTitle>Mapas del estado</CardTitle>
        </CardHeader>
        <CardContent>
          <MapsSection
            bands={efrPhenotype.bands}
            stateNumber={efrPhenotype.stateNumber}
            frSectorName={frSector.nombre}
            structuralName={structural.nombre}
            patientContent={patientContent}
            statesContent={efrStates}
            radarDomains={dfi.domains}
            dfiComplete={dfi.complete}
          />
        </CardContent>
      </Card>

      {/* Detalle del estado EFR: identidad del estado + las 6 tarjetas de contenido, pegadas a la
          Diana y ancladas al estado del paciente (5 del snapshot inmutable + abordaje pendiente de
          Q9). Titulo distinto del DFI para no confundir la lectura del profesional. */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle del estado EFR</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Line
              label="Estado EFR"
              value={`${efrPhenotype.stateNumber} de 81`}
            />
            {/* Fenotipo estructural = MCCB (F1-F12), rotulo de Gildardo (Q19). Los diagnosticos
                viejos no traen el MCCB en el snapshot: caen a la de nueve estados (el dato que si
                tenian sellado), para no mostrar vacio. */}
            <Line
              label="Fenotipo estructural (FMI × FFMI)"
              value={fenotipoMCCB ? `${fenotipoMCCB.id} · ${fenotipoMCCB.nombre}` : structural.nombre}
            />
            <Line label="Estado funcional bioeléctrico (IFC × IRC)" value={frSector.nombre} />
          </div>
          {/* La clasificacion de nueve estados (FFMI x FMI) NO es un cuarto fenotipo: es el componente
              estructural con que se compone el estado EFR (su mitad FFMI x FMI; la otra es el sector
              funcional). Se muestra subordinada, rotulada por lo que es, para no competir con el MCCB
              (que responde otra pregunta) y porque es lo que quedo sellado en phenotype_id de todos los
              diagnosticos emitidos: si desapareciera de pantalla, habria un dato en el registro que
              nadie podria ver. */}
          {fenotipoMCCB ? (
            <p className="text-xs text-muted-foreground">
              El estado EFR combina el sector funcional (IFC × IRC) y el componente estructural
              (FFMI × FMI): <span className="font-medium text-foreground">{structural.nombre}</span>.
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ContentCard
              label="Enfermedades / Complicaciones probables"
              value={efrState?.diagnosisName ?? efrPhenotype.diagnostico ?? null}
            />
            <ContentCard
              label="Mecanismos bioquímicos / Disfunción celular"
              value={efrState?.mechanism ?? null}
            />
            <ContentCard label="Biomarcadores clave" value={efrState?.biomarkers ?? null} />
            <ContentCard label="Riesgos clínicos" value={efrState?.risks ?? null} />
            {/* Excepcion de negocio: "Nutracéuticos sugeridos", no "Vitacellebis" del HTML; a
                futuro puede haber otras lineas. El resto de los titulos son fieles al HTML. */}
            <ContentCard
              label="Nutracéuticos sugeridos"
              value={efrState?.suggestedNutraceuticals ?? efrPhenotype.nutraceuticos ?? null}
            />
            <AbordajeCard abordaje={abordaje} />
          </div>
        </CardContent>
      </Card>

      {/* Detalle granular en colapsables: indicadores ABIERTOS (valor diferencial de CNV, deben
          verse), composicion CERRADA (30 filas de detalle). */}
      <DetailsSection title="Indicadores ANI-BIS-E" defaultOpen>
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Indicador</th>
                  <th className="py-2 pr-4 text-right font-medium">Valor</th>
                  <th className="py-2 pr-4 text-right font-medium">Referencia</th>
                  <th className="py-2 pr-4 text-right font-medium">Δ</th>
                  <th className="py-2 font-medium">Clasificación</th>
                </tr>
              </thead>
              <tbody>
                {INDICATORS.map(({ code, key }) => {
                  // EB-BIS no tiene clasificador propio en el frozen (a proposito). Su veredicto de
                  // envejecimiento ES el del IAE (IAE = EB - edad cronologica), y el HTML lo muestra asi:
                  // referencia = edad cronologica (= EB - IAE), Δ = IAE, clasificacion = la del IAE. No toca
                  // la matematica del frozen; es la capa de display resolviendo la fila (g2, 2026-08-15).
                  const isEb = code === "EB";
                  const edadCronologica =
                    isEb && indicators.eb != null && indicators.iae != null
                      ? indicators.eb - indicators.iae
                      : null;
                  const range = indicatorRange(code, indicators, sexM);
                  const refText = isEb
                    ? edadCronologica != null
                      ? edadCronologica.toFixed(1)
                      : "-"
                    : (range?.reference ?? "-");
                  const deltaText = isEb
                    ? indicators.iae != null
                      ? `${indicators.iae >= 0 ? "+" : ""}${indicators.iae.toFixed(1)}`
                      : "-"
                    : (range?.delta ?? "-");
                  // EB toma la severidad y la etiqueta del IAE (comparten el veredicto de envejecimiento).
                  const classCode = isEb ? "IAE" : code;
                  const sev = sevByCode[classCode];
                  const classLabel = classifications[classCode]?.label ?? "N/D";
                  return (
                  <tr key={code} className="border-b border-border/60 transition-colors hover:bg-muted/30">
                    <td className="py-2 pr-4">
                      <span className="font-medium text-foreground">{code}</span>
                      {results.indicatorNames[code] ? (
                        <span className="text-muted-foreground"> · {results.indicatorNames[code]}</span>
                      ) : null}
                      {ebIaeProvisional && (code === "EB" || code === "IAE") ? (
                        <span
                          className="ml-2 rounded bg-clinical-warning-bg px-1.5 py-0.5 text-[10px] font-semibold text-clinical-warning"
                          title="Calibración provisional; no comunicable al paciente."
                        >
                          provisional
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-foreground">
                      {fmtNum(indicators[key], code)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                      {refText}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                      {deltaText}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        {sev != null ? (
                          <span
                            className={`size-2 shrink-0 rounded-full ${OPTIMO_DOT[sev as number]}`}
                            aria-hidden
                          />
                        ) : null}
                        <span>{classLabel}</span>
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="max-w-prose text-xs text-muted-foreground">
            Referencia = rango de normalidad clínico ANI-BIS-E, ajustado por sexo, tomado del
            clasificador del modelo: es el rango de normalidad cuando el indicador tiene dos límites,
            o el umbral que lo separa de la alerta cuando tiene uno solo. Δ = valor menos esa
            referencia. El FFMI también aparece en Composición corporal con la referencia del equipo
            Biody (otra fuente); por eso su referencia puede diferir entre las dos tablas, no es una
            contradicción.
          </p>
          {ebIaeProvisional ? (
            <p className="max-w-prose text-xs text-clinical-warning">
              EB e IAE se calculan con una <span className="font-semibold">calibración provisional</span>{" "}
              (aún sin población de referencia). Son para tu lectura clínica; no son comunicables al
              paciente y no aparecen en su reporte.
            </p>
          ) : null}
          {/* Δ = valor − referencia de normalidad (CA-2 de Gildardo: promedio del rango si tiene dos
              bordes, el corte si es de un solo limite; SUSTITUYE la regla del HTML "distancia al borde",
              pendiente de su aprobacion). Referencia = rango clinico ANI-BIS-E sexo-ajustado
              (indicator-ranges.ts). Los de un solo limite (ISCM, IEHH, IR) muestran su umbral; IFC/IRC/
              FMI van "-" hasta Q20. FFMI aparece tambien en la tabla de Composicion con la referencia del
              EQUIPO Biody (columna del export): otra fuente, otro numero; la nota visible de arriba lo
              aclara (hallazgo de smoke 2026-08-01). */}
        </div>
      </DetailsSection>

            {/* Criterio del profesional (+ IA) y el par confirmar/corregir: la lectura y el cierre, en
                Funcional, sin ir y volver a otra pestaña. */}
            {criterio}
            {confirmCorrect}
          </div>
        }
        composicion={
          composition ?? (
            <p className="w-fit rounded-md border border-dashed border-border px-3 py-1 text-sm italic text-muted-foreground">
              Esta evaluación no tiene composición corporal registrada.
            </p>
          )
        }
        encuesta={surveyDiagnosis}
      />

      {/* Composicion ya NO va colapsable: ahora es una pestaña (colapsar dentro de un contenedor que ya
          es pestaña seria esconder dos veces). Su contenido se rinde directo arriba (composicion={...}). */}

      {/* Constelacion de versiones (regla 7): trazabilidad del calculo, discreta al pie. Texto muted, no
          una barra: la franja de arriba es el marco; esto es solo la traza, para no enmarcar de mas. */}
      <p className="text-xs text-muted-foreground">
        Motor {versions.engine} · modelo {versions.model} · reglas {versions.rules}
      </p>
    </div>
  );
}
