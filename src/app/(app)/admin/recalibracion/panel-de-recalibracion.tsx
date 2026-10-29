"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { preservarScroll } from "@/components/shared/preservar-scroll";
import type { EvaluacionDesfasada } from "@/modules/clinical-pipeline/data/desfasadas-reader";
import {
  reemitirDiagnosticosAction,
  type ReemitirActionState,
} from "@/modules/clinical-pipeline/recalibracion-actions";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL PANEL DE LA RECALIBRACION
//
// ═══ LAS DE PRUEBA SE VEN, MARCADAS, Y NO SE SELECCIONAN SOLAS ═══
//
// Capa 3 de la regla del paciente de prueba ("marcadas, no escondidas"): esconderlas haria que la cuenta
// de la pantalla no cuadre con la de la base y que nadie pueda probar aqui. Pero no entran en la seleccion
// por defecto, porque recalcular datos de smoke gasta el motor sobre lo que no es operacion real.
//
// ═══ LA TANDA ES DE 50 COMO MAXIMO, y lo dice el boton ═══
//
// El tope esta en el schema de la action; aqui se REFLEJA en vez de repetirse como numero suelto, y el
// rotulo dice cuantas van. Un boton que manda 351 y falla en la 200 deja un estado que nadie puede
// reanudar sin saber donde se corto.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const TOPE_POR_TANDA = 50;

export function PanelDeRecalibracion({ desfasadas }: { desfasadas: EvaluacionDesfasada[] }) {
  const reales = desfasadas.filter((d) => !d.esDePrueba);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<ReemitirActionState | null>(null);
  const [enCurso, empezar] = useTransition();

  const alternar = (id: string) =>
    setElegidas((antes) => {
      const ahora = new Set(antes);
      if (ahora.has(id)) ahora.delete(id);
      else ahora.add(id);
      return ahora;
    });

  const tomarLasPrimeras = () =>
    setElegidas(new Set(reales.slice(0, TOPE_POR_TANDA).map((d) => d.evaluationId)));

  const correr = () => {
    const ids = [...elegidas];
    if (ids.length === 0) return;
    // EL GUARD DEL SCROLL ANTES DE LA TRANSICION, y no es cosmetico: al invocar una server action Next
    // navega con ScrollBehavior.Default y la pagina salta al inicio, asi que el informe de la tanda
    // aparece fuera de la vista justo cuando hay que leerlo. No se usa `ejecutarAccion` porque esa es
    // para botones que no esperan respuesta (devuelve void) y aqui el resultado SE PINTA.
    preservarScroll();
    empezar(async () => {
      const r = await reemitirDiagnosticosAction({ evaluationIds: ids, confirmado: true });
      setResultado(r);
      // LAS HECHAS SALEN DE LA SELECCION: si se quedaran marcadas, volver a pulsar las mandaria otra vez
      // (la action las saltaria, pero el informe se llenaria de ruido y quien mira no sabria si algo paso).
      const hechas = new Set(r.resultados.filter((x) => x.estado !== "fallo").map((x) => x.evaluationId));
      setElegidas((antes) => new Set([...antes].filter((id) => !hechas.has(id))));
    });
  };

  if (desfasadas.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        No hay diagnósticos desfasados: todos están sellados con la versión vigente del motor.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {reales.length} desfasadas de pacientes reales
          {desfasadas.length - reales.length > 0
            ? ` · ${desfasadas.length - reales.length} de pacientes de prueba (no se seleccionan)`
            : ""}
        </span>
        <Button type="button" variant="outline" onClick={tomarLasPrimeras} disabled={enCurso}>
          Elegir las primeras {Math.min(TOPE_POR_TANDA, reales.length)}
        </Button>
        <Button type="button" onClick={correr} disabled={enCurso || elegidas.size === 0}>
          {enCurso
            ? "Reemitiendo..."
            : `Reemitir ${elegidas.size} diagnóstico${elegidas.size === 1 ? "" : "s"}`}
        </Button>
      </div>

      {resultado?.error ? (
        <p className="rounded-md border border-clinical-critical/40 bg-clinical-critical-bg px-3 py-2 text-sm text-clinical-critical">
          {resultado.error}
        </p>
      ) : null}

      {resultado && resultado.resultados.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-xl border border-border p-4 text-sm">
          <p className="font-medium text-foreground">
            {resultado.resultados.filter((r) => r.estado === "hecha").length} reemitidas ·{" "}
            {resultado.resultados.filter((r) => r.estado === "saltada").length} ya estaban al día ·{" "}
            {resultado.resultados.filter((r) => r.estado === "fallo").length} con fallo
          </p>
          {/* SOLO SE DETALLAN LOS FALLOS: las hechas ya estan contadas arriba, y una lista de cincuenta
              lineas verdes esconde las dos que importan. */}
          {resultado.resultados
            .filter((r) => r.estado === "fallo")
            .map((r) => (
              <p key={r.evaluationId} className="text-clinical-warning">
                {r.evaluationId.slice(0, 8)}: {r.detalle}
              </p>
            ))}
          <p className="text-muted-foreground">
            El tratamiento y los informes ya enviados no se modificaron.
          </p>
        </div>
      ) : null}

      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {desfasadas.map((d) => (
          <li key={d.evaluationId} className="flex items-center gap-3 px-4 py-2 text-sm">
            <input
              type="checkbox"
              checked={elegidas.has(d.evaluationId)}
              onChange={() => alternar(d.evaluationId)}
              disabled={enCurso}
              aria-label={`Reemitir la evaluación ${d.evaluationId.slice(0, 8)}`}
            />
            <span className="font-mono text-xs text-muted-foreground">
              {d.evaluationId.slice(0, 8)}
            </span>
            <span className="text-muted-foreground">{d.fecha}</span>
            <span className="text-foreground">sellada con {d.selladaCon}</span>
            {d.esDePrueba ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                de prueba
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
