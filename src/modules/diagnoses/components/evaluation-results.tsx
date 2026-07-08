import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EngineIndicators } from "@/clinical-engine";

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
const SEV_CLS = [
  "bg-[#ECFDF5] text-[#065F46]",
  "bg-[#ECFDF5] text-[#065F46]",
  "bg-[#FFFBEB] text-[#92400E]",
  "bg-[#FEF2F2] text-[#991B1B]",
];
// Nivel de riesgo integrado del DFI -> indice de la capa clinica (color + etiqueta).
const RISK_SEV: Record<string, number> = { BAJO: 0, MEDIO: 1, ALTO: 2, "CRÍTICO": 3 };

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

export function EvaluationResults({ results }: { results: Results }) {
  const { snapshot, efrState } = results;
  const { indicators, classifications, efrPhenotype, structural, frSector, dfi, versions } =
    snapshot;

  return (
    <div className="flex flex-col gap-8">
      {/* Encabezado */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Resultados de la evaluacion
          </h1>
          {results.confirmed ? (
            <Badge className="bg-[#ECFDF5] text-[#065F46]">Diagnostico confirmado</Badge>
          ) : (
            <Badge variant="outline">Pendiente de confirmar</Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          {results.patientName} · {results.documentLabel} ·{" "}
          {new Date(results.evaluationDate).toLocaleDateString("es-CO")}
        </p>
      </header>

      {/* Diagnostico funcional (fenotipo EFR + estructural + sector FyR) */}
      <Card>
        <CardHeader>
          <CardTitle>Diagnostico funcional</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold text-foreground">
              {efrState?.diagnosisName ?? (efrPhenotype.diagnostico || "Sin diagnostico")}
            </p>
            <p className="text-xs text-muted-foreground">
              Estado EFR {efrPhenotype.stateNumber} de 81 · clave {efrPhenotype.key}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Line label="Fenotipo estructural" value={structural.nombre} />
            <Line label="Sector funcional (FyR)" value={frSector.nombre} />
          </div>
          <Line label="Mecanismo" value={efrState?.mechanism ?? null} />
          <Line label="Biomarcadores" value={efrState?.biomarkers ?? null} />
          <Line label="Riesgos" value={efrState?.risks ?? null} />
          <Line
            label="Nutraceuticos sugeridos"
            value={efrState?.suggestedNutraceuticals ?? efrPhenotype.nutraceuticos ?? null}
          />
        </CardContent>
      </Card>

      {/* Indicadores (12, con clasificacion) */}
      <Card>
        <CardHeader>
          <CardTitle>Indicadores ANI-BIS-E</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Indicador</th>
                  <th className="py-2 pr-4 font-medium">Valor</th>
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
                    <td className="py-2 pr-4 tabular-nums text-foreground">
                      {fmtNum(indicators[key])}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {classifications[code]?.label ?? "N/D"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Diagnostico Funcional Integral (DFI): 5 dominios + riesgo + rutas */}
      <Card>
        <CardHeader>
          <CardTitle>Diagnostico Funcional Integral (DFI)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!dfi.complete ? (
            <p className="rounded-md border border-[#F59E0B]/40 bg-[#FFFBEB] px-3 py-2 text-sm text-[#92400E]">
              {dfi.degradedReason ?? "El DFI corrio incompleto."}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Riesgo integrado:</span>
            <Badge className={SEV_CLS[RISK_SEV[dfi.riesgo.nivel] ?? 1]}>
              {dfi.riesgo.nivel} · {dfi.riesgo.score}
            </Badge>
            <span className="text-sm text-muted-foreground">{dfi.riesgo.descripcion}</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {dfi.domains.map((d) => (
              <div key={d.id} className="flex flex-col gap-1 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{d.nombre}</span>
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
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">Rutas de atencion</span>
            <div className="flex flex-wrap gap-2">
              {dfi.rutas.map((r) => (
                <Badge key={r} variant="outline">
                  {r}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Constelacion de versiones (regla 7): trazabilidad del calculo */}
      <p className="text-xs text-muted-foreground">
        Motor {versions.engine} · modelo {versions.model} · reglas {versions.rules}
      </p>
    </div>
  );
}
