import { Fragment } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  type AnthroClass,
  clasificarCintura,
  clasificarICT,
  clasificarIMC,
} from "../anthropometry";
import type { Composition } from "../data/composition-reader";

// Composicion corporal (Niveles de Wang) + clasificacion antropometrica de referencia. Todo desde
// bis_raw_values (inmutable por medicion), no del registry vivo. La clasificacion antropometrica
// es REFERENCIA MEDICA ESTANDAR (OMS), NO output del motor ANI-BIS-E: se rotula como tal.

// Capa de color clinica de BRAND por severidad (color SOLO para riesgo, nunca decorativo).
const SEV_CLS = [
  "bg-clinical-optimal-bg text-clinical-optimal",
  "bg-clinical-optimal-bg text-clinical-optimal",
  "bg-clinical-warning-bg text-clinical-warning",
  "bg-clinical-critical-bg text-clinical-critical",
];

function fmt(v: number | null, dec = 1): string {
  if (v == null) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(dec);
}

function AnthroChip({ label, cls }: { label: string; cls: AnthroClass | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      {cls ? (
        <span
          className={`w-fit rounded-md px-2 py-0.5 text-sm font-semibold ${SEV_CLS[Math.min(3, Math.max(0, cls.sev))]}`}
        >
          {cls.label}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">Sin dato</span>
      )}
    </div>
  );
}

export function CompositionSection({
  composition,
  sexoM,
}: {
  composition: Composition;
  sexoM: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Clasificación antropométrica</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <AnthroChip label={`IMC ${fmt(composition.imc)}`} cls={clasificarIMC(composition.imc)} />
            <AnthroChip
              label={`Cintura ${fmt(composition.cintura, 0)} cm`}
              cls={clasificarCintura(composition.cintura, sexoM)}
            />
            <AnthroChip
              label={`Índice cintura-talla ${fmt(composition.ict, 2)}`}
              cls={clasificarICT(composition.ict)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Umbrales de referencia médica estándar (OMS): IMC, circunferencia de cintura e índice
            cintura-talla. Son referencia clínica general, no un resultado del motor ANI-BIS-E.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Composición corporal — Niveles de Wang</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Variable</th>
                  <th className="py-2 pr-4 text-right font-medium">Valor</th>
                  <th className="py-2 pr-4 text-right font-medium">Referencia</th>
                  <th className="py-2 text-right font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                {composition.levels.map((lvl) => (
                  <Fragment key={lvl.title}>
                    <tr className="border-b border-border/60 bg-muted/40">
                      <td
                        colSpan={4}
                        className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {lvl.title}
                      </td>
                    </tr>
                    {lvl.rows.map((r) => {
                      const delta =
                        r.value != null && r.reference != null ? r.value - r.reference : null;
                      return (
                        <tr key={r.key} className="border-b border-border/40">
                          <td className="py-1.5 pr-4 text-foreground">
                            {r.label}
                            {r.unit ? (
                              <span className="text-muted-foreground"> ({r.unit})</span>
                            ) : null}
                          </td>
                          <td className="py-1.5 pr-4 text-right tabular-nums text-foreground">
                            {fmt(r.value)}
                          </td>
                          <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">
                            {fmt(r.reference)}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                            {delta == null ? "—" : `${delta >= 0 ? "+" : ""}${fmt(delta)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
