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
// ═══ TRES GRUPOS, Y LA SUMA TIENE QUE CUADRAR CON EL REPORTE ═══
//
// Antes habia dos cifras sueltas ("392 desfasadas de pacientes reales") y el reporte previo decia que
// entraban 360. Las dos eran correctas y contestaban preguntas distintas, pero la pantalla no decia cual
// contestaba la suya, asi que la diferencia de 32 filas era invisible (Santiago, 2026-10-29).
//
// Ahora se parte en tres y la suma se enseña: las que ENTRAN, las que NO SE PUEDEN con su motivo, y las
// de prueba. Una pantalla que ofrece mas filas que las que el reporte autoriza invita a correr lo que
// nadie reviso.
//
// ═══ LAS QUE NO SE PUEDEN SE VEN, PERO NO SE SELECCIONAN ═══
//
// Sin casilla, no deshabilitada: una casilla gris invita a buscar como habilitarla, y aqui no hay nada
// que habilitar. El motivo va en la fila, no en una leyenda al pie: *"un boton muerto sin explicacion es
// peor que un error claro"*.
//
// ═══ LAS DE PRUEBA, PLEGADAS EN UNA LINEA ═══
//
// Capa 3 de la regla del paciente de prueba ("marcadas, no escondidas"): esconderlas haria que la cuenta
// de la pantalla no cuadre con la de la base. Pero ocupaban 33 filas de una lista donde lo que hay que
// leer son las reales, asi que se cuentan en una linea y se despliegan si alguien las quiere ver.
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
  const entran = reales.filter((d) => d.motivoSinReemitir == null);
  const noSePueden = reales.filter((d) => d.motivoSinReemitir != null);
  const dePrueba = desfasadas.filter((d) => d.esDePrueba);

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
    setElegidas(new Set(entran.slice(0, TOPE_POR_TANDA).map((d) => d.evaluationId)));

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
      {/* LA CUENTA, DESGLOSADA Y SUMANDO. Que los tres grupos sumen el total es lo que permite cotejar
          esta pantalla contra el reporte previo sin tener que contar filas a mano. */}
      <div className="flex flex-col gap-1 rounded-xl border border-border p-4 text-sm">
        <p className="text-foreground">
          <span className="font-medium">{entran.length}</span> entran al recalculo
        </p>
        <p className="text-muted-foreground">
          {noSePueden.length} no se pueden reemitir (abajo, con su motivo) · {dePrueba.length} de
          pacientes de prueba
        </p>
        <p className="text-xs text-muted-foreground">
          Total desfasadas: {desfasadas.length}. Si esta cuenta no coincide con el reporte previo, la
          base se movió desde que se corrió: vuelve a correrlo antes de la tanda.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={tomarLasPrimeras}
          disabled={enCurso || entran.length === 0}
        >
          Elegir las primeras {Math.min(TOPE_POR_TANDA, entran.length)}
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

      {entran.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {entran.map((d) => (
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
            </li>
          ))}
        </ul>
      ) : null}

      {noSePueden.length > 0 ? (
        <details className="rounded-xl border border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm text-foreground">
            {noSePueden.length} no se pueden reemitir
          </summary>
          <ul className="flex flex-col divide-y divide-border border-t border-border">
            {noSePueden.map((d) => (
              <li key={d.evaluationId} className="flex flex-col gap-0.5 px-4 py-2 text-sm">
                <span className="flex flex-wrap items-center gap-3">
                  {/* SIN CASILLA, no deshabilitada: ver la nota de arriba. */}
                  <span className="font-mono text-xs text-muted-foreground">
                    {d.evaluationId.slice(0, 8)}
                  </span>
                  <span className="text-muted-foreground">{d.fecha}</span>
                  <span className="text-muted-foreground">sellada con {d.selladaCon}</span>
                </span>
                <span className="text-clinical-warning">{d.motivoSinReemitir}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            Estas quedan marcadas como desfasadas: nadie las va a reemitir. Las de medición repetida
            salen de aquí solas en cuanto se resuelva a quién pertenece la toma.
          </p>
        </details>
      ) : null}

      {dePrueba.length > 0 ? (
        <details className="rounded-xl border border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm text-muted-foreground">
            {dePrueba.length} de pacientes de prueba (no se reemiten)
          </summary>
          <ul className="flex flex-col divide-y divide-border border-t border-border">
            {dePrueba.map((d) => (
              <li
                key={d.evaluationId}
                className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm text-muted-foreground"
              >
                <span className="font-mono text-xs">{d.evaluationId.slice(0, 8)}</span>
                <span>{d.fecha}</span>
                <span>sellada con {d.selladaCon}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
