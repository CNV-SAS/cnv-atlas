import { type ReactNode } from "react";
import { Ban, Brain, Dna, HeartPulse, Hourglass, type LucideIcon, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type EngineIndicators, indicatorSeverities, isBisDerivedDomain } from "@/clinical-engine";

import { DetailsSection } from "./details-section";
import { RadarPanel, DianaExplorer } from "./maps-section";
import type { EvaluationResults as Results } from "../data/results-reader";
import type { EfrStateRef } from "../data/efr-states-reader";
import { isProvisionalCalibration } from "@/modules/clinical-pipeline/emission-versions";

import { clasificarIcaBis, indicatorBands, indicatorRange } from "../data/indicator-ranges";
import { SEV_LABEL } from "../severity-labels";
import { OPTIMO_DOT, RISK_SEV, SEV_CLS } from "./risk-severity";
import { VerdictStrip } from "./verdict-strip";
import { AvisoCienciaAnterior } from "@/modules/clinical-pipeline/components/aviso-ciencia-anterior";
import { DiagnosisSubtabs } from "./diagnosis-subtabs";
import { fmtDec } from "@/lib/format/decimal";

// Vista INTERNA del profesional: resultados clinicos de una evaluacion (B12). Presentacion
// pura desde el snapshot inmutable + contenido EFR. Sin PII al exterior; el profesional
// autorizado (RLS) ve el nombre del paciente. Lenguaje funcional (BRAND / DATA_GOVERNANCE).

// FMI y FFMI NO van aca: son composicion, viven en la tabla de Wang (Nivel IV), como en el HTML de
// Gildardo. El reporte al paciente y el seguimiento tienen sus propias listas (no se afectan). Restructure
// Santiago 2026-08-15.
const INDICATORS: { code: string; key: keyof EngineIndicators }[] = [
  { code: "IFC", key: "ifc" },
  { code: "IRC", key: "irc" },
  { code: "PABU", key: "pabu" },
  { code: "ICA-BIS", key: "icaBis" },
  { code: "ISCM", key: "iscm" },
  { code: "IEHH", key: "iehh" },
  { code: "IAE", key: "iae" },
  { code: "EB", key: "eb" },
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
  // Coma decimal (lib/format/decimal): las tarjetas del DFI de esta misma pantalla traen las cadenas
  // del motor, que ya vienen en español ("IFC 6,98"). Con toFixed crudo el mismo renglon mezclaba
  // 6,98 y 6.68. Solo cambia el separador; los decimales quedan igual.
  if (code === "AF") return fmtDec(v, 1);
  return fmtDec(v, 2);
}

