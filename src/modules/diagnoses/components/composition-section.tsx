import { Fragment } from "react";

import {
  type AnthroClass,
  clasificarCintura,
  clasificarICT,
  clasificarIMC,
} from "../anthropometry";
import { clasificarAecMca } from "../data/composition-map";
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
  if (v == null) return "-";
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

type Classifications = Record<string, { label?: string } | null>;

// Diagnostico por fila de la tabla de Wang. Disponible HOY: (a) antropometricas por umbral OMS
// (imc/cintura) y (b) las clasificaciones del motor ya congeladas en el snapshot (FFMI/AF). El
// resto queda como PENDIENTE EXPLICITO: nunca un guion silencioso, que un profesional podria leer
// como "el modelo evaluo esto y salio normal" (falso). Ver docs/RESULTADOS_GAP.md Parte 4 y Q10.
function DiagnosisCell({
  rowKey,
  value,
  sexoM,
  classifications,
}: {
  rowKey: string;
  value: number | null;
  sexoM: boolean;
  classifications: Classifications;
}) {
  // (a) antropometricas OMS (referencia de display, rotulada como tal via tooltip).
  const oms = rowKey === "imc" ? clasificarIMC(value) : rowKey === "cintura" ? clasificarCintura(value, sexoM) : null;
  if (oms) {
    return (
      <span
        className={`rounded-md px-2 py-0.5 text-xs font-semibold ${SEV_CLS[Math.min(3, Math.max(0, oms.sev))]}`}
        title="Referencia médica estándar (OMS), no output del motor ANI-BIS-E."
      >
        {oms.label}
      </span>
    );
  }
  // (a2) AEC/MCA (C12): clasificador de DISPLAY de Gildardo (dAECMCA, ATLAS_v7:12734), no OMS ni
  // motor sellado. Rotulado como tal; Q20 (familia c vs d) sigue abierta.
  if (rowKey === "aec_mca") {
    const aec = clasificarAecMca(value);
    if (aec) {
      return (
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${SEV_CLS[Math.min(3, Math.max(0, aec.sev))]}`}
          title="Clasificación de display del prototipo de Gildardo (ANI-BIS-E), no umbral OMS ni output sellado del motor. Ver Q20."
        >
          {aec.label}
        </span>
      );
    }
  }
  // (b) clasificacion del motor congelada en el snapshot (FFMI, AF).
  const snap =
    rowKey === "FFMI" ? classifications.FFMI : rowKey === "AF" ? classifications.AF : null;
  if (snap?.label) {
    return <span className="text-xs text-foreground">{snap.label}</span>;
  }
  // (c) sin clasificacion del motor: guion neutro. La ausencia se comunica UNA vez a nivel de
  // seccion (nota bajo la tabla), no se repite por fila.
  return <span className="text-muted-foreground">-</span>;
}

// showDiagnosis gobierna si se muestra el VEREDICTO (clasificacion antropometrica OMS + columna
// Diagnostico). En Diagnostico es true (el veredicto es su materia). En Evaluacion es false: la
// etapa de entrada muestra "que entro" (Variable, Valor, Referencia, Δ), no el veredicto (ese es de
// Diagnostico). Un solo componente, sin duplicar. Cuando es false, sexoM/classifications no se usan.
export function CompositionSection({
  composition,
  sexoM = true,
  classifications = {},
  showDiagnosis = true,
}: {
  composition: Composition;
  sexoM?: boolean;
  classifications?: Classifications;
  showDiagnosis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      {showDiagnosis ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-semibold text-foreground">Clasificación antropométrica</h3>
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
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-foreground">
          Composición corporal - Niveles de Wang
        </h3>
        <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Variable</th>
                  <th className="py-2 pr-4 text-right font-medium">Valor</th>
                  <th className="py-2 pr-4 text-right font-medium">Referencia</th>
                  <th className="py-2 pr-4 text-right font-medium">Δ</th>
                  {showDiagnosis ? <th className="py-2 font-medium">Diagnóstico</th> : null}
                </tr>
              </thead>
              <tbody>
                {composition.levels.map((lvl) => (
                  <Fragment key={lvl.title}>
                    {/* Header de nivel: banda neutra ESTRUCTURAL (no color de riesgo; ver
                        BRAND.md, matiz de reserva del color de riesgo). */}
                    <tr className="border-y border-border bg-muted">
                      <td
                        colSpan={showDiagnosis ? 5 : 4}
                        className="py-2 text-xs font-semibold uppercase tracking-wider text-foreground"
                      >
                        {lvl.title}
                      </td>
                    </tr>
                    {lvl.rows.map((r) => {
                      const dec = r.decimals ?? 1;
                      const delta =
                        r.value != null && r.reference != null ? r.value - r.reference : null;
                      return (
                        <tr key={r.key} className="border-b border-border/40 transition-colors hover:bg-muted/30">
                          <td className="py-1.5 pr-4 text-foreground">
                            {r.label}
                            {r.unit ? (
                              <span className="text-muted-foreground"> ({r.unit})</span>
                            ) : null}
                          </td>
                          <td className="py-1.5 pr-4 text-right tabular-nums text-foreground">
                            {fmt(r.value, dec)}
                          </td>
                          <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">
                            {r.referenceLabel ?? fmt(r.reference, dec)}
                          </td>
                          <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">
                            {delta == null ? "-" : `${delta >= 0 ? "+" : ""}${fmt(delta, dec)}`}
                          </td>
                          {showDiagnosis ? (
                            <td className="py-1.5">
                              <DiagnosisCell
                                rowKey={r.key}
                                value={r.value}
                                sexoM={sexoM}
                                classifications={classifications}
                              />
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        {composition.hasDerivedValues ? (
          <p className="text-xs text-muted-foreground">
            Algunos valores de composición se reconstruyen a partir de la medición cuando el equipo no
            los exporta, siguiendo el modelo ANI-BIS-E. Por eso puedes ver variables que no aparecían
            en la pantalla del equipo.
          </p>
        ) : null}
        {showDiagnosis ? (
          <p className="text-xs text-muted-foreground">
            Varias variables de composición aún no tienen clasificación del motor (se muestran con un
            guion en Diagnóstico); disponibles próximamente.
          </p>
        ) : null}
      </section>
    </div>
  );
}
