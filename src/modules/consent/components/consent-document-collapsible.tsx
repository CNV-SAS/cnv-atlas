"use client";

import { useState } from "react";

import { ConsentDocument } from "./consent-document";

// Consentimiento COLAPSADO con "ver mas" (B7 UX). El texto completo NO se esconde: se muestra un preview
// (las primeras lineas, con un degradado) y un boton que lo despliega entero. Colapsar esta bien, esconder
// no: un consentimiento que el paciente no puede leer completo es cuestionable. No se fuerza el
// desplazamiento (Santiago); basta con que el texto COMPLETO este disponible con un click.
export function ConsentDocumentCollapsible({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div className={expanded ? "" : "max-h-72 overflow-hidden"}>
          <ConsentDocument text={text} />
        </div>
        {/* Degradado que insinua que hay mas texto (solo colapsado). */}
        {!expanded ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-lg bg-gradient-to-t from-background to-transparent"
          />
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="self-start rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
      >
        {expanded ? "Ver menos" : "Ver el consentimiento completo"}
      </button>
    </div>
  );
}
