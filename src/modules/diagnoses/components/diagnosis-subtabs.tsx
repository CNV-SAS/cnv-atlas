"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode } from "react";

// Subpestañas del Diagnostico (dentro del tab externo "Diagnostico"). El QUE es de Gildardo (sus capas y
// su orden); el COMO es nuestro (regla del cotejo).
//
// CUATRO Y EN SU ORDEN desde el 2026-09-07 (puntos 7 y 11 de su cotejo). Eran tres y en otro orden.
// Textual suyo, punto 7: "en diagnostico, diagnostico encuesta debe ir primero". Y punto 11: "el resumen
// del diagnostico generado por IA es aparte, no va dentro de ninguno de los 3 que tienen, y va de ultimo".
//
// Verificado contra su entrega vigente (v8 del 4 de septiembre), donde son exactamente estas cuatro:
//   Diagnostico Encuesta (D1-D8) · Composicion Corporal · Diagnostico Funcional · Resumen del Diagnostico
//
// LOS DOS PUNTOS SON UN SOLO TRABAJO: la cuarta subpestaña no existe para tener una cuarta, existe porque
// el criterio del profesional tenia que salir de Funcional.
//  - default FUNCIONAL, no Encuesta (su HTML abre en Encuesta y esconderia el DFI, que es lo que mas se
//    mira; DIVERGENCIA deliberada, DIV-7).
//  - la subpestaña activa vive en la URL (?sub=...), NO en useState: el tab externo remonta este arbol al
//    volver de Tratamiento, y un useState se reiniciaria a la primera. Con la URL se conserva, y ademas
//    recargar o compartir el enlace abre la correcta.

type SubId = "encuesta" | "composicion" | "funcional" | "resumen";

// EL ORDEN DE ESTE ARREGLO ES EL DE SU ARCHIVO. No se reordena sin su instruccion.
const SUBTABS: { id: SubId; label: string }[] = [
  { id: "encuesta", label: "Diagnóstico Encuesta" },
  { id: "composicion", label: "Composición Corporal" },
  { id: "funcional", label: "Diagnóstico Funcional" },
  { id: "resumen", label: "Resumen del Diagnóstico" },
];

// EL DEFAULT SIGUE SIENDO FUNCIONAL, y eso es DIV-7, que no cambia con el reorden. Su HTML abre en
// Encuesta; abrir ahi esconderia el DFI, que es lo que mas se mira. Cambio el ORDEN, que es lo que el
// pidio; cual se abre primero sigue declarado como divergencia nuestra.
function parseSub(raw: string | null): SubId {
  return raw === "composicion" || raw === "encuesta" || raw === "resumen" ? raw : "funcional";
}

export function DiagnosisSubtabs({
  funcional,
  composicion,
  encuesta,
  resumen,
}: {
  funcional: ReactNode;
  composicion: ReactNode;
  encuesta: ReactNode;
  resumen: ReactNode;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const active = parseSub(searchParams.get("sub"));
  const content: Record<SubId, ReactNode> = { funcional, composicion, encuesta, resumen };

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
