"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode } from "react";

// Subpestañas de Tratamiento (dentro del tab externo "Tratamiento"). El HTML divide Tratamiento en dos:
// "Rutas de atencion" (comun a toda profesion: rutas del DFI, nutraceuticos, remisiones) y la del
// PROFESIONAL (su workspace, cuyo nombre va por profesion). Se envuelve el contenido que YA existe, sin
// desarmar nada, para que el smoke de la estructura sea limpio (si algo se rompe, es la estructura, no el
// contenido). Mismo patron que DiagnosisSubtabs:
//  - la subpestaña activa vive en la URL (?trat=...), NO en useState: el tab externo remonta este arbol al
//    volver de otra etapa, y un useState se reiniciaria a la primera. Con la URL se conserva, y recargar o
//    compartir el enlace abre la correcta.
//  - PARAMETRO PROPIO (?trat=), distinto de ?sub (Diagnostico) y ?ev (Evaluacion): al conmutar se COPIAN
//    todos los params y solo se fija el propio, asi cada etapa recuerda SU subpestaña y ninguna pisa a la
//    otra si ambas quedan en la URL.
//  - default: Rutas (primera, orden del HTML).

type SubId = "rutas" | "profesion";

function parseSub(raw: string | null): SubId {
  return raw === "profesion" ? "profesion" : "rutas"; // default: Rutas
}

export function TreatmentSubtabs({
  rutas,
  profesion,
  profesionLabel,
}: {
  rutas: ReactNode;
  profesion: ReactNode;
  profesionLabel: string;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const active = parseSub(searchParams.get("trat"));
  const content: Record<SubId, ReactNode> = { rutas, profesion };
  const subtabs: { id: SubId; label: string }[] = [
    { id: "rutas", label: "Rutas de atención" },
    { id: "profesion", label: profesionLabel },
  ];

  function select(id: SubId) {
    // Copia TODOS los params (conserva ?sub y ?ev de las otras etapas) y fija solo el propio; ninguno pisa
    // al otro. replaceState, no router.replace: el contenido de las dos subpestañas ya llego del servidor,
    // asi que conmutar es instantaneo (sin refetch). La URL igual persiste (recargar/compartir/volver).
    const params = new URLSearchParams(searchParams.toString());
    params.set("trat", id);
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Secciones del tratamiento"
        className="flex flex-wrap gap-1 overflow-x-auto border-b border-border"
      >
        {subtabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              id={`trattab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`tratpanel-${t.id}`}
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

      <div role="tabpanel" id={`tratpanel-${active}`} aria-labelledby={`trattab-${active}`}>
        {content[active]}
      </div>
    </div>
  );
}
