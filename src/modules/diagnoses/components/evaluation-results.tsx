import { type ReactNode } from "react";
import { Brain, Dna, HeartPulse, Hourglass, type LucideIcon, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type EngineIndicators, indicatorSeverities } from "@/clinical-engine";

import { DetailsSection } from "./details-section";
import { DfiRadar } from "./dfi-radar";
import { Diana } from "./diana";
import type { EvaluationResults as Results } from "../data/results-reader";

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

// Severidad de dominio DFI (0-3) -> etiqueta + color de la capa clinica (no solo color:
// tambien la etiqueta, por accesibilidad; BRAND).
const SEV_LABEL = ["Optimo", "Leve", "Moderado", "Alto"];
// Capa clinica de color (tokens de BRAND, theme-aware): sev 0-1 optimo, 2 alerta, 3 critico.
const SEV_CLS = [
  "bg-clinical-optimal-bg text-clinical-optimal",
  "bg-clinical-optimal-bg text-clinical-optimal",
  "bg-clinical-warning-bg text-clinical-warning",
  "bg-clinical-critical-bg text-clinical-critical",
];
// Nivel de riesgo integrado del DFI -> indice de la capa clinica (color + etiqueta).
const RISK_SEV: Record<string, number> = { BAJO: 0, MEDIO: 1, ALTO: 2, "CRÍTICO": 3 };
// Punto de color por severidad (0-3), paleta clinica de BRAND. Color SOLO en el veredicto de
// riesgo, nunca decorativo; el label sigue siendo el señalizador principal (no depende del color).
const DOT_CLS = [
  "bg-clinical-optimal",
  "bg-clinical-optimal",
  "bg-clinical-warning",
  "bg-clinical-critical",
];
// Icono lucide por dominio del DFI (ayuda de lectura, NO emoji). Color neutro: el icono
// identifica el dominio, no señala riesgo (eso lo hace el badge de severidad).
const DOMAIN_ICON: Record<string, LucideIcon> = {
  d1: Zap, // Celular-Electrico
  d2: HeartPulse, // Metabolico-Estructural
  d3: Hourglass, // Envejecimiento
  d4: Brain, // Conductual-Perceptual
  d5: Dna, // Epigenetico-Contextual
};

function fmtNum(v: number | null): string {
  if (v == null) return "N/D";
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
        <span className="text-sm italic text-muted-foreground">Disponible proximamente.</span>
      ) : value ? (
        <p className="text-sm text-foreground">{value}</p>
      ) : (
        <span className="text-sm text-muted-foreground">Sin dato para este estado.</span>
      )}
    </div>
  );
}

