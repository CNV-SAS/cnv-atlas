"use client";

import { useState, type ReactNode } from "react";

// Shell de pestañas de una evaluacion (/evaluaciones/[id]). Adopta el flujo por etapas del HTML
// como tabs internas (familiaridad de formacion); el sidebar sigue navegando entre entidades.
// Este bloque construye SOLO la pestaña de Diagnostico; las demas quedan como placeholder (son
// bloques posteriores). El contenido de Diagnostico se computa en el servidor y llega como prop
// (ReactNode), asi el cambio de tab es client-side sin refetch ni perder la RLS del server.

type TabId = "encuesta" | "antropometria" | "diagnostico" | "rutas" | "seguimiento" | "reporte";

const TABS: { id: TabId; label: string }[] = [
  { id: "encuesta", label: "Encuesta" },
  { id: "antropometria", label: "Antrop & BIS" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "rutas", label: "Rutas" },
  { id: "seguimiento", label: "Seguimiento" },
  { id: "reporte", label: "Reporte" },
];

export function EvaluationTabs({ diagnostico }: { diagnostico: ReactNode }) {
  const [active, setActive] = useState<TabId>("diagnostico");
  const activeLabel = TABS.find((t) => t.id === active)?.label ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Secciones de la evaluación"
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
        {active === "diagnostico" ? (
          diagnostico
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
            <p className="text-sm font-medium text-foreground">{activeLabel}</p>
            <p className="max-w-prose text-sm text-muted-foreground">
              Esta sección se construye en un bloque posterior. Por ahora, el diagnóstico completo
              está en la pestaña Diagnóstico.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
