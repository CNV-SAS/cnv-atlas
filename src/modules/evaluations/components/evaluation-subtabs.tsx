"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode } from "react";

// Subpestañas de la etapa EVALUACION (division pedida por Gildardo, smoke Santiago 2026-08-15):
//  - ENCUESTA: consentimiento, encuesta del paciente y condiciones de la toma BIS (el checklist PRE-medicion).
//  - ANTROPOMETRIA Y BIS: import del archivo, tabla de composicion y diagnostico de sarcopenia.
// El QUE (la division) es de Gildardo; el COMO (subpestaña URL-driven) es nuestro, mismo mecanismo que
// DiagnosisSubtabs: la activa vive en ?ev= (no useState), para que sobreviva al remontaje del tab externo y
// al compartir/recargar el enlace. Default ENCUESTA: es lo PRIMERO de la secuencia (consentimiento -> encuesta
// -> condiciones -> import), y Antropometria DEPENDE de ella (sin condiciones capturadas, el import no va).

type SubId = "encuesta" | "antropometria";

const SUBTABS: { id: SubId; label: string }[] = [
  { id: "encuesta", label: "Encuesta" },
  { id: "antropometria", label: "Antropometría y BIS" },
];

function parseSub(raw: string | null): SubId {
  return raw === "antropometria" ? "antropometria" : "encuesta"; // default: Encuesta (primero en la secuencia)
}

export function EvaluationSubtabs({
  encuesta,
  antropometria,
}: {
  encuesta: ReactNode;
  antropometria: ReactNode;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const active = parseSub(searchParams.get("ev"));
  const content: Record<SubId, ReactNode> = { encuesta, antropometria };

  function select(id: SubId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("ev", id);
    // history.replaceState (no router.replace): actualiza la URL SIN re-pedir el RSC (Next 16 sincroniza
    // useSearchParams con la History API). Ambos paneles ya llegaron del servidor: conmutar es instantaneo.
    window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Secciones de la evaluación"
        className="flex flex-wrap gap-1 overflow-x-auto border-b border-border"
      >
        {SUBTABS.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              id={`evsubtab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`evsubpanel-${t.id}`}
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

      <div role="tabpanel" id={`evsubpanel-${active}`} aria-labelledby={`evsubtab-${active}`}>
        {content[active]}
      </div>
    </div>
  );
}
