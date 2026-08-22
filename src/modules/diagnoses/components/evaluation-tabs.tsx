"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode } from "react";

// Shell de pestañas de una evaluacion (/evaluaciones/[id]). Adopta las 4 etapas reales de la ruta
// ANI-BIS-E como tabs internas (es la estructura real de la ruta clinica, no "familiaridad de
// formacion": los profesionales se forman en Atlas, no en el HTML); el sidebar sigue navegando entre
// entidades. Encuesta y Antrop & BIS no son etapas propias: son las dos entradas de datos de la
// evaluacion, viven como secciones dentro de Evaluacion. El contenido de cada etapa se computa en
// el servidor y llega como prop (ReactNode), asi el cambio de tab es client-side sin refetch ni
// perder la RLS del server.
//
// La ETAPA activa vive en la URL (?etapa=...), NO en useState (mismo patron que las subpestañas): sin esto,
// recargar o compartir un enlace SIEMPRE abria en el default (Diagnostico), sin importar donde estaba el
// profesional; y las subpestañas (?sub/?ev/?trat) quedaban en la URL pero nunca se llegaba a su etapa para
// usarlas (bug del smoke 2026-08-21). PARAMETRO PROPIO (?etapa), distinto de los tres de subpestaña: al
// conmutar se COPIAN todos los params y solo se fija el propio, asi las cuatro conviven sin pisarse y cada
// etapa recuerda su subpestaña al volver. Default: Diagnostico (lo mas mirado); sin ?etapa abre ahi, como hoy.

type TabId = "evaluacion" | "diagnostico" | "tratamiento" | "seguimiento";

const TABS: { id: TabId; label: string }[] = [
  { id: "evaluacion", label: "Evaluación" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "tratamiento", label: "Tratamiento" },
  { id: "seguimiento", label: "Seguimiento" },
];

function parseTab(raw: string | null): TabId {
  return raw === "evaluacion" || raw === "tratamiento" || raw === "seguimiento" ? raw : "diagnostico";
}

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
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const active = parseTab(searchParams.get("etapa"));
  const content: Record<TabId, ReactNode> = { evaluacion, diagnostico, tratamiento, seguimiento };

  function select(id: TabId) {
    // Copia TODOS los params (conserva ?sub/?ev/?trat de las subpestañas) y fija solo el propio; ninguno
    // pisa al otro. replaceState, no router.replace: el contenido de las 4 etapas ya llego del servidor, asi
    // que conmutar es instantaneo (sin refetch). La URL persiste (recargar/compartir/volver abre la correcta).
    const params = new URLSearchParams(searchParams.toString());
    params.set("etapa", id);
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Etapas de la evaluación"
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
              onClick={() => select(t.id)}
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
