"use client";

import { useState } from "react";

import type { DfiDomain } from "@/clinical-engine";

import { Diana } from "./diana";
import { DfiRadar } from "./dfi-radar";
import type { EfrStateRef } from "../data/efr-states-reader";

// Seccion de mapas (Diana + radar) con la exploracion de estados (V2). El estado del paciente es
// SIEMPRE el del snapshot inmutable; la exploracion es una capa de solo lectura, rotulada como
// referencia, que lee el contenido de OTRAS celdas del registry (efr_states). Explorar nunca cambia
// el diagnostico del paciente. Client por la interactividad (toggle + celda seleccionada).

type PatientContent = {
  diagnosisName: string | null;
  mechanism: string | null;
  biomarkers: string | null;
  risks: string | null;
  suggestedNutraceuticals: string | null;
};

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="text-sm text-foreground">
      <span className="font-medium text-muted-foreground">{label}: </span>
      {value}
    </p>
  );
}

export function MapsSection({
  bands,
  stateNumber,
  frSectorName,
  structuralName,
  patientContent,
  statesContent,
  radarDomains,
  radarRiskSev,
}: {
  bands: { ifc: number; irc: number; ffmi: number; fmi: number };
  stateNumber: number;
  frSectorName: string;
  structuralName: string;
  patientContent: PatientContent;
  statesContent: Record<number, EfrStateRef>;
  radarDomains: DfiDomain[];
  radarRiskSev: number;
}) {
  const canExplore = Object.keys(statesContent).length > 0;
  const [exploring, setExploring] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const isPatientCell = selected === stateNumber;
  // La celda del paciente SIEMPRE del snapshot (patientContent), nunca del registry; las demas,
  // del registry (referencia).
  const detail =
    selected == null
      ? null
      : isPatientCell
        ? { ...patientContent, stateNumber }
        : (statesContent[selected] ?? null);

  function toggle() {
    if (exploring) {
      setExploring(false);
      setSelected(null);
    } else {
      setExploring(true);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-8 xl:flex-row xl:items-start xl:justify-around">
        <div className="flex flex-col items-center gap-3">
          <div className="flex w-full items-center justify-between gap-3">
            {/* Encabezado fiel al HTML ("Diana EFR BIS — 81 Estados"); "·" en vez de em-dash. */}
            <h3 className="text-sm font-semibold text-foreground">Diana EFR BIS · 81 estados</h3>
            {canExplore ? (
              <button
                type="button"
                onClick={toggle}
                className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
              >
                {exploring ? "Volver al estado del paciente" : "Explorar otros estados"}
              </button>
            ) : null}
          </div>
          <Diana
            bands={bands}
            stateNumber={stateNumber}
            frSectorName={frSectorName}
            structuralName={structuralName}
            interactive={exploring}
            selectedStateNumber={exploring ? selected : null}
            onSelectCell={setSelected}
          />
        </div>
        <div className="flex flex-col items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">Radar funcional · 5 dominios</h3>
          <DfiRadar domains={radarDomains} riskSev={radarRiskSev} />
        </div>
      </div>

      {exploring ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <p className="text-sm text-muted-foreground">
            Explorando la Diana. Ver otras celdas no cambia el diagnóstico del paciente: es solo
            referencia del modelo. Vuelve al estado del paciente para salir de la exploración.
          </p>
          {detail ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                  Estado {detail.stateNumber} de 81
                </span>
                <span className="text-xs text-muted-foreground">
                  {isPatientCell
                    ? "Estado del paciente (diagnóstico)"
                    : "Referencia, no es el diagnóstico del paciente"}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {detail.diagnosisName ?? "Sin dato para este estado."}
              </p>
              <Field label="Mecanismos bioquímicos / Disfunción celular" value={detail.mechanism} />
              <Field label="Biomarcadores clave" value={detail.biomarkers} />
              <Field label="Riesgos clínicos" value={detail.risks} />
              <Field label="Nutracéuticos sugeridos" value={detail.suggestedNutraceuticals} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Haz clic en una celda de la Diana para ver su estado de referencia.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
