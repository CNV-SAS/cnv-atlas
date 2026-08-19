import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { formatDate } from "@/lib/format/date";

import type { FollowupComparison as Comparison } from "../data/comparison-reader";

// Comparacion de seguimiento (B13): evaluacion actual frente a la previa. Presentacion pura
// desde el comparador (deltas ya calculados). Vista interna del profesional, lenguaje
// funcional. El delta se muestra sin juzgar direccion clinica (subir o bajar depende del
// indicador); solo informa el cambio numerico y el cambio de estado EFR y de riesgo.

function fmt(v: number | null, code?: string): string {
  if (v == null) return "N/D";
  // D-016: el angulo de fase siempre con 1 decimal (los demas indicadores conservan su formato).
  if (code === "AF") return v.toFixed(1);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function fmtDelta(v: number | null, code?: string): string {
  if (v == null) return "N/D";
  if (v === 0) return "0";
  return v > 0 ? `+${fmt(v, code)}` : fmt(v, code);
}

function fecha(iso: string): string {
  return formatDate(iso);
}

export function FollowupComparison({ comparison }: { comparison: Comparison }) {
  const c = comparison;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparación con la evaluación previa</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          Evaluacion previa del {fecha(c.previousDate)}, evaluacion actual del {fecha(c.currentDate)}.
        </p>

        {/* Aviso de cruce de version del motor (BACKLOG L69). Calmado a proposito: la mayoria de los
            seguimientos que se hagan ahora cruzan versiones (la previa quedo sellada con la anterior), asi
            que un aviso estridente seria ruido. Dice lo justo: parte del cambio puede venir del modelo. */}
        {c.engineVersionCross ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Estas dos evaluaciones se calcularon con versiones distintas del motor (
            {c.engineVersionCross.previous} y {c.engineVersionCross.current}). Parte de las diferencias
            que ves puede venir de una actualización del modelo, no de un cambio en el paciente. El estado
            EFR y los indicadores siguen siendo comparables; toma el detalle fino con esa salvedad.
          </p>
        ) : null}

        {/* Cambios de estado y riesgo */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
            <span className="text-xs font-medium text-muted-foreground">Estado EFR</span>
            <span className="text-sm text-foreground">
              {c.previousEfrState} · {c.currentEfrState}
              {c.currentEfrState !== c.previousEfrState ? (
                <Badge variant="outline" className="ml-2">
                  cambio
                </Badge>
              ) : null}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
            <span className="text-xs font-medium text-muted-foreground">Riesgo integrado (DFI)</span>
            <span className="text-sm text-foreground">
              {c.previousRisk.nivel} ({c.previousRisk.score}) · {c.currentRisk.nivel} (
              {c.currentRisk.score})
            </span>
          </div>
        </div>

        {/* Deltas por indicador */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Indicador</th>
                <th className="py-2 pr-4 font-medium">Previo</th>
                <th className="py-2 pr-4 font-medium">Actual</th>
                <th className="py-2 font-medium">Cambio</th>
              </tr>
            </thead>
            <tbody>
              {c.indicators.map((it) => (
                <tr key={it.code} className="border-b border-border/60">
                  <td className="py-2 pr-4 font-medium text-foreground">{it.code}</td>
                  <td className="py-2 pr-4 tabular-nums text-muted-foreground">{fmt(it.previous, it.code)}</td>
                  <td className="py-2 pr-4 tabular-nums text-foreground">{fmt(it.current, it.code)}</td>
                  <td className="py-2 tabular-nums text-muted-foreground">{fmtDelta(it.delta, it.code)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