// Cortes inline de un item de dominio del DFI (hibrido aprobado): detecta el codigo del indicador al inicio
// del texto ("IFC 6.98 (...)", "ISCM-BIS ...", "ICEC/LE8 ...") y devuelve sus bandas del motor. null si el
// item no arranca con un indicador con bandas (texto libre como "Antecedentes familiares: N").
function itemBands(item: string, sexM: boolean): string | null {
  const head = item.trim().split(/[\s/]/)[0].replace(/-BIS$/i, "").toUpperCase();
  return indicatorBands(head, sexM);
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
// EL PROP `pending` SE RETIRO (barrido de textos stale, 2026-09-01): pintaba "Disponible próximamente" y
// NINGUNO de los cinco sitios de llamada lo pasaba, asi que ese texto era inalcanzable. Una promesa que
// nadie puede leer no es inofensiva: es la que alguien cablea dentro de seis meses sin mirar que promete,
// y entonces envejece como envejecieron las otras tres de este barrido.
function ContentCard({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {value ? (
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
          <h2 className="text-seccion font-semibold tracking-tight text-foreground">
            Resultados de la evaluación
          </h2>
        {/* LA LINEA DE IDENTIDAD SE RETIRO (2026-09-03). Decia "nombre · documento · fecha", y la banda
            de /evaluaciones/[id] -bajo la que se monta esta vista- ya dice los tres. Verificado dato por
            dato antes de quitarla, que era la condicion: el nombre es el TITULO de la banda, el documento
            es uno de sus datos de cabecera, y la fecha resuelve igual en los dos (la de MEDICION, con
            caida a `created_at`), asi que en esta pantalla no puede diferir. */}
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
  // Dominios que el motor NO puntuó (CA-6). Del snapshot SELLADO, no recalculado: lo que se emitió es
  // lo que se muestra. Ausente en snapshots anteriores a CA-6, donde todos los dominios puntuaban:
  // por eso el `?? []` y no una guarda de "incompatible".
  const dominiosSinDato = dfi.dfiSinDato ?? [];
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

  // Tabla de indices ANI-BIS-E. SE MUEVE a la subpestaña COMPOSICION (Gildardo la tiene ahi, con la tabla
  // de Wang, no en su capa funcional; en Funcional quedan los indices representativos INLINE por dominio,
  // en las tarjetas del DFI). Se define como const y se referencia en el slot composicion.
  const indicatorsSection = (
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
                // ICA-BIS: su clasificacion es la DESVIACION (rama del clasificador del PABU, verbatim del
                // frozen), que el motor no sella para ICA-BIS (queda N/D) porque cPABU corta a "Reserva
                // superior" con IFC>6. clasificarIcaBis reusa esa rama de desviacion ("Desviación leve").
                const isIca = code === "ICA-BIS";
                const icaCls = isIca ? clasificarIcaBis(indicators.icaBis) : null;
                const classCode = isEb ? "IAE" : code;
                const sev = isIca ? (icaCls?.sev ?? null) : sevByCode[classCode];
                const classLabel = isIca
                  ? (icaCls?.label ?? "N/D")
                  : (classifications[classCode]?.label ?? "N/D");
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
          referencia. El FFMI y el FMI aparecen arriba, en la tabla de Wang (Nivel IV), con la
          referencia del equipo Biody; por eso su referencia puede diferir, no es una contradicción.
        </p>
        {ebIaeProvisional ? (
          <p className="max-w-prose text-xs text-clinical-warning">
            EB e IAE se calculan con una <span className="font-semibold">calibración provisional</span>{" "}
            (aún sin población de referencia). Son para tu lectura clínica; no son comunicables al
            paciente y no aparecen en su reporte.
          </p>
        ) : null}
      </div>
    </DetailsSection>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-seccion font-semibold tracking-tight text-foreground">
            Resultados de la evaluación
          </h2>
          {results.confirmed ? (
            <Badge className="bg-clinical-optimal-bg text-clinical-optimal">
              Diagnóstico confirmado
            </Badge>
          ) : (
            <Badge variant="outline">Pendiente de confirmar</Badge>
          )}
        </div>

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

      {/* Procedencia del documento: se emitió con una versión anterior del modelo. Va DEBAJO del
          veredicto y ARRIBA de las subpestañas, para que se vea sin tener que abrir ninguna, pero
          nunca por encima de la conclusión: es una nota de procedencia, no un hallazgo clínico.
          NO invalida el diagnóstico (ver el componente). */}
      <AvisoCienciaAnterior vigencia={results.vigencia} veredicto={results.veredictoReemision} />

      {/* Tres subpestañas (QUE de Gildardo, COMO nuestro). Default Funcional (DIV-7). */}
      <DiagnosisSubtabs
        funcional={
          <div className="flex flex-col gap-8">
            {/* Orden conclusion -> detalle (V3): el DFI (riesgo integrado + 5 dominios) va arriba,
                luego los mapas (Diana + radar), pegado el detalle de las 6 cards del estado, y la tabla
                completa de indices. Las rutas (salida del DFI) viven en la etapa de Tratamiento. */}
            <Card>
        <CardHeader>
          <CardTitle>Diagnóstico Funcional Integrado (DFI)</CardTitle>
          <p className="text-sm text-muted-foreground">5 dominios · síntesis ANI BIS-E</p>
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
                <>
                  <Badge className={SEV_CLS[RISK_SEV[dfi.riesgo.nivel] ?? 1]}>
                    {dfi.riesgo.nivel} · {dfi.riesgo.score}
                  </Badge>
                  <span className="text-xs text-muted-foreground">índice 0-100</span>
                </>
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
            {/* SOBRE CUÁNTOS DOMINIOS SE CALCULÓ. Cuando alguno no se midió, el riesgo se renormaliza
                sobre los demás, y eso cambia lo que significa la cifra: 60 sobre cuatro dominios no es
                60 sobre cinco. Callarlo sería cambiar un número clínico en silencio. */}
            {dominiosSinDato.length ? (
              <p className="text-sm text-attention">
                Calculado sobre {dfi.domains.length - dominiosSinDato.length} de los{" "}
                {dfi.domains.length} dominios:{" "}
                {/* El nombre sale del propio snapshot, no de una tabla nuestra: dos fuentes del mismo
                    rótulo es como empezó el defecto del orden de la matriz. */}
                {dominiosSinDato
                  .map((id) => dfi.domains.find((d) => d.id === id)?.nombre ?? id)
                  .join(" y ")}{" "}
                {dominiosSinDato.length === 1 ? "no se midió" : "no se midieron"}, así que{" "}
                {dominiosSinDato.length === 1 ? "no puntúa" : "no puntúan"} en vez de puntuar bajo.
              </p>
            ) : null}
          </div>

          {/* Banner del veto conductual: cadena EXACTA del frozen (ATLAS_v8.html _DFIView). Sin el aviso, el
              badge "Veto activo" no orienta: el profesional no ve la instruccion (prioridad psicologica,
              excluir intervencion nutricional restrictiva). RESUELTO (Gildardo 2026-08-15 §1): el veto es
              AVISO, NO barrera dura ("el sistema no bloquea; no construyan la barrera dura"). Hoy no se
              consume en tratamiento, solo aparece la ruta conductual como prioritaria, que es lo correcto. */}
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
                  {/* Tres estados, no dos. "No evaluable" es la encuesta incompleta; "Sin dato" es el
                      dominio que el motor NO puntuó (CA-6). Un clamp sobre null daría 0, que es ÓPTIMO:
                      exactamente la lectura favorable de un vacío que su punto 4 prohíbe. */}
                  {noEvaluable ? (
                    <Badge className="bg-muted text-muted-foreground">No evaluable</Badge>
                  ) : d.sev == null ? (
                    <Badge className="bg-muted text-muted-foreground">Sin dato</Badge>
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
                        {d.items.map((it, i) => {
                          const bands = itemBands(it, sexM);
                          return (
                            <li key={i}>
                              {it}
                              {bands ? (
                                // Cortes del motor, en linea pequeña bajo el valor (forma compacta que
                                // conserva la info; el profesional ve contra que se compara sin ir a la tabla).
                                <span className="ml-5 block text-[10px] leading-tight text-muted-foreground/80">
                                  corte: {bands}
                                </span>
                              ) : null}
                            </li>
                          );
                        })}
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

      {/* Reorg 2026-08-19 (Gildardo, replica del HTML): el RADAR primero, en su propio contenedor. Se
          quito la card unica "Mapas del estado"; la Diana baja y se une al detalle del estado EFR. */}
      <Card>
        <CardHeader>
          <CardTitle>Radar funcional · 5 dominios</CardTitle>
        </CardHeader>
        <CardContent>
          <RadarPanel radarDomains={dfi.domains} dfiComplete={dfi.complete} />
        </CardContent>
      </Card>

      {/* Diana EFR BIS + detalle del estado, en UN mismo contenedor (replica del HTML): la Diana encabeza,
          y debajo la identidad del estado + las 6 tarjetas de contenido, ancladas al estado del paciente (5
          del snapshot inmutable + abordaje pendiente de Q9). En movil, la Diana y sus paneles de exploracion
          quedan juntos porque el radar ya quedo arriba. */}
      <Card>
        <CardHeader>
          <CardTitle>Diana EFR BIS y detalle del estado</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <DianaExplorer
            bands={efrPhenotype.bands}
            stateNumber={efrPhenotype.stateNumber}
            frSectorName={frSector.nombre}
            structuralName={structural.nombre}
            patientContent={patientContent}
            statesContent={efrStates}
          />
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
          {/* Los 4 indicadores que DEFINEN el estado, con su clasificacion y semaforo (MISMA fuente unica que
              la tabla de indices: sevByCode + OPTIMO_DOT). Orden: primero lo FUNCIONAL (IFC, IRC), despues lo
              ESTRUCTURAL (FFMI, FMI), la logica de la Diana. Deja ver POR QUE el paciente cae en este estado,
              en vez de solo describirlo en prosa (port de la card de Gildardo). */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([["IFC", "ifc"], ["IRC", "irc"], ["FFMI", "FFMI"], ["FMI", "FMI"]] as const).map(
              ([code, key]) => {
                const sev = sevByCode[code];
                const label = classifications[code]?.label;
                return (
                  <div key={code} className="rounded-lg border border-border p-2">
                    <div className="flex items-center gap-1.5">
                      {sev != null ? (
                        <span
                          className={`size-2 shrink-0 rounded-full ${OPTIMO_DOT[sev as number]}`}
                          aria-hidden
                        />
                      ) : null}
                      <span className="text-xs font-semibold text-foreground">{code}</span>
                      <span className="ml-auto text-xs tabular-nums text-foreground">
                        {fmtNum(indicators[key as keyof EngineIndicators], code)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                      {label ?? "N/D"}
                    </p>
                  </div>
                );
              },
            )}
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


            {/* Criterio del profesional (+ IA) y el par confirmar/corregir: la lectura y el cierre, en
                Funcional, sin ir y volver a otra pestaña. */}
            {criterio}
            {confirmCorrect}
          </div>
        }
        composicion={
          <div className="flex flex-col gap-8">
            {composition ?? (
              <p className="w-fit rounded-md border border-dashed border-border px-3 py-1 text-sm italic text-muted-foreground">
                Esta evaluación no tiene composición corporal registrada.
              </p>
            )}
            {/* La tabla de indices ANI-BIS-E vive aca (Gildardo la tiene en composicion, con Wang); en
                Funcional quedan los indices representativos inline por dominio (tarjetas del DFI). */}
            {indicatorsSection}
          </div>
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