export function EvaluationResults({
  results,
  composition,
}: {
  results: Results;
  composition?: ReactNode;
}) {
  // Snapshot de una era anterior del motor (stub-0.1.0 pre-B11): forma incompatible con
  // esta vista. Se informa en vez de tronar (reports es inmutable, no se puede migrar).
  if (!results.compatible) {
    return (
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Resultados de la evaluacion
          </h1>
          <p className="text-muted-foreground">
            {results.patientName} · {results.documentLabel} ·{" "}
            {new Date(results.evaluationDate).toLocaleDateString("es-CO")}
          </p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Diagnostico no disponible con este formato</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-foreground">
              El diagnostico de esta evaluacion se genero con una version anterior del motor
              {results.engineVersion ? ` (${results.engineVersion})` : ""} y no puede mostrarse en
              este formato.
            </p>
            <p className="text-sm text-muted-foreground">
              Los datos siguen almacenados de forma inmutable. Para ver un diagnostico con el
              formato actual, realiza una nueva evaluacion del paciente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { snapshot, efrState } = results;
  const { indicators, classifications, efrPhenotype, structural, frSector, dfi, versions } =
    snapshot;
  // Severidad por indicador (recomputada del snapshot) para el punto de color de la clasificacion.
  const sevByCode = indicatorSeverities(snapshot);

  return (
    <div className="flex flex-col gap-8">
      {/* Encabezado */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Resultados de la evaluacion
          </h1>
          {results.confirmed ? (
            <Badge className="bg-clinical-optimal-bg text-clinical-optimal">
              Diagnostico confirmado
            </Badge>
          ) : (
            <Badge variant="outline">Pendiente de confirmar</Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          {results.patientName} · {results.documentLabel} ·{" "}
          {new Date(results.evaluationDate).toLocaleDateString("es-CO")}
        </p>
      </header>

      {/* Diagnostico funcional: identidad del estado + las 6 tarjetas de contenido de la Diana
          (5 del snapshot inmutable + abordaje por profesion pendiente de Q9). */}
      <Card>
        <CardHeader>
          <CardTitle>Diagnostico funcional</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Line
              label="Estado EFR"
              value={`${efrPhenotype.stateNumber} de 81 · clave ${efrPhenotype.key}`}
            />
            <Line label="Fenotipo estructural" value={structural.nombre} />
            <Line label="Sector funcional (FyR)" value={frSector.nombre} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ContentCard
              label="Enfermedades / complicaciones probables"
              value={efrState?.diagnosisName ?? efrPhenotype.diagnostico ?? null}
            />
            <ContentCard label="Mecanismos" value={efrState?.mechanism ?? null} />
            <ContentCard label="Biomarcadores" value={efrState?.biomarkers ?? null} />
            <ContentCard label="Riesgos" value={efrState?.risks ?? null} />
            <ContentCard
              label="Nutraceuticos sugeridos"
              value={efrState?.suggestedNutraceuticals ?? efrPhenotype.nutraceuticos ?? null}
            />
            <ContentCard label="Abordaje por profesion" value={null} pending />
          </div>
        </CardContent>
      </Card>

      {/* Mapas del estado: la Diana (posicion entre los 81 estados) y el radar DFI (severidad por
          dominio), juntos como lectura de un vistazo. */}
      <Card>
        <CardHeader>
          <CardTitle>Mapas del estado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-8 xl:flex-row xl:items-start xl:justify-around">
            <Diana
              bands={efrPhenotype.bands}
              stateNumber={efrPhenotype.stateNumber}
              frSectorName={frSector.nombre}
              structuralName={structural.nombre}
            />
            <DfiRadar domains={dfi.domains} riskSev={RISK_SEV[dfi.riesgo.nivel] ?? 1} />
          </div>
        </CardContent>
      </Card>

      {/* DFI: riesgo integrado + los 5 dominios (desglose interpretativo). El radar vive arriba,
          en Mapas; las rutas (salida del DFI) viven en la etapa de Tratamiento. */}
      <Card>
        <CardHeader>
          <CardTitle>Diagnostico Funcional Integral (DFI)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!dfi.complete ? (
            <p className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
              {dfi.degradedReason ?? "El DFI corrio incompleto."}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Riesgo integrado:</span>
              <Badge className={SEV_CLS[RISK_SEV[dfi.riesgo.nivel] ?? 1]}>
                {dfi.riesgo.nivel} · {dfi.riesgo.score}
              </Badge>
              {dfi.veto ? <Badge className={SEV_CLS[3]}>Veto activo</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">{dfi.riesgo.descripcion}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {dfi.domains.map((d) => {
              const Icon = DOMAIN_ICON[d.id];
              return (
              <div key={d.id} className="flex flex-col gap-1 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
                    {d.nombre}
                  </span>
                  <Badge className={SEV_CLS[Math.min(3, Math.max(0, d.sev))]}>
                    {SEV_LABEL[Math.min(3, Math.max(0, d.sev))]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{d.clasif}</p>
                <p className="text-sm text-foreground">{d.lectura}</p>
                {d.items.length ? (
                  <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                    {d.items.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              );
            })}
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
                  <th className="py-2 font-medium">Clasificacion</th>
                </tr>
              </thead>
              <tbody>
                {INDICATORS.map(({ code, key }) => (
                  <tr key={code} className="border-b border-border/60">
                    <td className="py-2 pr-4">
                      <span className="font-medium text-foreground">{code}</span>
                      {results.indicatorNames[code] ? (
                        <span className="text-muted-foreground"> · {results.indicatorNames[code]}</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-foreground">
                      {fmtNum(indicators[key])}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">-</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">-</td>
                    <td className="py-2 text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        {sevByCode[code] != null ? (
                          <span
                            className={`size-2 shrink-0 rounded-full ${DOT_CLS[sevByCode[code] as number]}`}
                            aria-hidden
                          />
                        ) : null}
                        <span>{classifications[code]?.label ?? "N/D"}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Referencia y Δ se muestran vacias con aviso a nivel de seccion (no por fila): los
              rangos son cortes internos del motor congelado, aun no expuestos como dato
              (ver docs/FROZEN_EXPORTS_REQUEST.md). Se pueblan cuando Gildardo los entregue. */}
          <p className="text-xs text-muted-foreground">
            Rango de referencia y desviacion (Δ) por indicador: disponibles proximamente.
          </p>
        </div>
      </DetailsSection>

      {composition ? (
        <DetailsSection title="Composicion corporal y clasificacion antropometrica">
          {composition}
        </DetailsSection>
      ) : null}

      {/* Constelacion de versiones (regla 7): trazabilidad del calculo, discreta al pie. */}
      <p className="text-xs text-muted-foreground">
        Motor {versions.engine} · modelo {versions.model} · reglas {versions.rules}
      </p>
    </div>
  );
}
