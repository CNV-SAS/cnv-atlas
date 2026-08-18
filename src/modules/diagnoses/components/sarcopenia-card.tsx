import { AlertTriangle } from "lucide-react";

import { clasificarASMI, type DisplayDx, dAF } from "../data/composition-display";
import { SEV_CLS } from "./risk-severity";

// Diagnostico de Sarcopenia (port de la card de Gildardo en "Antrop. & BIS"). Criterio EWGSOP2: los tres
// pilares son FUERZA (primario), MASA (ASMI) y CALIDAD celular (AF). Los cortes son del motor (cASMI/cAF,
// sexo-dependientes; fuerza EWGSOP2 M<27 / F<16 Kgf). Presentacion: LEE del motor, no lo toca.
//
// FUERZA PRENSIL (dinamometria, criterio PRIMARIO del EWGSOP2): se captura en las condiciones de la toma BIS
// (campo gripStrengthKg, subpestaña Encuesta), la mide el profesional en consulta. Si no la registro, la card
// dice "Sin dato" y remite a capturarla, NO queda vacia ni se inventa. Su ausencia se hace visible.

function Metric({
  label,
  value,
  unit,
  cut,
  dx,
}: {
  label: string;
  value: string;
  unit?: string;
  cut: string;
  dx: DisplayDx;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold text-foreground">{value}</span>
        {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
      </div>
      <div className="flex items-center gap-2">
        {dx ? (
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${SEV_CLS[Math.min(3, Math.max(0, dx.sev))]}`}>
            {dx.label}
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">{cut}</span>
      </div>
    </div>
  );
}

export function SarcopeniaCard({
  asmi,
  af,
  sexoM,
  // Fuerza prensil (dinamometria): HOY no se captura -> null. Ver nota arriba.
  fuerzaPrensil = null,
}: {
  asmi: number | null;
  af: number | null;
  sexoM: boolean;
  fuerzaPrensil?: number | null;
}) {
  const fuerzaCut = sexoM ? 27 : 16; // EWGSOP2 Kgf
  const asmiCut = sexoM ? "7.0" : "5.5";
  const afCut = sexoM ? "6.5" : "6.0";
  const fuerzaDx: DisplayDx =
    fuerzaPrensil == null
      ? null
      : fuerzaPrensil < fuerzaCut
        ? { label: "Bajo", sev: 3 }
        : { label: "Normal", sev: 0 };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-semibold text-foreground">Diagnóstico de sarcopenia</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric
          label="Fuerza prensil"
          value={fuerzaPrensil != null ? fuerzaPrensil.toFixed(1) : "Sin dato"}
          unit={fuerzaPrensil != null ? "Kgf" : undefined}
          cut={`Bajo: <${fuerzaCut} Kgf`}
          dx={fuerzaDx}
        />
        <Metric
          label="ASMI"
          value={asmi != null ? asmi.toFixed(2) : "Sin dato"}
          unit={asmi != null ? "kg/m²" : undefined}
          cut={`Bajo: <${asmiCut}`}
          dx={clasificarASMI(asmi, sexoM)}
        />
        <Metric
          label="Ángulo de fase"
          value={af != null ? af.toFixed(1) : "Sin dato"}
          unit={af != null ? "°" : undefined}
          cut={`Bajo: <${afCut}°`}
          dx={dAF(af, sexoM)}
        />
      </div>
      {fuerzaPrensil == null ? (
        <div className="flex items-start gap-2 rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">Falta la dinamometría</span> (fuerza prensil), el criterio
            primario del EWGSOP2. Regístrala en las condiciones de la toma BIS (subpestaña Encuesta): la
            mide el profesional con dinamómetro, mano dominante, mejor de tres intentos.
          </span>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Criterio EWGSOP2: fuerza prensil (primario) + masa muscular (ASMI) + calidad celular (ángulo de
        fase). Los cortes se ajustan por sexo.
      </p>
    </section>
  );
}
