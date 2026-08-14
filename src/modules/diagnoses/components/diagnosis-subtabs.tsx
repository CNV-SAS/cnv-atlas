"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode } from "react";

// Subpestañas del Diagnostico (dentro del tab externo "Diagnostico"). Tres, no una pantalla de corrido:
// con D2-D8 dentro ya no cabe (demasiado largo), pero se mantienen POCAS (cada nivel de navegacion es un
// sitio mas donde perderse). El QUE es de Gildardo (sus capas); el COMO es nuestro (regla del cotejo):
//  - default FUNCIONAL, no Encuesta (su HTML abre en Encuesta y esconderia el DFI, que es lo que mas se
//    mira; DIVERGENCIA deliberada, DIV-7).
//  - la subpestaña activa vive en la URL (?sub=...), NO en useState: el tab externo remonta este arbol al
//    volver de Tratamiento, y un useState se reiniciaria a la primera. Con la URL se conserva, y ademas
//    recargar o compartir el enlace abre la correcta.

type SubId = "funcional" | "composicion" | "encuesta";

const SUBTABS: { id: SubId; label: string }[] = [
  { id: "funcional", label: "Diagnóstico Funcional" },
  { id: "composicion", label: "Composición Corporal" },
  { id: "encuesta", label: "Diagnóstico Encuesta" },
];

function parseSub(raw: string | null): SubId {
  return raw === "composicion" || raw === "encuesta" ? raw : "funcional"; // default: Funcional
}

export function DiagnosisSubtabs({
  funcional,
  composicion,
  encuesta,
}: {
  funcional: ReactNode;
  composicion: ReactNode;
  encuesta: ReactNode;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const active = parseSub(searchParams.get("sub"));
  const content: Record<SubId, ReactNode> = { funcional, composicion, encuesta };

  function select(id: SubId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sub", id);
    // history.replaceState, NO router.replace: actualiza la URL SIN re-pedir el RSC al servidor (Next 16
    // sincroniza useSearchParams con la History API). El contenido de las tres subpestañas ya llego del
    // servidor, asi que conmutar es INSTANTANEO; router.replace hacia un refetch (~2s de lag). La URL
    // igual persiste (recargar/compartir abre la correcta) y se conserva al volver de Tratamiento.
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Secciones del diagnóstico"
        className="flex flex-wrap gap-1 overflow-x-auto border-b border-border"
      >
        {SUBTABS.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              id={`subtab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`subpanel-${t.id}`}
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

      <div role="tabpanel" id={`subpanel-${active}`} aria-labelledby={`subtab-${active}`}>
        {content[active]}
      </div>
    </div>
  );
}
