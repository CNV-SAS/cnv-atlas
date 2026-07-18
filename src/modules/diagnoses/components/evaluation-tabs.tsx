"use client";

import { useState, type ReactNode } from "react";

// Shell de pestañas de una evaluacion (/evaluaciones/[id]). Adopta las 4 etapas reales de la ruta
// ANI-BIS-E como tabs internas (familiaridad de formacion); el sidebar sigue navegando entre
// entidades. Encuesta y Antrop & BIS no son etapas propias: son las dos entradas de datos de la
// evaluacion, viven como secciones dentro de Evaluacion. El contenido de cada etapa se computa en
// el servidor y llega como prop (ReactNode), asi el cambio de tab es client-side sin refetch ni
// perder la RLS del server. En este bloque solo se pule Diagnostico; las demas quedan reubicadas.

type TabId = "evaluacion" | "diagnostico" | "tratamiento" | "seguimiento";

const TABS: { id: TabId; label: string }[] = [
  { id: "evaluacion", label: "Evaluacion" },
  { id: "diagnostico", label: "Diagnostico" },
  { id: "tratamiento", label: "Tratamiento" },
  { id: "seguimiento", label: "Seguimiento" },
];

export function EvaluationTabs({
  evaluacion,
  diagnostico,
  tratamiento,
  seguimiento,
}: {
  evaluacion: ReactNode;
  diagnostico: ReactNode;
  tratamiento: ReactNode;
  seguimiento: ReactNode;
}) {
  const [active, setActive] = useState<TabId>("diagnostico");
  const content: Record<TabId, ReactNode> = { evaluacion, diagnostico, tratamiento, seguimiento };

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Etapas de la evaluacion"
        className="flex flex-wrap gap-1 overflow-x-auto border-b border-border"
      >
        {TABS.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              onClick={() => setActive(t.id)}
              className={
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
                (selected
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
        {content[active]}
      </div>
    </div>
  );
}
