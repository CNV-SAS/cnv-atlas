"use client";

import * as Sentry from "@sentry/nextjs";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

// ═══ UNA ETAPA QUE SE CAE NO SE LLEVA LA CONSULTA ENTERA (2026-10-07) ═══
//
// ── EL CASO QUE LO MOTIVA ──────────────────────────────────────────────────────────────────────────
//
// En producción, el 7 de octubre a las 14:54 UTC, un profesional pasó de Diagnóstico a Antrop. & BIS y
// React lanzó "Rendered more hooks than during the previous render." El `error.tsx` de la raíz lo atrapó,
// así que **toda la pantalla** se reemplazó por "Algo salió mal": el profesional perdió la consulta que
// estaba atendiendo, con el paciente delante.
//
// ── Y LO SEGUNDO, QUE ES LO QUE DESTRABA EL DIAGNOSTICO ────────────────────────────────────────────
//
// El `error.tsx` de Next recibe `{ error, reset }` y NADA MAS: no recibe el `errorInfo` de React, que es
// donde viaja el COMPONENT STACK. Así que por ese camino el evento de Sentry nunca iba a decir qué
// componente se rompió, **ni esperando a que volviera a pasar**. Un error de hooks sin el nombre del
// componente es un error que no se puede arreglar: dice que el conteo cambió, no dónde.
//
// Una frontera de clase SI recibe el `errorInfo`, y la de Sentry lo adjunta al evento. Por eso esto no es
// solo una red de seguridad: es el instrumento que falta.
//
// ── POR QUE POR PANEL Y NO ALREDEDOR DE TODO ───────────────────────────────────────────────────────
//
// Porque el fallo es de UNA etapa y las otras están sanas (siguen montadas, con su borrador dentro). Una
// frontera alrededor del conjunto se llevaría las seis, que es casi lo mismo que tener solo la de la raíz.
// Así la barra de pestañas sobrevive y el profesional se mueve a otra etapa y sigue trabajando.
//
// NO TAPA NADA: el evento se reporta igual (y mejor que antes, con el componente), y el panel dice en
// pantalla que falló en vez de quedarse en blanco. Lo que cambia es el alcance del daño, no si se sabe.
export function PanelConRed({ etapa, children }: { etapa: string; children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      // El nombre de la etapa viaja al evento: sin él, los seis paneles se agrupan en el mismo issue.
      beforeCapture={(scope) => scope.setTag("etapa", etapa)}
      fallback={({ resetError }) => (
        <div className="rounded-xl border border-clinical-warning bg-clinical-warning-bg p-6">
          <p className="text-sm font-semibold text-clinical-warning">
            Esta pestaña no se pudo mostrar
          </p>
          <p className="mt-1 max-w-prose text-sm text-foreground">
            Ya registramos el problema. Las demás pestañas siguen funcionando y{" "}
            <strong>no se perdió nada de lo guardado</strong>.
          </p>
          <Button className="mt-3" size="sm" onClick={() => resetError()}>
            Volver a intentarlo
          </Button>
        </div>
      )}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
